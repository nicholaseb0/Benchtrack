import { useEffect, useState } from 'react';

const api = (p, o) => fetch('/api' + p, { headers: { 'Content-Type': 'application/json' }, ...o })
  .then(async (r) => { if (r.status === 204) return null; const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Request failed'); return d; });
const send = (p, body, method = 'POST') => api(p, { method, body: JSON.stringify(body) });
const VARIATIONS = ['Competition Bench', 'Touch-and-Go Bench', 'Paused Bench', 'Close-Grip Bench', 'Spoto Press', 'Incline Bench'];
const today = () => new Date().toISOString().slice(0, 10);

function Chart({ data, x, y, color = '#c4202f' }) {
  if (data.length < 2) return <p className="mute">Log workouts on at least two different days to see a trend.</p>;
  const W = 640, H = 200, P = 36, vs = data.map((d) => d[y]), lo = Math.min(...vs) - 5, hi = Math.max(...vs) + 5;
  const pt = (d, i) => [P + (i * (W - P * 2)) / (data.length - 1), H - P - ((d[y] - lo) / (hi - lo)) * (H - P * 2)];
  const pts = data.map(pt);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Trend chart">
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth="3" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="4" fill={color}><title>{data[i][x]}: {data[i][y]}</title></circle>)}
      <text x="4" y={P} fontSize="11" fill="#5d6770">{Math.round(hi)}</text><text x="4" y={H - P} fontSize="11" fill="#5d6770">{Math.round(lo)}</text>
      <text x={P} y={H - 8} fontSize="11" fill="#5d6770">{data[0][x]}</text><text x={W - P} y={H - 8} fontSize="11" textAnchor="end" fill="#5d6770">{data.at(-1)[x]}</text>
    </svg>
  );
}
const Stat = ({ label, value, sub }) => <div className="stat"><small>{label}</small><div className="big">{value ?? '–'}</div><small>{sub}</small></div>;

