const express = require('express'), cors = require('cors');
const { pool } = require('./db');
const A = require('./lib/analytics'), { plates } = require('./lib/plates'), P = require('./lib/program');

const app = express(); app.use(cors(), express.json());
const h = (fn) => (req, res) => fn(req, res).catch((e) => res.status(e.status || 500).json({ error: e.message }));
const bad = (m) => Object.assign(new Error(m), { status: 400 });

const SETS_SQL = `SELECT w.id workout_id, to_char(w.date,'YYYY-MM-DD') date, w.variation, w.bodyweight::float bodyweight,
  s.weight::float weight, s.reps, s.rpe::float rpe, s.is_warmup FROM workouts w JOIN sets s ON s.workout_id = w.id ORDER BY w.date, s.set_number`;
const allSets = async () => (await pool.query(SETS_SQL)).rows;

function validate(b) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) throw bad('date must be YYYY-MM-DD');
  if (!Array.isArray(b.sets) || !b.sets.length) throw bad('Add at least one set');
  for (const s of b.sets) if (!(s.weight > 0) || !Number.isInteger(s.reps) || s.reps < 1) throw bad('Each set needs weight > 0 and whole reps >= 1');
}
async function save(client, id, b) {
  const v = [b.date, b.variation || 'Competition Bench', b.grip, b.bodyweight || null, b.notes];
  if (id) { await client.query('DELETE FROM sets WHERE workout_id=$1', [id]);
    await client.query('UPDATE workouts SET date=$2,variation=$3,grip=$4,bodyweight=$5,notes=$6 WHERE id=$1', [id, ...v]); }
  else id = (await client.query('INSERT INTO workouts(date,variation,grip,bodyweight,notes) VALUES($1,$2,$3,$4,$5) RETURNING id', v)).rows[0].id;
  for (const [i, s] of b.sets.entries())
    await client.query('INSERT INTO sets(workout_id,set_number,weight,reps,rpe,is_warmup) VALUES($1,$2,$3,$4,$5,$6)', [id, i + 1, s.weight, s.reps, s.rpe || null, !!s.warmup]);
  return id;
}
async function tx(fn) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}

app.get('/api/health', (_, res) => res.json({ ok: true }));
app.get('/api/workouts', h(async (_, res) => res.json((await pool.query(`
  SELECT w.id, to_char(w.date,'YYYY-MM-DD') date, w.variation, w.grip, w.bodyweight::float bodyweight, w.notes,
   COALESCE(json_agg(json_build_object('weight',s.weight::float,'reps',s.reps,'rpe',s.rpe::float,'warmup',s.is_warmup) ORDER BY s.set_number) FILTER (WHERE s.id IS NOT NULL),'[]') sets
  FROM workouts w LEFT JOIN sets s ON s.workout_id=w.id GROUP BY w.id ORDER BY w.date DESC, w.id DESC`)).rows)));
app.post('/api/workouts', h(async (req, res) => {
  validate(req.body);
  const history = await allSets();
  const newPRs = A.detectNewPRs(history, req.body.sets.map((s) => ({ ...s, is_warmup: !!s.warmup })), req.body.variation || 'Competition Bench');
  const id = await tx((c) => save(c, null, req.body));
  res.status(201).json({ id, newPRs });
}));
app.put('/api/workouts/:id', h(async (req, res) => { validate(req.body); await tx((c) => save(c, +req.params.id, req.body)); res.json({ ok: true }); }));
app.delete('/api/workouts/:id', h(async (req, res) => { await pool.query('DELETE FROM workouts WHERE id=$1', [req.params.id]); res.status(204).end(); }));

app.get('/api/summary', h(async (req, res) => res.json(A.summary(await allSets(), { formula: req.query.formula, variation: req.query.variation }))));
app.get('/api/goal', h(async (_, res) => res.json((await pool.query("SELECT target::float, to_char(target_date,'YYYY-MM-DD') target_date FROM goal")).rows[0] || null)));
app.put('/api/goal', h(async (req, res) => {
  if (!(req.body.target > 0)) throw bad('target required');
  await pool.query('INSERT INTO goal(id,target,target_date) VALUES(1,$1,$2) ON CONFLICT(id) DO UPDATE SET target=$1,target_date=$2', [req.body.target, req.body.target_date || null]);
  res.json({ ok: true });
}));
const wrap = (fn) => h(async (req, res) => { try { res.json(fn(req)); } catch (e) { throw bad(e.message); } });
app.get('/api/plates', wrap((r) => plates(+r.query.weight, { unit: r.query.unit })));
app.get('/api/weak-points', (_, res) => res.json(P.WEAK_POINTS));
app.post('/api/program', wrap((r) => P.buildProgram(r.body)));
app.post('/api/program/next-session', wrap((r) => P.nextSession(r.body)));
module.exports = app;
