// Pedestrian footfall (how many people are out, per street metre) for Chengdu: a synthetic density model that peaks in
// the old town & the 春熙路 commercial core and fades towards the edges of the detailed city. The engine uses it to seed
// the pedestrians on the pavements; real municipal footfall counts would plug in here.
// Hours by lighting preset (js/lighting.js): how late the city stays out.
export const FOOTFALL_HOURS = { golden: 17, midday: 12, twilight: 19, midnight: 1 };

let timePreset = 'golden';
let version = 1;
// Hotspots (春熙路, 太古里, 天府广场, 宽窄巷子, 锦里, 九眼桥, 文殊院, 建设路) — [x, z, radius, weight]
const HOTSPOTS = [
  [1370, 60, 320, 2.4], [1620, 250, 300, 2.0], [0, 0, 320, 1.8], [-780, -1320, 260, 1.6],
  [-2180, 1250, 240, 1.4], [1620, 1850, 260, 1.5], [560, -1850, 260, 1.2], [0, -700, 0, 0]
];
// Late-night survival: the bar streets keep their people, the rest of the city goes home
const NIGHT = { golden: 1, midday: 1, twilight: 0.9, midnight: 0.45 };

export function footfallAt(x, z) {
  const d2 = (x * x + z * z) / 900000; // ~1 at 950 m from 天府广场
  let f = 1.35 / (1 + d2 * 1.6);
  for (const [hx, hz, r, w] of HOTSPOTS) {
    const dx = x - hx, dz = z - hz;
    const dd = (dx * dx + dz * dz) / (r * r);
    if (dd < 4) f += w / (1 + dd * 2.2);
  }
  if (z > 1600 || Math.abs(x) > 3400) f *= 0.55; // the quiet new districts
  if (Math.abs(x) < 500 && Math.abs(z) < 500) f *= 1.15; // the 天府广场 core
  return f * (NIGHT[timePreset] ?? 1);
}

export function setFootfallTime(preset) {
  if (preset && preset !== timePreset) {
    timePreset = preset;
    version++;
  }
}
export function footfallTime() {
  return timePreset;
}
export function footfallVersion() {
  return version;
}
export function decodeFootfall() {
  return null;
}