function Dashboard() {
  const [s, setS] = useState(null), [formula, setFormula] = useState('brzycki'), [goal, setGoal] = useState(null), [g, setG] = useState({ target: '', target_date: '' });
  const load = () => { api('/summary?formula=' + formula).then(setS); api('/goal').then((x) => { setGoal(x); if (x) setG({ target: x.target, target_date: x.target_date || '' }); }); };
  useEffect(load, [formula]);
  if (!s) return <p>Loading…</p>;
  if (s.empty) return <p className="panel">No workouts yet. Log your first bench session to see your dashboard.</p>;
  const pct = goal ? Math.min(100, Math.round(((s.actualBest || s.currentE1RM) / goal.target) * 100)) : 0;
  return <>
    <div className="row"><label>Estimated 1RM formula<select value={formula} onChange={(e) => setFormula(e.target.value)}><option>brzycki</option><option>epley</option><option>lombardi</option></select></label></div>
    <div className="stats">
      <Stat label="Estimated 1RM" value={s.currentE1RM} sub={s.e1rmChange != null ? `${s.e1rmChange >= 0 ? '+' : ''}${s.e1rmChange} vs earlier` : 'last 4 weeks'} />
      <Stat label="Best actual 1RM" value={s.actualBest} sub="logged single" />
      <Stat label="Best set" value={`${s.bestSet.weight}×${s.bestSet.reps}`} />
      <Stat label="Bench / bodyweight" value={s.ratio ? s.ratio + '×' : null} sub={s.bodyweight ? `${s.bodyweight} bodyweight` : 'add bodyweight'} />
      <Stat label="Avg RPE" value={s.avgRpe} sub={`${s.sessionsPerWeek} sessions/week`} />
    </div>
    {s.plateau && <div className="pr">Plateau: estimated 1RM stayed between {s.plateau.min} and {s.plateau.max} for {s.plateau.weeks} weeks. Try the Program tab's “General plateau” option.</div>}
    <div className="panel"><h2>Estimated 1RM over time</h2><Chart data={s.e1rmHistory} x="date" y="e1rm" /></div>
    <div className="panel"><h2>Weekly volume</h2><Chart data={s.weeklyVolume} x="week" y="volume" color="#1d4f91" /></div>
    <div className="panel"><h2>Goal</h2>
      <div className="row"><label>Target bench<input type="number" value={g.target} onChange={(e) => setG({ ...g, target: e.target.value })} /></label>
        <label>Target date<input type="date" value={g.target_date} onChange={(e) => setG({ ...g, target_date: e.target.value })} /></label>
        <button className="act" onClick={() => send('/goal', { target: +g.target, target_date: g.target_date || null }, 'PUT').then(load)}>Save goal</button></div>
      {goal && <><progress value={pct} max="100" style={{ width: '100%' }} /> <span>{pct}% of {goal.target}{goal.target_date ? ` by ${goal.target_date}` : ''}</span></>}
    </div></>;
}

function Log() {
  const blank = { weight: '', reps: '', rpe: '', warmup: false };
  const [f, setF] = useState({ date: today(), variation: VARIATIONS[0], grip: 'Medium', bodyweight: '', notes: '' });
  const [sets, setSets] = useState([{ ...blank }]), [prs, setPrs] = useState([]), [err, setErr] = useState(''), [list, setList] = useState([]);
  const load = () => api('/workouts').then(setList);
  useEffect(() => { load(); }, []);
  const upd = (i, k, v) => setSets(sets.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  const submit = async () => {
    setErr('');
    try {
      const body = { ...f, bodyweight: +f.bodyweight || null, sets: sets.filter((s) => s.weight).map((s) => ({ weight: +s.weight, reps: +s.reps, rpe: s.rpe ? +s.rpe : null, warmup: s.warmup })) };
      const r = await send('/workouts', body); setPrs(r.newPRs); setSets([{ ...blank }]); load();
    } catch (e) { setErr(e.message); }
  };
  return <>
    <div className="panel"><h2>Log workout</h2>
      <div className="row">
        <label>Date<input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
        <label>Variation<select value={f.variation} onChange={(e) => setF({ ...f, variation: e.target.value })}>{VARIATIONS.map((v) => <option key={v}>{v}</option>)}</select></label>
        <label>Grip<select value={f.grip} onChange={(e) => setF({ ...f, grip: e.target.value })}><option>Close</option><option>Medium</option><option>Wide</option></select></label>
        <label>Bodyweight<input type="number" value={f.bodyweight} onChange={(e) => setF({ ...f, bodyweight: e.target.value })} style={{ width: 90 }} /></label>
      </div>
      {sets.map((s, i) => <div className="row" key={i}>
        <label>Weight<input type="number" value={s.weight} onChange={(e) => upd(i, 'weight', e.target.value)} style={{ width: 90 }} /></label>
        <label>Reps<input type="number" value={s.reps} onChange={(e) => upd(i, 'reps', e.target.value)} style={{ width: 70 }} /></label>
        <label>RPE<input type="number" step="0.5" value={s.rpe} onChange={(e) => upd(i, 'rpe', e.target.value)} style={{ width: 70 }} /></label>
        <label><span>Warm-up</span><input type="checkbox" checked={s.warmup} onChange={(e) => upd(i, 'warmup', e.target.checked)} /></label>
        {sets.length > 1 && <button className="link" onClick={() => setSets(sets.filter((_, j) => j !== i))}>Remove set</button>}
      </div>)}
      <div className="row"><button className="link" onClick={() => setSets([...sets, { ...sets.at(-1), reps: sets.at(-1).reps }])}>Add set</button></div>
      <label>Notes<textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
      <p><button className="act" onClick={submit}>Save workout</button> <span className="err">{err}</span></p>
      {prs.map((p) => <div className="pr" key={p.reps}>New {p.reps}-rep PR: {p.weight} (was {p.previous || 'none'})</div>)}
    </div>
    <div className="panel"><h2>History</h2>
      {!list.length && <p className="mute">Nothing logged yet.</p>}
      {list.map((w) => <div key={w.id} style={{ marginBottom: 12 }}>
        <strong>{w.date}</strong> — {w.variation} <button className="link" onClick={() => confirm('Delete this workout?') && api('/workouts/' + w.id, { method: 'DELETE' }).then(load)}>Delete</button>
        <div className="mute">{w.sets.map((s) => `${s.weight}×${s.reps}${s.rpe ? ' @' + s.rpe : ''}${s.warmup ? ' (warm-up)' : ''}`).join(' · ')}{w.notes ? ` — ${w.notes}` : ''}</div>
      </div>)}
    </div></>;
}

function PRs() {
  const [s, setS] = useState(null);
  useEffect(() => { api('/summary').then(setS); }, []);
  if (!s) return <p>Loading…</p>;
  if (s.empty) return <p className="panel">No PRs yet. Log a workout first.</p>;
  const reps = [1, 2, 3, 5, 8, 10];
  return <div className="panel"><h2>PR board</h2><table><thead><tr><th>Variation</th>{reps.map((r) => <th key={r}>{r} rep</th>)}</tr></thead><tbody>
    {Object.entries(s.prs).map(([v, p]) => <tr key={v}><td>{v}</td>{reps.map((r) => <td key={r}>{p[r] ? `${p[r].weight}` : '–'}</td>)}</tr>)}
  </tbody></table></div>;
}

function Program() {
  const [f, setF] = useState({ current: 225, goal: 275, benchDays: 3, experience: 'intermediate', weakPoint: 'none', style: 'percentage' });
  const [wps, setWps] = useState({}), [prog, setProg] = useState(null), [err, setErr] = useState('');
  const [n, setN] = useState({ weight: 225, prescribedSets: 5, prescribedReps: 5, completed: '5,5,5,4,3', failStreak: 0 }), [nr, setNr] = useState(null);
  useEffect(() => { api('/weak-points').then(setWps); }, []);
  const set = (k, num) => (e) => setF({ ...f, [k]: num ? +e.target.value : e.target.value });
  const lift = (l) => `${l.name} ${l.sets}×${l.reps}${l.weight ? ' @ ' + l.weight : ` @ RPE ${l.rpe}`}`;
  return <>
    <div className="panel"><h2>Program builder</h2>
      <div className="row">
        <label>Current bench<input type="number" value={f.current} onChange={set('current', 1)} style={{ width: 90 }} /></label>
        <label>Goal bench<input type="number" value={f.goal} onChange={set('goal', 1)} style={{ width: 90 }} /></label>
        <label>Bench days/week<select value={f.benchDays} onChange={set('benchDays', 1)}>{[2, 3, 4].map((d) => <option key={d}>{d}</option>)}</select></label>
        <label>Experience<select value={f.experience} onChange={set('experience')}><option>beginner</option><option>intermediate</option><option>advanced</option></select></label>
        <label>Weak point<select value={f.weakPoint} onChange={set('weakPoint')}>{Object.entries(wps).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
        <label>Style<select value={f.style} onChange={set('style')}><option value="simple">Simple 5×5 progression</option><option value="percentage">Percentage based</option><option value="rpe">RPE based</option></select></label>
      </div>
      <button className="act" onClick={() => { setErr(''); send('/program', f).then(setProg).catch((e) => setErr(e.message)); }}>Generate program</button> <span className="err">{err}</span>
    </div>
    {prog && <div className="panel"><h2>{prog.weakPoint.label}: {prog.weakPoint.why}</h2>
      <p className="mute">Training max {prog.trainingMax}. Starting template built from fixed rules, so edit it to fit you.</p>
      {prog.weeks.map((w) => <details key={w.week} open={w.week === 1}><summary>Week {w.week}{w.deload ? ' (deload)' : ''}</summary>
        {w.sessions.map((s) => <p key={s.day}><strong>Day {s.day}: {s.name}</strong><br />{s.lifts.map(lift).join(', ')}{s.accessories ? <><br /><span className="mute">Accessories: {s.accessories.join(', ')}</span></> : null}</p>)}</details>)}
    </div>}
    <div className="panel"><h2>What's my next session?</h2>
      <div className="row">
        <label>Weight<input type="number" value={n.weight} onChange={(e) => setN({ ...n, weight: +e.target.value })} style={{ width: 90 }} /></label>
        <label>Sets<input type="number" value={n.prescribedSets} onChange={(e) => setN({ ...n, prescribedSets: +e.target.value })} style={{ width: 70 }} /></label>
        <label>Reps<input type="number" value={n.prescribedReps} onChange={(e) => setN({ ...n, prescribedReps: +e.target.value })} style={{ width: 70 }} /></label>
        <label>Reps completed per set<input value={n.completed} onChange={(e) => setN({ ...n, completed: e.target.value })} /></label>
        <label>Failed sessions in a row<input type="number" value={n.failStreak} onChange={(e) => setN({ ...n, failStreak: +e.target.value })} style={{ width: 70 }} /></label>
        <button className="act" onClick={() => send('/program/next-session', { ...n, completed: n.completed.split(',').map(Number) }).then(setNr)}>Check</button>
      </div>
      {nr && <p><strong>{nr.action === 'increase' ? 'Increase' : nr.action === 'repeat' ? 'Repeat' : 'Deload'}:</strong> next session {nr.nextWeight}.</p>}
    </div></>;
}

function Plates() {
  const [w, setW] = useState(275), [unit, setUnit] = useState('lb'), [r, setR] = useState(null), [err, setErr] = useState('');
  useEffect(() => { setErr(''); api(`/plates?weight=${w}&unit=${unit}`).then(setR).catch((e) => { setR(null); setErr(e.message); }); }, [w, unit]);
  return <div className="panel"><h2>Plate calculator</h2>
    <div className="row"><label>Total weight<input type="number" value={w} onChange={(e) => setW(+e.target.value)} /></label>
      <label>Unit<select value={unit} onChange={(e) => setUnit(e.target.value)}><option>lb</option><option>kg</option></select></label></div>
    {err && <p className="err">{err}</p>}
    {r && <p>Bar {r.bar} {unit}. Per side: <strong>{r.perSide.join(', ') || 'none'}</strong>{!r.exact && <span className="err"> (closest loadable: {r.loaded})</span>}</p>}
  </div>;
}

const TABS = { Dashboard, 'Log workout': Log, PRs, Program, Plates };
export default function App() {
  const [tab, setTab] = useState('Dashboard'), Tab = TABS[tab];
  return <><header><h1>BenchTrack</h1><nav>{Object.keys(TABS).map((t) => <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</nav></header><main><Tab key={tab} /></main></>;
}
