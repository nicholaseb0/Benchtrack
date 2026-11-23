const DEFAULTS = { lb: { bar: 45, plates: [45, 35, 25, 10, 5, 2.5] }, kg: { bar: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25] } };
function plates(total, { unit = 'lb', bar, available } = {}) {
  const d = DEFAULTS[unit]; if (!d) throw new Error('unit must be lb or kg');
  bar ??= d.bar; available = [...(available ?? d.plates)].sort((a, b) => b - a);
  if (total < bar) throw new Error('Weight is less than the bar');
  let side = (total - bar) / 2; const perSide = [];
  for (const p of available) while (side + 1e-9 >= p) { perSide.push(p); side -= p; }
  return { unit, bar, perSide, loaded: total - 2 * Math.round(side * 1e4) / 1e4, exact: side < 1e-9 };
}
module.exports = { plates };
