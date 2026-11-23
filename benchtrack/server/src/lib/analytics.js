// Pure functions: no DB, fully unit-tested.
const FORMULAS = {
  brzycki: (w, r) => (w * 36) / (37 - r),
  epley: (w, r) => w * (1 + r / 30),
  lombardi: (w, r) => w * Math.pow(r, 0.1),
};
const REP_TARGETS = [1, 2, 3, 5, 8, 10];
const round1 = (x) => Math.round(x * 10) / 10;
const days = (a, b) => (new Date(b) - new Date(a)) / 864e5;

function e1rm(weight, reps, formula = 'brzycki') {
  if (!FORMULAS[formula]) throw new Error(`Unknown formula: ${formula}`);
  if (!(reps >= 1) || (formula === 'brzycki' && reps >= 37)) throw new Error('Invalid reps');
  return round1(reps === 1 ? weight : FORMULAS[formula](weight, reps));
}
const volume = (sets) => sets.reduce((a, s) => a + s.weight * s.reps, 0);

function weekStart(date) { // Monday of that week, ISO string
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
function weeklyVolume(sets) {
  const m = {};
  for (const s of sets) m[weekStart(s.date)] = (m[weekStart(s.date)] || 0) + s.weight * s.reps;
  return Object.keys(m).sort().map((week) => ({ week, volume: m[week] }));
}

// Best weight for >= n reps, per variation (variations never mix).
function repPRs(sets) {
  const out = {};
  for (const s of [...sets].sort((a, b) => a.date.localeCompare(b.date))) {
    const v = (out[s.variation] ||= {});
    for (const n of REP_TARGETS)
      if (s.reps >= n && (!v[n] || s.weight > v[n].weight)) v[n] = { weight: s.weight, date: s.date };
  }
  return out;
}
// Which rep-PRs would `newSets` set, given previous `history`?
function detectNewPRs(history, newSets, variation) {
  const best = (arr, n) => Math.max(0, ...arr.filter((s) => s.reps >= n).map((s) => s.weight));
  const prev = history.filter((s) => s.variation === variation && !s.is_warmup);
  const cur = newSets.filter((s) => !s.is_warmup);
  return REP_TARGETS.map((n) => ({ reps: n, weight: best(cur, n), previous: best(prev, n) }))
    .filter((p) => p.weight > p.previous);
}

function e1rmHistory(sets, formula) {
  const m = {};
  for (const s of sets) m[s.date] = Math.max(m[s.date] || 0, e1rm(s.weight, s.reps, formula));
  return Object.keys(m).sort().map((date) => ({ date, e1rm: m[date] }));
}
// Plateau: e1RM stayed within `tolerance` over the last `weeks` weeks.
function detectPlateau(series, { weeks = 6, tolerance = 0.02 } = {}) {
  if (series.length < 3) return null;
  const last = series[series.length - 1].date;
  const win = series.filter((p) => days(p.date, last) <= weeks * 7);
  if (win.length < 3 || days(win[0].date, last) < weeks * 7 * 0.75) return null;
  const hi = Math.max(...win.map((p) => p.e1rm)), lo = Math.min(...win.map((p) => p.e1rm));
  return (hi - lo) / hi <= tolerance ? { weeks, min: lo, max: hi } : null;
}

function summary(allSets, { formula = 'brzycki', variation } = {}) {
  const sets = allSets.filter((s) => !s.is_warmup && (!variation || s.variation === variation))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!sets.length) return { empty: true };
  const history = e1rmHistory(sets, formula), last = history.at(-1).date;
  const recent = history.filter((p) => days(p.date, last) <= 28).map((p) => p.e1rm);
  const older = history.filter((p) => days(p.date, last) > 28).map((p) => p.e1rm);
  const current = Math.max(...recent);
  const oneRMs = sets.filter((s) => s.reps === 1).map((s) => s.weight);
  const bw = [...sets].reverse().find((s) => s.bodyweight)?.bodyweight;
  const rpes = sets.filter((s) => s.rpe != null).map((s) => s.rpe);
  const spanWeeks = Math.max(1, days(sets[0].date, last) / 7);
  const best = sets.reduce((a, s) => (e1rm(s.weight, s.reps, formula) > e1rm(a.weight, a.reps, formula) ? s : a));
  return {
    formula, currentE1RM: current, e1rmChange: older.length ? round1(current - Math.max(...older)) : null,
    actualBest: oneRMs.length ? Math.max(...oneRMs) : null,
    bestSet: { weight: best.weight, reps: best.reps }, bodyweight: bw ?? null,
    ratio: bw ? Math.round((current / bw) * 100) / 100 : null,
    avgRpe: rpes.length ? round1(rpes.reduce((a, b) => a + b, 0) / rpes.length) : null,
    sessionsPerWeek: round1(new Set(sets.map((s) => s.date)).size / spanWeeks),
    e1rmHistory: history, weeklyVolume: weeklyVolume(sets), prs: repPRs(sets), plateau: detectPlateau(history),
  };
}
module.exports = { e1rm, volume, weekStart, weeklyVolume, repPRs, detectNewPRs, e1rmHistory, detectPlateau, summary, REP_TARGETS };
