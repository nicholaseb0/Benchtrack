// Rule engine: transparent, editable mappings -> generated program. Not coaching advice.
const r25 = (x, i = 2.5) => Math.round(x / i) * i;

const WEAK_POINTS = {
  off_chest: { label: 'Off the chest', why: 'Build bottom-position strength and control', variation: 'Paused Bench', accessories: ['Dumbbell Bench 3x10', 'Chest-supported Row 3x10'] },
  mid_range: { label: 'Mid-range', why: 'Train the sticking region directly', variation: 'Spoto Press', accessories: ['Incline Dumbbell Press 3x10', 'Lateral Raise 3x15'] },
  lockout: { label: 'Lockout', why: 'Emphasize triceps and the upper range of motion', variation: 'Close-Grip Bench', accessories: ['Triceps Pushdown 3x12', 'JM Press / Skullcrusher 3x10', 'Board/Pin Press 3x5'] },
  stability: { label: 'Stability / control', why: 'Practice bar path and tempo', variation: 'Tempo Bench (3s down)', accessories: ['Single-arm Dumbbell Press 3x8', 'Face Pull 3x15'] },
  poor_pause: { label: 'Poor pause', why: 'More paused work so the bottom position is reliable', variation: 'Paused Bench', accessories: ['Paused Bench (2s) 3x5', 'Upper-back Row 3x10'] },
  plateau: { label: 'General plateau', why: 'Shift volume/intensity to disrupt stagnation', variation: 'Touch-and-Go Bench', accessories: ['Close-Grip Bench 3x8', 'Triceps Pushdown 3x12'] },
  fatigue: { label: 'Fatigue / recovery', why: 'Reduce training stress', variation: 'Touch-and-Go Bench', accessories: ['Light Triceps 2x12'], volumeScale: 0.7 },
  none: { label: 'No specific weakness', why: 'Balanced bench emphasis', variation: 'Touch-and-Go Bench', accessories: ['Triceps Pushdown 3x12', 'Row 3x10'] },
};
const STYLES = {
  percentage: [{ p: 0.75, s: 4, r: 5 }, { p: 0.8, s: 4, r: 4 }, { p: 0.85, s: 3, r: 3 }, { p: 0.65, s: 3, r: 5, deload: true }],
  rpe: [{ s: 4, r: 5, rpe: 7 }, { s: 4, r: 5, rpe: 7.5 }, { s: 4, r: 4, rpe: 8 }, { s: 3, r: 5, rpe: 6, deload: true }],
};

function buildProgram({ current, goal, benchDays = 3, experience = 'intermediate', weakPoint = 'none', style = 'simple', weeks = 8 }) {
  if (!(current > 0) || !(goal > current)) throw new Error('Goal must be higher than current bench');
  if (!STYLES[style] && style !== 'simple') throw new Error('Unknown style');
  const wp = WEAK_POINTS[weakPoint]; if (!wp) throw new Error('Unknown weak point');
  const days = Math.min(4, Math.max(2, benchDays));
  const inc = { beginner: 5, intermediate: 2.5, advanced: 2.5 }[experience] ?? 2.5;
  const scale = wp.volumeScale ?? 1, tm = current * 0.9; // training max
  const out = [];
  for (let w = 1; w <= weeks; w++) {
    let main, deload = false;
    if (style === 'simple') {
      main = { name: 'Competition Bench', sets: Math.max(2, Math.round(5 * scale)), reps: 5, weight: r25(tm * 0.8 + inc * (w - 1)) };
    } else {
      const c = STYLES[style][(w - 1) % 4]; deload = !!c.deload;
      const drift = 1 + 0.025 * Math.floor((w - 1) / 4);
      main = { name: 'Competition Bench', sets: Math.max(2, Math.round(c.s * scale)), reps: c.r, ...(c.p ? { weight: r25(tm * c.p * drift) } : { rpe: c.rpe }) };
    }
    const sessions = [{ day: 1, name: 'Main Bench', lifts: [main] },
      { day: 2, name: `Weak point: ${wp.label}`, lifts: [{ name: wp.variation, sets: 3, reps: 6, weight: r25(tm * 0.7) }], accessories: wp.accessories }];
    if (days >= 3) sessions.push({ day: 3, name: 'Volume', lifts: [{ name: 'Touch-and-Go Bench', sets: 3, reps: 10, weight: r25(tm * 0.6) }], accessories: ['Triceps Pushdown 3x12'] });
    if (days >= 4) sessions.push({ day: 4, name: 'Incline / Hypertrophy', lifts: [{ name: 'Incline Bench', sets: 3, reps: 8, weight: r25(tm * 0.55) }], accessories: ['Row 3x10'] });
    out.push({ week: w, deload, sessions });
  }
  return { weakPoint: { key: weakPoint, ...wp }, trainingMax: r25(tm), goal, weeks: out };
}

// Progression: repeat after 1st failure, deload 10% on 2nd consecutive failure.
function nextSession({ weight, prescribedSets, prescribedReps, completed, failStreak = 0, increment = 5 }) {
  const hit = completed.length >= prescribedSets && completed.slice(0, prescribedSets).every((r) => r >= prescribedReps);
  if (hit) return { nextWeight: weight + increment, failStreak: 0, action: 'increase' };
  if (failStreak + 1 >= 2) return { nextWeight: r25(weight * 0.9), failStreak: 0, action: 'deload' };
  return { nextWeight: weight, failStreak: failStreak + 1, action: 'repeat' };
}
module.exports = { buildProgram, nextSession, WEAK_POINTS };
