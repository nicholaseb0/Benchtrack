const test = require('node:test'), assert = require('node:assert');
const A = require('../src/lib/analytics'), { plates } = require('../src/lib/plates'), P = require('../src/lib/program');

test('e1RM formulas', () => {
  assert.equal(A.e1rm(225, 5), 253.1);              // Brzycki (default)
  assert.equal(A.e1rm(225, 5, 'epley'), 262.5);
  assert.equal(A.e1rm(300, 1), 300);
  assert.throws(() => A.e1rm(225, 0)); assert.throws(() => A.e1rm(225, 5, 'nope'));
});
test('volume and weekly grouping', () => {
  const s = [{ date: '2026-09-21', weight: 225, reps: 5 }, { date: '2026-09-23', weight: 225, reps: 5 }, { date: '2026-09-30', weight: 100, reps: 10 }];
  assert.equal(A.volume(s.slice(0, 2)), 2250);
  assert.deepEqual(A.weeklyVolume(s), [{ week: '2026-09-21', volume: 2250 }, { week: '2026-09-28', volume: 1000 }]);
});
test('rep PRs are per-variation and detect new PRs', () => {
  const hist = [{ date: '2026-09-01', variation: 'Competition Bench', weight: 220, reps: 5 }, { date: '2026-09-02', variation: 'Paused Bench', weight: 250, reps: 5 }];
  const prs = A.detectNewPRs(hist, [{ weight: 225, reps: 5 }], 'Competition Bench');
  assert.deepEqual(prs.find((p) => p.reps === 5), { reps: 5, weight: 225, previous: 220 });
  assert.equal(A.repPRs(hist)['Paused Bench'][5].weight, 250);
  assert.ok(!A.repPRs(hist)['Competition Bench'][8]);
});
test('plateau detection', () => {
  const flat = ['2026-08-05', '2026-08-20', '2026-09-01', '2026-09-15'].map((date, i) => ({ date, e1rm: 250 + (i % 2) * 2 }));
  assert.ok(A.detectPlateau(flat));
  assert.equal(A.detectPlateau(flat.map((p, i) => ({ ...p, e1rm: 230 + i * 10 }))), null);
});
test('summary ignores warmups', () => {
  const s = [{ date: '2026-09-01', variation: 'Competition Bench', weight: 135, reps: 10, is_warmup: true }, { date: '2026-09-01', variation: 'Competition Bench', weight: 225, reps: 5, bodyweight: 165 }];
  const r = A.summary(s); assert.equal(r.currentE1RM, 253.1); assert.equal(r.ratio, 1.53);
});
test('plate calculator', () => {
  assert.deepEqual(plates(275).perSide, [45, 45, 25]);
  assert.deepEqual(plates(100, { unit: 'kg' }).perSide, [25, 15]);
  assert.equal(plates(46).exact, false); assert.throws(() => plates(30));
});
test('progression: increase, repeat, then deload', () => {
  const base = { weight: 225, prescribedSets: 5, prescribedReps: 5 };
  assert.equal(P.nextSession({ ...base, completed: [5, 5, 5, 5, 5] }).nextWeight, 230);
  const f1 = P.nextSession({ ...base, completed: [5, 5, 5, 4, 3] });
  assert.deepEqual([f1.action, f1.nextWeight, f1.failStreak], ['repeat', 225, 1]);
  assert.equal(P.nextSession({ ...base, completed: [5, 5, 4], failStreak: 1 }).nextWeight, 202.5);
});
test('program builder maps weak point to emphasis', () => {
  const p = P.buildProgram({ current: 225, goal: 275, benchDays: 3, weakPoint: 'lockout', style: 'percentage' });
  assert.equal(p.weeks.length, 8); assert.ok(p.weeks[3].deload);
  assert.equal(p.weeks[0].sessions[1].lifts[0].name, 'Close-Grip Bench');
  assert.throws(() => P.buildProgram({ current: 225, goal: 200 }));
});
