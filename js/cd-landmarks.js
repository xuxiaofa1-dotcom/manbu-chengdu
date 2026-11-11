import * as THREE from 'three/webgpu';
import { LANDMARK_SITES, LANDMARK_SIZES } from './city-config.js';
import { LANDMARKS as OLD_LANDMARKS } from './cd-landmarks-old.js';
import { LANDMARKS as NEW_LANDMARKS } from './cd-landmarks-new.js';

// Chengdu's landmarks: the procedural models of js/cd-landmarks-old.js (安顺廊桥, 望江楼, 文殊院, 宽窄巷子, 武侯祠·锦里,
// 青羊宫, 杜甫草堂, 大慈寺) and js/cd-landmarks-new.js (IFS 爬墙熊猫, 四川广播电视塔, 远洋太古里 …), each placed on its
// real OpenStreetMap footprint (city-config.js LANDMARK_SITES: centre, footprint's long axis, width × depth, height hint)
// and turned to the long axis. Each model is built in local metres with its long axis along +x.
//
// Player colliders follow each footprint's oriented box, not the model's world bounds.

const BUILDERS = { ...OLD_LANDMARKS, ...NEW_LANDMARKS };

// Builder key -> the site it stands on (city-config.js LANDMARK_SITES candidates, most specific first)
const PLACEMENT = {
  ansun_bridge: ['安顺廊桥'],
  wangjiang_tower: ['望江楼', '望江楼公园'],
  wenshu_monastery: ['文殊院'],
  kuanzhai: ['宽窄巷子'],
  wuhou_jinli: ['武侯祠', '锦里'],
  qingyang_palace: ['青羊宫'],
  dufu_cottage: ['杜甫草堂'],
  daci_temple: ['大慈寺'],
  ifs_panda: ['成都IFS'],
  tv_tower: ['四川广播电视塔', '天府熊猫塔'],
  taikooli: ['太古里'],
  tianfu_plaza: ['天府广场'],
  science_museum: ['四川科技馆'],
  chengdu_museum: ['成都博物馆'],
  jiuyan_bridge: ['九眼桥'],
  chunxi_road: ['春熙路'],
  peoples_park: ['人民公园']
};

// The footprint's oriented box: centre, long-axis direction, length & width. Taken from the real outline's minimum-area
// rectangle when there is one, else the site's w × d rectangle (axis-aligned).
function footprint(site) {
  const ring = site.ring;
  if (!ring || ring.length < 8) return { x: site.x, z: site.z, w: site.w, d: site.d, cs: 1, sn: 0 };
  const pts = [];
  for (let i = 0; i + 1 < ring.length; i += 2) pts.push([ring[i], ring[i + 1]]);
  const cx = pts.reduce((t, p) => t + p[0], 0) / pts.length;
  const cz = pts.reduce((t, p) => t + p[1], 0) / pts.length;
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[(i + 1) % pts.length];
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 0.5) continue;
    const ux = (bx - ax) / L, uz = (bz - az) / L;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, z] of pts) {
      const u = (x - cx) * ux + (z - cz) * uz;
      const v = -(x - cx) * uz + (z - cz) * ux;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) {
      best = u1 - u0 >= v1 - v0
        ? { area, ux, uz, w: u1 - u0, d: v1 - v0 }
        : { area, ux: -uz, uz: ux, w: v1 - v0, d: u1 - u0 };
    }
  }
  if (!best) return { x: site.x, z: site.z, w: site.w, d: site.d, cs: 1, sn: 0 };
  // the site's box is what the model was designed for; a whole-park OSM outline doesn't blow it up beyond 1.6x
  return { x: site.x, z: site.z, w: Math.min(best.w, site.w * 1.6), d: Math.min(best.d, site.d * 1.6), cs: best.ux, sn: best.uz };
}

// Solid buildings block the player; open landmarks (the square, the lanes, the gardens, the bridge deck) stay walkable
const SOLID = new Set(['wangjiang_tower', 'wenshu_monastery', 'qingyang_palace', 'daci_temple', 'ifs_panda', 'tv_tower',
  'chengdu_museum', 'science_museum', 'jiuyan_bridge']);

// Each model's highest point once built (name -> metres)
const landmarkTops = {};
// No lawn raised above the sidewalks (controllers.js reads one landmarks.js may lay out)
const bryantParkLawn = null;

function buildLandmarks(scene) {
  const group = new THREE.Group();
  group.name = 'Landmarks';
  const colliders = [];
  const info = [];
  let built = 0;
  for (const [key, builder] of Object.entries(BUILDERS)) {
    const names = PLACEMENT[key] || [];
    let site = null;
    let siteName = '';
    for (const n of names) {
      if (LANDMARK_SITES[n]) { site = LANDMARK_SITES[n]; siteName = n; break; }
    }
    if (!site) {
      console.warn(`[landmarks] ${key}: no footprint in LANDMARK_SITES (${names.join(', ')})`);
      continue;
    }
    const fp = footprint(site);
    const sized = LANDMARK_SIZES[siteName];
    if (sized) { fp.w = sized.w; fp.d = sized.d; }
    let out;
    try {
      out = builder.build({ THREE, site: { w: fp.w, d: fp.d, h: site.h ?? null } });
    } catch (e) {
      console.warn(`[landmarks] ${key} failed:`, e);
      continue;
    }
    const g = out.group;
    // local +x (the long axis) -> the footprint's long axis (ux, uz)
    g.rotation.y = Math.atan2(-fp.sn, fp.cs);
    g.position.set(site.x, 0.22, site.z);
    g.name = builder.label || key;
    g.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
    group.add(g);
    const top = (out.top || 10) + 0.22;
    landmarkTops[builder.label || key] = Math.round(top * 10) / 10;
    // the footprint's oriented box, as the player collides with it
    if (!SOLID.has(key)) { built++; info.push({ key, name: builder.label, site: siteName, w: fp.w, d: fp.d, top, x: site.x, z: site.z }); continue; }
    const hx = Math.max(3, fp.w / 2), hz = Math.max(3, fp.d / 2);
    const cs = Math.cos(g.rotation.y), sn = Math.sin(g.rotation.y);
    const ex = Math.abs(hx * cs) + Math.abs(hz * sn);
    const ez = Math.abs(hx * sn) + Math.abs(hz * cs);
    colliders.push({
      minX: site.x - ex, maxX: site.x + ex, minZ: site.z - ez, maxZ: site.z + ez,
      minY: 0, maxY: top, landmark: builder.label || key,
      obb: { cx: site.x, cz: site.z, hx, hz, cs, sn }
    });
    built++;
    info.push({ key, name: builder.label, site: siteName, w: fp.w, d: fp.d, top, x: site.x, z: site.z });
    console.info(`[landmarks] ${builder.label || key} on ${siteName} (${fp.w.toFixed(0)}×${fp.d.toFixed(0)} m, top ${landmarkTops[builder.label || key]} m)`);
  }
  scene.add(group);
  console.info(`[landmarks] ${built} Chengdu landmarks built`);
  // QA hook: the placed landmarks (name, footprint, top, world position)
  window.__dshLandmarks = info;
  return { group, colliders };
}

export { buildLandmarks, landmarkTops, bryantParkLawn };
