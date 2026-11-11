// Chengdu's modern / contemporary landmarks for 漫步成都 — procedural three.js models.
//
// Every model is built in LOCAL metres: footprint centred on (0,0), the long side along +x, the short
// side along +z, ground at y = 0. The engine places/rotates the group on the real OSM footprint.
// `build({ THREE, site })` returns { group, top }. Only three/webgpu and BufferGeometryUtils are
// imported: the module is standalone and never touches engine code.
//
// Design references (external research only): 成都IFS two 248 m glass towers over an 8-storey mall,
// the 13 m "I am Here" panda at the mall's 7th-floor corner; 四川广播电视塔 339 m with the upper
// pod at 204–218 m and a disc-like lower pavilion below 12.5 m; 太古里's 2–3 storey grey-brick
// 川西 blocks with dark pitched roofs; 天府广场's 88,368 m² sun-bird roundel; 成都博物馆's 20,000 m²
// woven brass skin; 四川科技馆's 132 m × 107.5 m five-storey colonnade; 九眼桥's nine stone arches.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const FONT_CJK = "'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif";
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const r2 = (n) => Math.round(n * 100) / 100;

// Small deterministic PRNG so every rebuild/screenshot is identical.
function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TEX_CACHE = new Map();

// ---------------------------------------------------------------------------------------------
// Canvas textures only (no external images). CJK-safe font stack.
// ---------------------------------------------------------------------------------------------
function canvasTex(key, w, h, draw, repeat = false) {
  if (TEX_CACHE.has(key)) return TEX_CACHE.get(key);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d');
  draw(c, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.anisotropy = 8;
  t.needsUpdate = true;
  TEX_CACHE.set(key, t);
  return t;
}

// Stone paving shared by 太古里 / 春熙路 / 天府广场.
function pavingTex(key, base = '#8f8c84', line = 'rgba(58,55,50,.30)', tile = 64, bands = false) {
  return canvasTex(key, 1024, 1024, (c, W, H) => {
    c.fillStyle = base;
    c.fillRect(0, 0, W, H);
    const r = rng(71);
    for (let y = 0; y < H; y += tile) {
      for (let x = 0; x < W; x += tile) {
        const v = (r() - 0.5) * 18;
        c.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 250 : 0},${v > 0 ? 240 : 0},${Math.abs(v) / 260})`;
        c.fillRect(x, y, tile, tile);
        c.strokeStyle = line;
        c.lineWidth = 2;
        c.strokeRect(x + 0.5, y + 0.5, tile, tile);
        if (r() > 0.7) {
          c.strokeStyle = 'rgba(45,42,38,.12)';
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(x + 6, y + 6 + r() * tile);
          c.lineTo(x + tile - 6, y + 6 + r() * tile);
          c.stroke();
        }
      }
    }
    if (bands) {
      for (let y = 0; y < H; y += tile * 4) {
        c.fillStyle = 'rgba(40,38,34,.18)';
        c.fillRect(0, y, W, 5);
      }
    }
  }, true);
}

// The 太阳神鸟 roundel: four stylised swallows wheeling around a twelve-ray sun, in gold on
// dark granite. Generic, original drawing of the motif (no logo, no flag).
function sunBirdTex() {
  return canvasTex('sunbird', 1024, 1024, (c, W, H) => {
    const cx = W / 2, cy = H / 2;
    const g = c.createRadialGradient(cx, cy, 30, cx, cy, W / 2);
    g.addColorStop(0, '#3c3730');
    g.addColorStop(0.62, '#2d2a25');
    g.addColorStop(1, '#1e1c19');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    // concentric stone rings
    c.strokeStyle = 'rgba(188,151,82,.34)';
    for (const rr of [0.485, 0.462, 0.435, 0.205, 0.192]) {
      c.lineWidth = rr > 0.4 ? 5 : 3;
      c.beginPath();
      c.arc(cx, cy, rr * W, 0, TAU);
      c.stroke();
    }

    // twelve-ray sun in the middle
    const gold = c.createRadialGradient(cx, cy - 30, 8, cx, cy, 190);
    gold.addColorStop(0, '#f6dd94');
    gold.addColorStop(0.55, '#e0b75e');
    gold.addColorStop(1, '#a97c30');
    c.save();
    c.translate(cx, cy);
    c.fillStyle = gold;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      c.save();
      c.rotate(a);
      c.beginPath();
      c.moveTo(0, -48);
      c.lineTo(23, -188);
      c.lineTo(-23, -188);
      c.closePath();
      c.fill();
      // a second, shorter flame between the long rays
      c.rotate(TAU / 24);
      c.beginPath();
      c.moveTo(0, -54);
      c.lineTo(10, -112);
      c.lineTo(-10, -112);
      c.closePath();
      c.fill();
      c.restore();
    }
    c.beginPath();
    c.arc(0, 0, 98, 0, TAU);
    c.fillStyle = gold;
    c.fill();
    c.beginPath();
    c.arc(0, 0, 61, 0, TAU);
    c.fillStyle = 'rgba(52,44,32,.78)';
    c.fill();
    c.beginPath();
    c.arc(0, 0, 28, 0, TAU);
    c.fillStyle = gold;
    c.fill();
    c.restore();

    // four swallows, heads to the left, long ribbon tails
    const drawBird = (s) => {
      c.save();
      c.scale(s, s);
      c.fillStyle = gold;
      c.beginPath();
      c.moveTo(-260, 6);
      c.bezierCurveTo(-210, 58, -150, 66, -96, 32);
      c.bezierCurveTo(-64, 14, -40, -6, -18, -30);
      c.bezierCurveTo(-56, -34, -92, -26, -118, -8);
      c.bezierCurveTo(-136, 4, -156, 14, -178, 16);
      c.bezierCurveTo(-206, 18, -232, 12, -260, 6);
      c.closePath();
      c.fill();
      // head + beak
      c.beginPath();
      c.arc(-14, -32, 20, 0, TAU);
      c.fill();
      c.beginPath();
      c.moveTo(-34, -36);
      c.lineTo(-60, -30);
      c.lineTo(-34, -24);
      c.closePath();
      c.fill();
      // wing sweep
      c.beginPath();
      c.moveTo(-150, 3);
      c.bezierCurveTo(-120, -44, -76, -64, -32, -58);
      c.bezierCurveTo(-82, -30, -112, -4, -150, 3);
      c.fill();
      // tail ribbon
      c.beginPath();
      c.moveTo(-250, 8);
      c.bezierCurveTo(-214, 44, -170, 50, -128, 24);
      c.bezierCurveTo(-168, 30, -206, 20, -250, 8);
      c.fill();
      c.restore();
    };
    const ringR = W * 0.315;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU - 0.18;
      c.save();
      c.translate(cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR);
      c.rotate(a + Math.PI / 2);
      drawBird(W / 1024 * 1.02);
      c.restore();
    }
    // fine stone grain
    const r = rng(93);
    for (let i = 0; i < 1400; i++) {
      c.fillStyle = `rgba(205,185,150,${r() * 0.045})`;
      c.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3);
    }
  });
}

// A lit shop / neon sign in CJK. Vertical text is the default (Chinese street signs).
function signMaterial(T, text, opt = {}) {
  const w = opt.px || 256;
  const h = opt.py || 1024;
  const bg = opt.bg === undefined ? '#17130f' : opt.bg;
  const fg = opt.fg || '#f2d49a';
  const neon = !!opt.neon;
  const key = `sign:${text}:${w}:${h}:${bg}:${fg}:${neon}:${opt.vertical !== false}:${opt.border || ''}:${opt.fontWeight || 700}`;
  const tex = canvasTex(key, w, h, (c, W, H) => {
    if (bg !== 'transparent') {
      c.fillStyle = bg;
      c.fillRect(0, 0, W, H);
      const grd = c.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, 'rgba(255,255,255,.10)');
      grd.addColorStop(0.5, 'rgba(255,255,255,0)');
      grd.addColorStop(1, 'rgba(0,0,0,.18)');
      c.fillStyle = grd;
      c.fillRect(0, 0, W, H);
    }
    c.strokeStyle = opt.border || 'rgba(214,174,108,.55)';
    c.lineWidth = Math.max(4, W * 0.022);
    if (opt.border !== 'none') c.strokeRect(c.lineWidth, c.lineWidth, W - 2 * c.lineWidth, H - 2 * c.lineWidth);
    c.fillStyle = fg;
    c.shadowColor = neon ? fg : 'rgba(0,0,0,.45)';
    c.shadowBlur = neon ? Math.max(12, W * 0.14) : W * 0.035;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const chars = Array.from(text);
    const vertical = opt.vertical !== false;
    if (vertical) {
      const fs = Math.min(W * 0.66, (H * 0.82) / (chars.length + 0.9));
      c.font = `${opt.fontWeight || 700} ${fs}px ${FONT_CJK}`;
      const step = Math.min(fs * 1.16, (H * 0.84) / Math.max(1, chars.length));
      const y0 = H / 2 - (step * (chars.length - 1)) / 2;
      chars.forEach((ch, i) => c.fillText(ch, W / 2, y0 + i * step));
    } else {
      const fs = Math.min(H * 0.62, (W * 0.84) / Math.max(1, chars.length));
      c.font = `${opt.fontWeight || 800} ${fs}px ${FONT_CJK}`;
      c.fillText(text, W / 2, H * 0.53);
    }
    // a small decorative rule
    if (opt.rule) {
      c.shadowBlur = 0;
      c.fillStyle = opt.rule;
      if (vertical) c.fillRect(W / 2 - W * 0.18, H * 0.925, W * 0.36, Math.max(3, H * 0.006));
      else c.fillRect(W * 0.1, H * 0.86, W * 0.8, Math.max(3, H * 0.02));
    }
  });
  const m = new T.MeshStandardNodeMaterial({
    map: tex,
    roughness: 0.52,
    metalness: 0.08,
    side: T.DoubleSide,
    transparent: bg === 'transparent' || neon,
    alphaTest: bg === 'transparent' || neon ? 0.04 : 0,
    emissive: new T.Color(neon ? 0xffffff : 0xc9a76a),
    emissiveMap: tex,
    emissiveIntensity: neon ? (opt.emissive || 1.55) : (opt.emissive || 0.22),
  });
  return m;
}

// ---------------------------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------------------------
// Subtle sky-reflection gradient for glass curtains (canvas only).
function glassTexture(name, top, bottom, mullionLines = true) {
  return canvasTex(name, 256, 512, (c, W, H) => {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top);
    g.addColorStop(0.45, top);
    g.addColorStop(1, bottom);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // soft reflected-cloud streaks
    c.globalAlpha = 0.12;
    c.fillStyle = '#eaf3f2';
    c.beginPath();
    c.ellipse(W * 0.28, H * 0.16, W * 0.45, H * 0.05, -0.25, 0, TAU);
    c.fill();
    c.beginPath();
    c.ellipse(W * 0.7, H * 0.3, W * 0.35, H * 0.035, -0.18, 0, TAU);
    c.fill();
    c.globalAlpha = 1;
    // fine vertical mullion slots / facade streaks
    c.strokeStyle = 'rgba(20,40,48,.18)';
    c.lineWidth = 1;
    for (let x = 8; x < W; x += 32) {
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke();
    }
    if (mullionLines) {
      c.strokeStyle = 'rgba(218,231,232,.20)';
      c.lineWidth = 2;
      for (let y = 0; y < H; y += 32) {
        c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
      }
    }
    c.fillStyle = 'rgba(255,255,255,.05)';
    for (let i = 0; i < 90; i++) c.fillRect(Math.random() * W, Math.random() * H, 1, 2 + Math.random() * 12);
  });
}

const PAL = {
  // glass / steel of the IFS towers
  glass: [0x5f8fa3, 0.13, 0.55],
  glassDeep: [0x34525f, 0.1, 0.62],
  glassTeal: [0x4f7f83, 0.14, 0.45],
  mullion: [0x9aa6aa, 0.32, 0.82],
  steel: [0xc2c9cc, 0.28, 0.9],
  darkSteel: [0x4a5054, 0.42, 0.7],
  stone: [0xb9b0a0, 0.86, 0.02],
  stoneLight: [0xd5cdbc, 0.82, 0.02],
  stoneDark: [0x8e877b, 0.9, 0.02],
  warmStone: [0xd6c6a6, 0.84, 0.03],
  beige: [0xcabd9f, 0.86, 0.02],
  concrete: [0xbfc0ba, 0.9, 0.02],
  white: [0xf1efe8, 0.72, 0.03],
  roofSlate: [0x4a5157, 0.82, 0.06],
  roofSlateDark: [0x353b40, 0.86, 0.05],
  brick: [0x8b8b84, 0.93, 0.01],
  brickWarm: [0x9b9284, 0.93, 0.01],
  brickDark: [0x6e6f6a, 0.94, 0.01],
  wood: [0x6e4c31, 0.82, 0.02],
  woodDark: [0x41301f, 0.86, 0.02],
  bronze: [0x9a6d38, 0.36, 0.66],
  gold: [0xc6a052, 0.3, 0.72],
  copper: [0xa66b3f, 0.4, 0.55],
  black: [0x1e1e20, 0.55, 0.3],
  pandaWhite: [0xf5f1e7, 0.34, 0.02],
  pandaBlack: [0x17171a, 0.45, 0.04],
  pandaGlass: [0x0b0b0c, 0.18, 0.1],
  leafA: [0x4f6d39, 0.9, 0.0],
  leafB: [0x637a43, 0.9, 0.0],
  leafC: [0x3f5a30, 0.92, 0.0],
  trunk: [0x5d4832, 0.94, 0.0],
  hedge: [0x526a3b, 0.95, 0.0],
  water: [0x3b5a60, 0.12, 0.3],
  waterBright: [0x628c90, 0.16, 0.25],
  stoneWall: [0x8b857a, 0.92, 0.02],
  bronzeDark: [0x5f492c, 0.5, 0.5],
  redPaint: [0xa6362c, 0.62, 0.1],
  redGlow: [0xd9422c, 0.5, 0.1],
  amber: [0xcf9d55, 0.5, 0.2],
  asphalt: [0x4d4c48, 0.96, 0.02],
  flagA: [0xc93f2c, 0.76, 0.02],
  flagB: [0x2c6388, 0.76, 0.02],
  flagC: [0xd2a23c, 0.76, 0.02],
  flagD: [0x4f7d47, 0.76, 0.02],
  waterJet: [0xcfe9ef, 0.08, 0.05],
};

function materialFactory(T) {
  const cache = new Map();
  return (key) => {
    if (cache.has(key)) return cache.get(key);
    let m;
    if (key === 'lantern') {
      m = new T.MeshStandardNodeMaterial({ color: 0xb5301f, roughness: 0.5, metalness: 0.02, emissive: 0x8c1c10, emissiveIntensity: 0.65 });
    } else if (key === 'lit') {
      m = new T.MeshStandardNodeMaterial({ color: 0xf0d5a4, roughness: 0.55, metalness: 0.04, emissive: 0xffc27a, emissiveIntensity: 0.9 });
    } else if (key === 'litWarm') {
      m = new T.MeshStandardNodeMaterial({ color: 0xffc07a, roughness: 0.5, metalness: 0.03, emissive: 0xff8f3a, emissiveIntensity: 1.25 });
    } else if (key === 'lattice') {
      m = new T.MeshStandardNodeMaterial({ color: 0xd8b066, roughness: 0.3, metalness: 0.66, emissive: 0x3a2407, emissiveIntensity: 0.5 });
    } else if (key === 'litCool') {
      m = new T.MeshStandardNodeMaterial({ color: 0xd8e8ec, roughness: 0.4, metalness: 0.02, emissive: 0xa9d4e0, emissiveIntensity: 0.65 });
    } else if (key === 'waterJet') {
      m = new T.MeshStandardNodeMaterial({ color: 0xdff3f6, roughness: 0.08, metalness: 0.05, transparent: true, opacity: 0.55, emissive: 0xdff7ff, emissiveIntensity: 0.45, depthWrite: false });
    } else if (key === 'water') {
      m = new T.MeshStandardNodeMaterial({ color: PAL.water[0], roughness: PAL.water[1], metalness: PAL.water[2], transparent: true, opacity: 0.94 });
    } else if (key === 'neonRed') {
      m = new T.MeshStandardNodeMaterial({ color: 0xff4a3a, roughness: 0.4, metalness: 0.1, emissive: 0xff2a1c, emissiveIntensity: 1.8 });
    } else if (key === 'aviation') {
      m = new T.MeshStandardNodeMaterial({ color: 0xff2b1c, roughness: 0.4, metalness: 0.1, emissive: 0xff1a0a, emissiveIntensity: 2.2 });
    } else if (key === 'glass') {
      m = new T.MeshStandardNodeMaterial({ map: glassTexture('glassA', '#b8cfd8', '#54727e'), color: 0xffffff, roughness: 0.16, metalness: 0.34 });
    } else if (key === 'glassDeep') {
      m = new T.MeshStandardNodeMaterial({ map: glassTexture('glassB', '#9dbcc7', '#2f4c58'), color: 0xffffff, roughness: 0.14, metalness: 0.4 });
    } else if (key === 'glassTeal') {
      m = new T.MeshStandardNodeMaterial({ map: glassTexture('glassC', '#a7c6c4', '#2b565c'), color: 0xffffff, roughness: 0.16, metalness: 0.32 });
    } else if (key === 'glassPodium') {
      m = new T.MeshStandardNodeMaterial({ map: glassTexture('glassP', '#adc5cc', '#476671'), color: 0xffffff, roughness: 0.2, metalness: 0.28 });
    } else if (key === 'brassWall') {
      m = new T.MeshStandardNodeMaterial({ color: 0x6f5230, roughness: 0.54, metalness: 0.44, emissive: 0x160e05, emissiveIntensity: 0.24 });
    } else {
      const p = PAL[key] || [0xff00ff, 0.8, 0.0];
      m = new T.MeshStandardNodeMaterial({ color: p[0], roughness: p[1], metalness: p[2] });
    }
    cache.set(key, m);
    return m;
  };
}

// ---------------------------------------------------------------------------------------------
// Kit: accumulates geometry per material, merges at the end, collects instanced repeats.
// All "y" arguments below are CENTRES (as in three) unless the name says y0/base.
// ---------------------------------------------------------------------------------------------
class Kit {
  constructor(T) {
    this.T = T;
    this.parts = new Map();
    this.shapes = new Map();
    this.meshExtras = [];
    this.group = new T.Group();
    this.mat = materialFactory(T);
    this.xf = new T.Matrix4();
    this.stack = [];
  }

  _norm(geo) {
    let g = geo;
    if (g.index) g = g.toNonIndexed();
    if (!g.getAttribute('position')) return null;
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    if (!g.getAttribute('uv')) {
      const n = g.getAttribute('position').count;
      g.setAttribute('uv', new this.T.Float32BufferAttribute(new Float32Array(n * 2), 2));
    }
    g.clearGroups();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    return g;
  }

  _matrix(x, y, z, rx, ry, rz) {
    return new this.T.Matrix4().compose(
      new this.T.Vector3(x, y, z),
      new this.T.Quaternion().setFromEuler(new this.T.Euler(rx, ry, rz, 'XYZ')),
      new this.T.Vector3(1, 1, 1),
    );
  }

  push(x = 0, y = 0, z = 0, ry = 0, s = 1) {
    this.stack.push(this.xf.clone());
    this.xf.multiply(new this.T.Matrix4().compose(
      new this.T.Vector3(x, y, z),
      new this.T.Quaternion().setFromEuler(new this.T.Euler(0, ry, 0)),
      new this.T.Vector3(s, s, s),
    ));
    return this;
  }

  pop() {
    this.xf = this.stack.pop() || new this.T.Matrix4();
    return this;
  }

  add(geo, key, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const g = this._norm(geo);
    if (!g) return;
    const local = new this.T.Matrix4().compose(
      new this.T.Vector3(x, y, z),
      new this.T.Quaternion().setFromEuler(new this.T.Euler(rx, ry, rz, 'XYZ')),
      new this.T.Vector3(sx, sy, sz),
    );
    g.applyMatrix4(this.xf.clone().multiply(local));
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(g);
  }

  box(w, h, d, x, y, z, key, ry = 0, rx = 0, rz = 0) {
    this.add(new this.T.BoxGeometry(w, h, d), key, x, y, z, rx, ry, rz);
  }

  // bottom-anchored box
  boxB(w, h, d, x, y0, z, key, ry = 0) {
    this.box(w, h, d, x, y0 + h / 2, z, key, ry);
  }

  cyl(rt, rb, h, seg, x, y, z, key, rx = 0, ry = 0, rz = 0) {
    this.add(new this.T.CylinderGeometry(rt, rb, h, seg), key, x, y, z, rx, ry, rz);
  }

  cylB(rt, rb, h, seg, x, y0, z, key, ry = 0) {
    this.cyl(rt, rb, h, seg, x, y0 + h / 2, z, key, 0, ry, 0);
  }

  sphere(r, x, y, z, key, sx = 1, sy = 1, sz = 1, seg = 18, ry = 0) {
    this.add(new this.T.SphereGeometry(r, seg, Math.max(8, Math.round(seg * 0.6))), key, x, y, z, 0, ry, 0, sx, sy, sz);
  }

  capsule(r, len, x, y, z, key, rx = 0, ry = 0, rz = 0, seg = 12) {
    this.add(new this.T.CapsuleGeometry(r, Math.max(0.02, len), 4, seg), key, x, y, z, rx, ry, rz);
  }

  // a cheap round rod between two points (8 tris) for cables / thin ties
  rod(a, b, r, key, seg = 4) {
    const T = this.T;
    const va = new T.Vector3(a[0], a[1], a[2]);
    const vb = new T.Vector3(b[0], b[1], b[2]);
    const dir = new T.Vector3().subVectors(vb, va);
    const len = dir.length();
    if (len < 1e-4) return;
    const mid = new T.Vector3().addVectors(va, vb).multiplyScalar(0.5);
    const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dir.clone().normalize());
    const g = new T.CylinderGeometry(r, r, len, seg, 1, true);
    const local = new T.Matrix4().compose(mid, q, new T.Vector3(1, 1, 1));
    g.applyMatrix4(this.xf.clone().multiply(local));
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(this._norm(g));
  }

  // a tapered limb / diagonal strut from a to b
  bone(a, b, r, key, seg = 10) {
    const T = this.T;
    const va = new T.Vector3(a[0], a[1], a[2]);
    const vb = new T.Vector3(b[0], b[1], b[2]);
    const dir = new T.Vector3().subVectors(vb, va);
    const len = dir.length();
    if (len < 1e-4) return;
    const mid = new T.Vector3().addVectors(va, vb).multiplyScalar(0.5);
    const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dir.clone().normalize());
    const g = new T.CapsuleGeometry(r, Math.max(0.02, len - 2 * r), 4, seg);
    const local = new T.Matrix4().compose(mid, q, new T.Vector3(1, 1, 1));
    g.applyMatrix4(this.xf.clone().multiply(local));
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(this._norm(g));
  }

  lathe(points, x, y, z, key, seg = 32) {
    const pts = points.map((p) => new this.T.Vector2(p[0], p[1]));
    this.add(new this.T.LatheGeometry(pts, seg), key, x, y, z);
  }

  torus(R, r, x, y, z, key, rx = Math.PI / 2, ry = 0, rz = 0, seg = 24, tube = 8) {
    this.add(new this.T.TorusGeometry(R, r, tube, seg), key, x, y, z, rx, ry, rz);
  }

  plane(w, h, x, y, z, key, rx = 0, ry = 0, rz = 0) {
    this.add(new this.T.PlaneGeometry(w, h), key, x, y, z, rx, ry, rz);
  }

  floor(w, h, x, y, z, key, ry = 0) {
    this.plane(w, h, x, y, z, key, -Math.PI / 2, ry, 0);
  }

  disc(r, x, y, z, key, seg = 64) {
    this.plane(r * 2, r * 2, x, y, z, key, -Math.PI / 2, 0, 0);
  }

  tri(base, rise, x, y, z, key, ry = 0) {
    const s = new this.T.Shape();
    s.moveTo(-base / 2, 0);
    s.lineTo(base / 2, 0);
    s.lineTo(0, rise);
    s.closePath();
    this.add(new this.T.ShapeGeometry(s), key, x, y, z, 0, ry, 0);
  }

  // a flat, textured quad with its own material (signs, roundels, water)
  quad(w, h, x, y, z, material, rx = 0, ry = 0, rz = 0) {
    const g = new this.T.PlaneGeometry(w, h);
    const m = this._matrix(x, y, z, rx, ry, rz);
    g.applyMatrix4(m);
    const mesh = new this.T.Mesh(g, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.meshExtras.push(mesh);
    return mesh;
  }

  mesh(geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const g = geo;
    g.applyMatrix4(this._matrix(x, y, z, rx, ry, rz));
    const mesh = new this.T.Mesh(g, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.meshExtras.push(mesh);
    return mesh;
  }

  instAdd(name, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
    if (!this.shapes.has(name)) this.shapes.set(name, []);
    this.shapes.get(name).push(this._matrix(x, y, z, rx, ry, rz).scale(new this.T.Vector3(sx, sy, sz)));
  }

  instGeo(name, geo, key) {
    if (this.shapes.has(name)) return;
    this.shapes.set(name, []);
    this.parts.set(`__inst:${name}`, { geo: this._norm(geo), key, list: this.shapes.get(name) });
  }

  finish() {
    const T = this.T;
    let tris = 0;
    for (const [key, list] of this.parts) {
      if (key.startsWith('__inst:')) continue;
      if (!list.length) continue;
      const geo = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (!geo) {
        console.warn(`[cd-landmarks-new] merge failed for "${key}" (${list.length})`);
        continue;
      }
      const mesh = new T.Mesh(geo, this.mat(key));
      mesh.name = key;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      tris += geo.getAttribute('position').count / 3;
    }
    for (const [key, def] of this.parts) {
      if (!key.startsWith('__inst:')) continue;
      const { geo, key: matKey, list } = def;
      if (!list.length) continue;
      const mesh = new T.InstancedMesh(geo, this.mat(matKey), list.length);
      list.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.name = key.slice(7);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      tris += (geo.getAttribute('position').count / 3) * list.length;
    }
    for (const m of this.meshExtras) this.group.add(m);
    this.group.userData.triangles = Math.round(tris);
    return this.group;
  }
}

// Fit the nominal model to the OSM footprint (gentle, clamped) and report its true height.
function finishLM(kit, site, nomW, nomD, nomTop) {
  const g = kit.finish();
  const sw = Number(site && site.w) > 0 ? site.w : nomW;
  const sd = Number(site && site.d) > 0 ? site.d : nomD;
  const sx = clamp(sw / nomW, 0.62, 1.45);
  const sz = clamp(sd / nomD, 0.62, 1.45);
  const sy = site && Number(site.h) > 0 ? clamp(site.h / nomTop, 0.86, 1.12) : 1;
  g.scale.set(sx, sy, sz);
  g.updateMatrixWorld(true);
  let top = nomTop * sy;
  try {
    const bb = new THREE.Box3().setFromObject(g);
    if (Number.isFinite(bb.max.y)) top = Math.max(top, bb.max.y);
  } catch { /* merged geometry can defeat Box3; nominal top is authoritative */ }
  return { group: g, top: r2(top) };
}

// ---------------------------------------------------------------------------------------------
// Shared props
// ---------------------------------------------------------------------------------------------
function trees(kit, spots, scale = 1) {
  if (!kit.parts.has('__inst:trunk')) {
    kit.instGeo('trunk', new kit.T.CylinderGeometry(0.22, 0.34, 4.2, 7), 'trunk');
    kit.instGeo('canopyA', new kit.T.IcosahedronGeometry(2.12, 0), 'leafA');
    kit.instGeo('canopyB', new kit.T.IcosahedronGeometry(1.45, 0), 'leafB');
  }
  for (const s of spots) {
    const [x, z, k = 1, vary = 0.5] = s;
    const sc = k * scale;
    kit.instAdd('trunk', x, 1.9 * sc, z, 0, sc, sc, sc);
    kit.instAdd('canopyA', x, 5.0 * sc, z, vary * 3.0, 1.0 * sc, 0.92 * sc, 1.0 * sc);
    kit.instAdd('canopyB', x + 1.4 * sc, 4.0 * sc, z - 0.6 * sc, vary * 2.0, 0.9 * sc, 0.85 * sc, 0.9 * sc);
  }
}

function lanternString(kit, a, b, n, sag = 0.9, r = 0.32) {
  const T = kit.T;
  // cable as short segments following a sagging parabola
  const segs = 3;
  let prev = null;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = new T.Vector3(lerp(a[0], b[0], t), lerp(a[1], b[1], t) - Math.sin(t * Math.PI) * sag, lerp(a[2], b[2], t));
    if (prev) kit.rod([prev.x, prev.y, prev.z], [p.x, p.y, p.z], 0.025, 'darkSteel', 4);
    prev = p;
  }
  if (!kit.parts.has('__inst:lantern')) kit.instGeo('lantern', new kit.T.IcosahedronGeometry(1, 0), 'lantern');
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = lerp(a[0], b[0], t);
    const y = lerp(a[1], b[1], t) - Math.sin(t * Math.PI) * sag - 0.55;
    const z = lerp(a[2], b[2], t);
    kit.rod([x, y + 0.5, z], [x, y + 0.12, z], 0.018, 'darkSteel', 4);
    kit.instAdd('lantern', x, y, z, 0, r, r * 0.9, r);
  }
}

function litWindows(kit, xs, ys, z, facing = 1, w = 1.4, h = 1.2) {
  for (const x of xs) for (const y of ys) {
    kit.box(w, h, 0.08, x, y, z + 0.05 * facing, 'lit');
  }
}

// =============================================================================================
// 1 · 成都IFS · 爬墙熊猫
// Two glass towers (230 m + 180 m) on an 8-storey retail podium, giant panda over the corner.
// Nominal footprint 250 × 150 m.
// =============================================================================================
function buildIFS({ THREE: T, site }) {
  const kit = new Kit(T);
  const W = 250;
  const D = 150;
  const MAIN_H = 230;
  const SECOND_H = 180;
  const PODIUM_H = 36.4;
  const PW = 236;           // podium length
  const PD = 108;           // podium depth
  const FRONT = PD / 2;     // +z front edge

  if (!kit.parts.has('__inst:mullion')) kit.instGeo('mullion', new T.BoxGeometry(1, 1, 1), 'mullion');
  // ---- ground apron, stone base and the long glazed retail podium
  kit.boxB(PW + 12, 0.32, PD + 22, 0, 0, 0, 'stoneLight');
  kit.boxB(PW + 4, 1.1, PD + 4, 0, 0.32, 0, 'stoneDark');
  kit.boxB(PW, 6.0, PD, 0, 1.1, 0, 'stone');
  kit.boxB(PW - 1.6, PODIUM_H - 7.1, PD - 1.6, 0, 7.1, 0, 'glassPodium');
  // tall stone piers at 12 m rhythm on both long faces (the mall's heavy vertical beat)
  for (let x = -PW / 2 + 6; x <= PW / 2 - 6; x += 12) {
    kit.boxB(1.5, PODIUM_H - 1.1, 1.35, x, 1.1, FRONT - 0.58, 'stoneLight');
    kit.boxB(1.5, PODIUM_H - 1.1, 1.35, x, 1.1, -FRONT + 0.58, 'stoneLight');
  }
  for (const x of [-PW / 2 + 0.9, PW / 2 - 0.9]) {
    kit.boxB(1.8, PODIUM_H - 1.1, PD, x, 1.1, 0, 'stoneLight');
  }
  // short-end glazing: the corner the panda climbs is not a blank wall
  for (const sx of [-1, 1]) {
    kit.box(0.12, 3.4, PD - 6, sx * (PW / 2 + 0.06), 3.2, 0, 'lit');
    for (let z = -PD / 2 + 4; z <= PD / 2 - 4; z += 3.2) {
      kit.instAdd('mullion', sx * (PW / 2 + 0.15), 21.7, z, 0, 0.18, 30.8, 0.18);
    }
    kit.box(0.6, 0.55, PD - 2, sx * (PW / 2 + 0.2), 5.25, 0, 'darkSteel');
  }
  // shopfront glazing + lit interior bands laid ON the facade (opaque glass, so they read)
  kit.box(PW - 6, 3.4, 0.12, 0, 3.2, FRONT + 0.03, 'lit');
  kit.box(PW - 6, 3.4, 0.12, 0, 3.2, -FRONT - 0.03, 'lit');
  for (const y of [5.25, 8.4, 15.5, 22.6, 29.7, 35.2]) {
    kit.box(PW - 2, y === 5.25 ? 0.65 : 0.45, PD + 1.0, 0, y, 0, y === 5.25 ? 'darkSteel' : 'stoneLight');
  }
  // slim steel mullions between the stone piers
  if (!kit.parts.has('__inst:mullion')) kit.instGeo('mullion', new T.BoxGeometry(1, 1, 1), 'mullion');
  for (let x = -PW / 2 + 2; x <= PW / 2 - 2; x += 4) {
    kit.instAdd('mullion', x, 21.7, FRONT + 0.12, 0, 0.18, 30.8, 0.18);
    kit.instAdd('mullion', x, 21.7, -FRONT - 0.12, 0, 0.18, 30.8, 0.18);
  }
  // three inserted glass entrance boxes, grounded and framed (no floating volumes)
  for (const [ex, ew, eh] of [[-58, 32, 17], [52, 38, 21]]) {
    kit.boxB(ew, eh, 13, ex, 0.32, FRONT + 6.2, 'glass');
    kit.boxB(ew + 1.6, 0.6, 14.2, ex, 0.32, FRONT + 6.2, 'stoneLight');
    kit.boxB(ew + 1.2, 0.5, 13.8, ex, 0.32 + eh, FRONT + 6.2, 'steel');
    kit.box(ew - 4, 5.2, 0.14, ex, 3.0, FRONT + 12.75, 'lit');
    for (let x = -ew / 2 + 2; x <= ew / 2 - 2; x += 4.2) {
      kit.boxB(0.22, eh, 0.22, ex + x, 0.32, FRONT + 12.8, 'steel');
    }
    // canopy + tie rods
    kit.box(ew + 5, 0.55, 9, ex, 7.0, FRONT + 13.6, 'steel');
    for (const sx of [-1, 1]) {
      kit.bone([ex + sx * (ew / 2 + 1.2), 7.0, FRONT + 17.8], [ex + sx * (ew / 2 - 1), eh + 4.2, FRONT + 5], 0.09, 'steel', 5);
    }
  }
  // main entrance canopy at the centre of the long facade
  kit.box(50, 0.75, 15, 52, 8.4, FRONT + 9.5, 'steel');
  for (const x of [34, 70]) kit.cylB(0.3, 0.36, 7.6, 8, x, 0.6, FRONT + 15.6, 'steel');

  // ---- podium roof: paved terrace, lawn, skylight, planters and parapet
  kit.box(PW + 2, 1.1, PD + 2, 0, PODIUM_H + 0.55, 0, 'stoneLight');
  kit.boxB(PW + 2, 1.45, 1.1, 0, PODIUM_H + 1.1, FRONT + 0.55, 'stoneDark');
  kit.boxB(PW + 2, 1.45, 1.1, 0, PODIUM_H + 1.1, -FRONT - 0.55, 'stoneDark');
  kit.boxB(1.1, 1.45, PD + 2, -PW / 2 - 0.55, PODIUM_H + 1.1, 0, 'stoneDark');
  kit.boxB(1.1, 1.45, PD + 2, PW / 2 + 0.55, PODIUM_H + 1.1, 0, 'stoneDark');
  kit.boxB(112, 0.28, 52, -8, PODIUM_H + 1.15, -10, 'hedge');
  for (const x of [-58, 40]) kit.boxB(7, 0.3, 92, x, PODIUM_H + 1.16, 0, 'stone');
  kit.boxB(214, 0.3, 7, 0, PODIUM_H + 1.16, 12, 'stone');
  // long glass skylight / roof pavilion
  kit.boxB(58, 1.1, 13, -14, PODIUM_H + 1.4, 4, 'darkSteel');
  kit.boxB(56, 2.4, 11, -14, PODIUM_H + 1.9, 4, 'glassDeep');
  kit.boxB(57, 0.4, 12, -14, PODIUM_H + 4.3, 4, 'steel');
  // planters along the parapet + a small roof pavilion
  for (const px of [-96, -52, 18, 74]) {
    kit.boxB(11, 1.0, 4.2, px, PODIUM_H + 1.3, -FRONT + 11, 'stone');
    kit.boxB(10.2, 0.85, 3.4, px, PODIUM_H + 2.3, -FRONT + 11, 'hedge');
  }
  for (const px of [-30, 26]) {
    kit.boxB(9, 1.0, 4.2, px, PODIUM_H + 1.3, FRONT - 10, 'stone');
    kit.boxB(8.2, 0.85, 3.4, px, PODIUM_H + 2.3, FRONT - 10, 'hedge');
  }
  trees(kit, [[-92, -FRONT + 16, 1.0, 0.8], [-46, -FRONT + 17, 1.15, 1.2], [8, -FRONT + 15, 0.9, 2.2], [70, -6, 1.0, 0.4]], 0.8);
  // stone pad under the panda, with a clipped hedge behind
  kit.boxB(30, 0.32, 22, 106, PODIUM_H + 1.2, FRONT - 11, 'stoneDark');
  kit.boxB(28, 0.2, 3.0, 106, PODIUM_H + 1.55, FRONT - 20, 'stoneLight');
  kit.boxB(18, 0.9, 2.8, 106, PODIUM_H + 1.3, FRONT - 17.5, 'hedge');

  // ---- the two office towers (230 m and 180 m), glass with stone corner piers
  const towers = [
    { x: 52, z: -18, w: 72, d: 62, h: MAIN_H },
    { x: -74, z: -25, w: 58, d: 50, h: SECOND_H },
  ];
  for (const tw of towers) {
    const h = tw.h;
    const bodyBot = PODIUM_H - 2.4;
    const bodyTop = h - 26;
    kit.boxB(tw.w + 2.6, 9, tw.d + 2.6, tw.x, PODIUM_H - 3.2, tw.z, 'stone');
    kit.boxB(tw.w, bodyTop - bodyBot, tw.d, tw.x, bodyBot, tw.z, 'glass');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      kit.boxB(2.6, bodyTop - bodyBot, 2.6, tw.x + sx * (tw.w / 2 - 0.5), bodyBot, tw.z + sz * (tw.d / 2 - 0.5), 'stoneLight');
    }
    // vertical mullion rhythm on four faces
    const hh = bodyTop - bodyBot;
    const yc = bodyBot + hh / 2;
    for (let x = -tw.w / 2 + 2.6; x <= tw.w / 2 - 2.6; x += 2.6) {
      kit.instAdd('mullion', tw.x + x, yc, tw.z + tw.d / 2 + 0.13, 0, 0.2, hh, 0.2);
      kit.instAdd('mullion', tw.x + x, yc, tw.z - tw.d / 2 - 0.13, 0, 0.2, hh, 0.2);
    }
    for (let z = -tw.d / 2 + 2.4; z <= tw.d / 2 - 2.4; z += 2.6) {
      kit.instAdd('mullion', tw.x + tw.w / 2 + 0.13, yc, tw.z + z, 0, 0.2, hh, 0.2);
      kit.instAdd('mullion', tw.x - tw.w / 2 - 0.13, yc, tw.z + z, 0, 0.2, hh, 0.2);
    }
    // slender horizontal ledges + glowing office bands
    for (let y = bodyBot + 9; y <= bodyTop - 10; y += 9.2) {
      kit.box(tw.w + 0.8, 0.32, tw.d + 0.8, tw.x, y, tw.z, 'stoneLight');
    }
    for (const [y, bh] of [[bodyTop - 62, 1.4], [bodyTop - 34, 1.8], [bodyTop - 12, 1.2]]) {
      kit.box(tw.w + 0.3, bh, tw.d + 0.3, tw.x, y, tw.z, 'lit');
      kit.box(tw.w + 0.6, 0.28, tw.d + 0.6, tw.x, y - bh / 2 - 0.2, tw.z, 'steel');
    }

    // stepped crown: shoulder + lantern + roof mast
    const sw = tw.w * 0.9, sd = tw.d * 0.9;
    kit.boxB(sw, 14, sd, tw.x, h - 26, tw.z, 'glassDeep');
    kit.box(sw + 1.6, 0.7, sd + 1.6, tw.x, h - 26, tw.z, 'stoneLight');
    for (let x = -sw / 2 + 1.6; x <= sw / 2 - 1.6; x += 2.6) {
      kit.instAdd('mullion', tw.x + x, h - 19, tw.z + sd / 2 + 0.12, 0, 0.22, 14, 0.22);
      kit.instAdd('mullion', tw.x + x, h - 19, tw.z - sd / 2 - 0.12, 0, 0.22, 14, 0.22);
    }
    const cw = tw.w * 0.7, cd = tw.d * 0.7;
    kit.boxB(cw, 11, cd, tw.x, h - 12, tw.z, 'glassDeep');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      kit.boxB(1.0, 12, 1.0, tw.x + sx * (cw / 2 - 0.4), h - 12, tw.z + sz * (cd / 2 - 0.4), 'steel');
    }
    kit.box(cw + 0.4, 1.1, cd + 0.4, tw.x, h - 6.5, tw.z, 'lit');
    for (let x = -cw / 2 + 1.2; x <= cw / 2 - 1.2; x += 2.1) {
      kit.boxB(0.34, 9.0, 0.34, tw.x + x, h - 11, tw.z + cd / 2 + 0.3, 'steel');
      kit.boxB(0.34, 9.0, 0.34, tw.x + x, h - 11, tw.z - cd / 2 - 0.3, 'steel');
    }
    kit.box(cw + 0.8, 1.3, cd + 0.8, tw.x, h - 0.8, tw.z, 'stoneLight');
    kit.boxB(cw * 0.34, 2.3, cd * 0.34, tw.x, h - 0.2, tw.z, 'darkSteel');
    kit.cylB(0.14, 0.26, 1.2, 6, tw.x, h, tw.z, 'steel');
    kit.sphere(0.36, tw.x, h + 1.35, tw.z, 'aviation', 1, 1, 1, 8);
    for (const sx of [-1, 1]) kit.sphere(0.28, tw.x + sx * cw / 2, h - 11.5, tw.z, 'aviation', 1, 1, 1, 6);
  }

  // ---- giant panda over the south-east corner of the podium
  addGiantPanda(kit, 106, PODIUM_H + 0.05, FRONT - 6.3, 0.32, 1.9);

  // understated entrance sign, no brand marks
  const sm = signMaterial(T, '国金中心', { px: 512, py: 128, bg: '#1a1d1f', fg: '#e8dcc2', vertical: false, fontWeight: 600, border: 'rgba(200,180,140,.4)' });
  kit.quad(11, 2.75, 52, 23.9, FRONT + 13.1, sm);

  return finishLM(kit, site, W, D, MAIN_H);
}

// A giant panda ~13 m tall / ~17 m long when scaled by 1.8: belly on the parapet, head and
// one arm hanging over the glass edge, hind paws braced on the roof. Faces +z.
function addGiantPanda(kit, x, y, z, ry, s) {
  kit.push(x, y, z, ry, s);
  // torso: long, low and pear-shaped, draped over the edge
  kit.sphere(3.0, 0, 2.3, 0, 'pandaWhite', 1.05, 0.78, 1.45, 24);
  kit.sphere(2.5, 0, 1.9, -3.3, 'pandaWhite', 1.06, 0.9, 1.0, 20);
  kit.sphere(1.9, 0, 3.1, 2.5, 'pandaWhite', 1.1, 0.95, 0.9, 18);
  // head, muzzle, nose
  kit.sphere(2.2, 0, 3.95, 3.85, 'pandaWhite', 1.04, 1.0, 1.0, 24);
  kit.sphere(1.16, 0, 3.3, 5.45, 'pandaWhite', 1.22, 0.84, 0.95, 16);
  kit.sphere(0.4, 0, 3.4, 6.2, 'pandaBlack', 1.0, 0.75, 0.7, 10);
  // ears
  kit.sphere(0.88, -1.52, 5.25, 3.3, 'pandaBlack', 1, 1.02, 0.6, 14);
  kit.sphere(0.88, 1.52, 5.25, 3.3, 'pandaBlack', 1, 1.02, 0.6, 14);
  // eye patches + eyes
  kit.sphere(0.71, -0.86, 4.42, 5.5, 'pandaBlack', 0.92, 1.3, 0.38, 16, 0.16);
  kit.sphere(0.71, 0.86, 4.42, 5.5, 'pandaBlack', 0.92, 1.3, 0.38, 16, -0.16);
  kit.sphere(0.2, -0.84, 4.52, 5.79, 'pandaGlass', 1, 1, 1, 8);
  kit.sphere(0.2, 0.84, 4.52, 5.79, 'pandaGlass', 1, 1, 1, 8);
  kit.sphere(0.06, -0.8, 4.57, 5.96, 'white', 1, 1, 1, 6);
  kit.sphere(0.06, 0.8, 4.57, 5.96, 'white', 1, 1, 1, 6);
  // arms: left down the glass, right braced on the ledge
  kit.bone([-1.9, 2.8, 2.8], [-2.3, -1.45, 2.3], 0.66, 'pandaBlack', 12);
  kit.bone([1.9, 2.8, 2.8], [2.15, 0.85, 2.7], 0.64, 'pandaBlack', 12);
  kit.sphere(0.86, -2.35, -1.62, 2.28, 'pandaBlack', 1.04, 0.92, 1.05, 12);
  kit.sphere(0.82, 2.2, 0.72, 2.68, 'pandaBlack', 1.04, 0.92, 1.05, 12);
  // hind legs folded under the body, paws flat on the roof
  kit.bone([-1.75, 1.45, -2.4], [-2.2, 0.28, -4.9], 0.8, 'pandaBlack', 12);
  kit.bone([1.75, 1.45, -2.4], [2.1, 0.28, -4.9], 0.8, 'pandaBlack', 12);
  kit.sphere(0.98, -2.25, 0.24, -5.2, 'pandaBlack', 1.06, 0.68, 1.28, 12);
  kit.sphere(0.98, 2.15, 0.24, -5.2, 'pandaBlack', 1.06, 0.68, 1.28, 12);
  kit.sphere(0.62, 0, 1.9, -5.75, 'pandaBlack', 1, 1, 1, 10);
  // bamboo sprigs in the free paw
  kit.bone([2.1, 0.8, 2.55], [3.4, 2.6, 2.2], 0.08, 'hedge', 6);
  kit.bone([2.1, 0.8, 2.65], [3.0, 2.9, 2.85], 0.06, 'hedge', 6);
  kit.pop();
}

// =============================================================================================
// 2 · 四川广播电视塔 — 339 m concrete/steel tower, upper saucer pod at 204–218 m.
// Nominal footprint 110 × 110 m.
// =============================================================================================
function buildTVTower({ THREE: T, site }) {
  const kit = new Kit(T);
  const H = 339;
  const BASE_H = 12.5;

  // ---- plaza, stepped base and glazed lower pavilion ("旋盘式" disc)
  kit.cylB(46, 48, 0.7, 48, 0, 0, 0, 'stone');
  kit.cylB(40, 41, 0.45, 48, 0, 0.7, 0, 'stoneLight');
  kit.cylB(38.2, 38.8, 1.1, 48, 0, 1.15, 0, 'white');
  // glazed 3-storey drum with white radial fins
  kit.cylB(35, 35, 5.3, 48, 0, 2.25, 0, 'glassTeal');
  kit.cylB(34.8, 34.8, 0.5, 48, 0, 2.25, 0, 'darkSteel');
  if (!kit.parts.has('__inst:tvMullion')) kit.instGeo('tvMullion', new T.BoxGeometry(1, 1, 1), 'steel');
  for (let i = 0; i < 56; i++) {
    const a = (i / 56) * TAU;
    kit.instAdd('tvMullion', Math.cos(a) * 35.08, 4.95, Math.sin(a) * 35.08, -a, 0.16, 5.3, 0.16);
  }
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU;
    kit.box(0.55, 5.3, 1.15, Math.cos(a) * 35.25, 4.95, Math.sin(a) * 35.25, 'white', -a);
  }
  // white fascia ring and the mushroom roof
  kit.cylB(38.5, 37.4, 1.0, 48, 0, 7.55, 0, 'white');
  kit.lathe([[37.2, 8.5], [38.6, 9.1], [38.6, 9.9], [36.0, 11.0], [30.0, 11.9], [19.0, 12.4], [12.5, 12.5]], 0, 0, 0, 'white', 56);
  kit.torus(37.3, 0.18, 0, 8.55, 0, 'steel', Math.PI / 2, 0, 0, 56, 5);
  // four tangential entrance canopies with columns
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    const cx = Math.cos(a) * 41.5;
    const cz = Math.sin(a) * 41.5;
    kit.add(new T.BoxGeometry(19, 0.5, 8.5), 'steel', cx * 0.82, 8.0, cz * 0.82, 0, Math.PI / 2 - a, 0.04);
    for (const sgn of [-1, 1]) {
      const ox = Math.cos(a + Math.PI / 2) * 6.3 * sgn;
      const oz = Math.sin(a + Math.PI / 2) * 6.3 * sgn;
      kit.cylB(0.3, 0.36, 8.0, 8, cx + ox, 0.5, cz + oz, 'steel');
    }
  }

  // ---- tapered shaft 12.5–204 m
  kit.lathe([[12.3, 12.3], [10.9, 21], [9.4, 36], [8.4, 70], [7.8, 120], [7.4, 165], [7.1, 198], [7.5, 204]], 0, 0, 0, 'white', 48);
  if (!kit.parts.has('__inst:shaftFin')) kit.instGeo('shaftFin', new T.BoxGeometry(1, 1, 1), 'white');
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    for (let k = 0; k < 9; k++) {
      const y0 = 14 + k * 21;
      const y1 = Math.min(200, y0 + 21);
      const rr = 11.2 - (y0 / 200) * 3.9;
      kit.instAdd('shaftFin', Math.cos(a) * (rr - 0.45), (y0 + y1) / 2, Math.sin(a) * (rr - 0.45), -a, 0.32, y1 - y0, 1.4);
    }
  }
  for (const y of [48, 88, 128, 168, 194]) {
    const r = 11.2 - (y / 200) * 3.9 + 0.4;
    kit.torus(r, 0.18, 0, y, 0, 'concrete', Math.PI / 2, 0, 0, 40, 5);
  }

  // ---- observation pod 204–226: saucer, glazed ring, upper drum, railing
  kit.lathe([[7.5, 204], [13, 203.2], [20.5, 206.0], [23.2, 209.0], [23.2, 213.6], [20.0, 216.4], [14.5, 217.8], [8.4, 218.2], [7.4, 218.2]], 0, 0, 0, 'white', 56);
  kit.lathe([[22.1, 206.4], [23.35, 206.8], [23.35, 213.3], [21.9, 213.8]], 0, 0, 0, 'glassTeal', 56);
  // white vertical mullions around the glazed observation ring
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU;
    kit.box(0.32, 7.0, 0.42, Math.cos(a) * 23.4, 210.0, Math.sin(a) * 23.4, 'white', -a);
  }
  // lit interior band behind the glazing
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * TAU;
    kit.box(2.1, 2.0, 0.15, Math.cos(a) * 22.2, 210.2, Math.sin(a) * 22.2, 'litCool', -a);
  }
  kit.cylB(15.4, 15.0, 7.8, 40, 0, 218.2, 0, 'white');
  kit.cylB(15.3, 15.3, 2.4, 40, 0, 211.3, 0, 'redPaint');
  kit.cylB(16.2, 16.2, 0.55, 40, 0, 226.0, 0, 'steel');
  kit.cylB(16.7, 16.7, 0.5, 40, 0, 218.2, 0, 'steel');
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU;
    kit.cylB(0.07, 0.07, 1.15, 5, Math.cos(a) * 16.1, 226.4, Math.sin(a) * 16.1, 'steel');
  }
  kit.torus(16.2, 0.09, 0, 227.5, 0, 'steel', Math.PI / 2, 0, 0, 56, 4);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    kit.bone([Math.cos(a) * 7.4, 196.5, Math.sin(a) * 7.4], [Math.cos(a) * 20.0, 205.8, Math.sin(a) * 20.0], 0.3, 'steel', 7);
  }
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    kit.sphere(0.64, Math.cos(a) * 19.6, 217.6, Math.sin(a) * 19.6, 'aviation', 1, 1, 1, 8);
  }

  // ---- mast 226–339: red/white pole + a readable triangular lattice
  kit.cylB(3.0, 3.4, 10, 16, 0, 226, 0, 'white');
  kit.cylB(2.35, 2.75, 20, 14, 0, 236, 0, 'redPaint');
  kit.cylB(1.85, 2.25, 22, 12, 0, 256, 0, 'white');
  kit.cylB(1.45, 1.8, 22, 10, 0, 278, 0, 'redPaint');
  kit.cylB(1.05, 1.35, 22, 10, 0, 300, 0, 'white');
  kit.cylB(0.45, 1.0, 15, 8, 0, 322, 0, 'redPaint');
  kit.cylB(0.12, 0.42, 2, 6, 0, 337, 0, 'white');
  const legs = 3;
  const legR = (y) => 4.9 - ((y - 230) / 108) * 3.9;
  for (let i = 0; i < legs; i++) {
    const a = (i / legs) * TAU + 0.45;
    kit.bone([Math.cos(a) * legR(230), 230, Math.sin(a) * legR(230)], [Math.cos(a + 0.22) * legR(338), 338, Math.sin(a + 0.22) * legR(338)], 0.2, 'steel', 6);
  }
  for (let y = 232; y < 330; y += 10) {
    const y1 = Math.min(338, y + 10);
    const r = legR(y);
    for (let i = 0; i < legs; i++) {
      const a0 = (i / legs) * TAU + 0.45;
      const a1 = ((i + 1) / legs) * TAU + 0.45;
      kit.bone([Math.cos(a0) * r, y, Math.sin(a0) * r], [Math.cos(a1) * legR(y1), y1, Math.sin(a1) * legR(y1)], 0.105, 'steel', 5);
      kit.bone([Math.cos(a0) * r, y, Math.sin(a0) * r], [Math.cos(a1) * r, y, Math.sin(a1) * r], 0.085, 'darkSteel', 4);
    }
    kit.torus(r, 0.1, 0, y, 0, 'darkSteel', Math.PI / 2, 0, 0, 24, 4);
  }
  // dishes / drums on short arms
  for (const [yy, aa, rr] of [[242, 0.2, 3.8], [258, 2.2, 2.9], [276, 4.4, 3.2], [296, 1.3, 2.2], [313, 3.6, 1.5]]) {
    const x = Math.cos(aa) * 3.4;
    const z = Math.sin(aa) * 3.4;
    kit.cylB(rr, rr * 0.72, 0.8, 14, x, yy, z, 'white', -aa);
    kit.cylB(0.24, 0.24, 8.0, 6, x, yy + 0.4, z, 'steel');
  }
  // aviation beacons
  for (const y of [227.8, 243, 262, 282, 302, 320, 333, 338]) {
    kit.sphere(0.58, 0, y, 0, 'aviation', 1, 1, 1, 8);
    if (y < 300) {
      for (const a of [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]) {
        kit.sphere(0.26, Math.cos(a) * 2.6, y + 1.4, Math.sin(a) * 2.6, 'aviation', 1, 1, 1, 6);
      }
    }
  }
  for (const y of [238, 260, 282]) kit.cylB(2.1, 2.1, 0.22, 20, 0, y, 0, 'redPaint');

  // ---- plaza landscaping
  const treeSpots = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    if (Math.abs(Math.sin(a)) < 0.35 && Math.cos(a) > 0) continue;
    treeSpots.push([Math.cos(a) * 44, Math.sin(a) * 44, 1.05, i * 0.37]);
  }
  trees(kit, treeSpots, 1.0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    kit.cylB(0.22, 0.3, 5.5, 8, Math.cos(a) * 43, 0.6, Math.sin(a) * 43, 'darkSteel');
    kit.sphere(0.5, Math.cos(a) * 43, 6.3, Math.sin(a) * 43, 'litCool', 1, 1, 1, 8);
  }

  return finishLM(kit, site, 110, 110, H);
}


// =============================================================================================
// 3 · 成都远洋太古里 — low-rise grey-brick 川西 retail lanes, dark pitched roofs, glass flagships.
// Nominal footprint 280 × 190 m.
// =============================================================================================
function gableRoof(kit, x, z, w, d, yEave, key = 'roofSlate', pitch = 0.56, over = 1.25) {
  const half = d / 2 + over;
  const rise = half * Math.tan(pitch);
  const len = half / Math.cos(pitch);
  kit.box(w + 2 * over, 0.34, len, x, yEave + rise / 2, z + half / 2, key, 0, pitch, 0);
  kit.box(w + 2 * over, 0.34, len, x, yEave + rise / 2, z - half / 2, key, 0, -pitch, 0);
  kit.box(w + 2 * over + 0.45, 0.3, 0.72, x, yEave + rise + 0.12, z, 'roofSlateDark');
  for (const sgn of [-1, 1]) {
    kit.box(w + 2 * over, 0.26, 0.3, x, yEave - 0.08, z + sgn * half, 'woodDark');
    kit.tri(d + 0.2, rise, x, yEave, z, 'brick', sgn * Math.PI / 2);
  }
  return rise;
}

function taikooBlock(kit, opt) {
  const { x, z, w, d, storeys, front, brick = 'brick', name, roofKey = 'roofSlate', detail = 1 } = opt;
  const eave = 4.1 + (storeys - 1) * 3.7;
  const h = eave;
  // stone skirt + brick body
  kit.boxB(w, 0.55, d, x, 0, z, 'stoneDark');
  kit.boxB(w, h - 0.55, d, x, 0.55, z, brick);
  // white plaster band under the eaves
  kit.box(w + 0.25, 0.7, d + 0.25, x, eave - 0.5, z, 'stoneLight');
  // ground-floor shopfront, deeply recessed behind a timber arcade
  const fz = z + front * (d / 2 + 0.03);
  kit.box(w - 2.2, 3.4, 0.18, x, 2.15, fz, 'glassTeal');
  kit.box(w - 3.2, 1.5, 0.1, x, 1.85, fz + front * 0.1, 'litWarm');
  // striped fabric awning over the shopfront
  for (const sgn of [-1, 1]) {
    kit.box(w * 0.46, 0.12, 1.6, x + sgn * w * 0.24, 4.25, z + front * (d / 2 + 1.0), sgn > 0 ? 'flagA' : 'flagC', 0, front * 0.18, 0);
  }
  kit.box(w - 2.2, 0.24, 0.34, x, 3.95, fz, 'woodDark');
  // arcade canopy + posts
  kit.box(w - 1.0, 0.35, 3.1, x, 4.35, z + front * (d / 2 + 1.35), 'woodDark');
  for (let px = -w / 2 + 1.4; px <= w / 2 - 1.4; px += detail ? 4.4 : 8.8) {
    kit.boxB(0.32, 4.2, 0.32, x + px, 0, z + front * (d / 2 + 2.55), 'wood');
    if (detail) kit.boxB(0.48, 0.22, 0.48, x + px, 0.2, z + front * (d / 2 + 2.55), 'stoneDark');
  }
  // upper timber lattice screens and warm windows
  const upperFront = z + front * (d / 2 + 0.06);
  for (let f = 1; f < storeys; f++) {
    const y = 4.1 + (f - 1) * 3.7 + 1.55;
    kit.box(w - 5.5, 1.55, 0.14, x, y, upperFront, 'glassDeep');
    kit.box(w - 6.5, 1.15, 0.08, x, y, upperFront + front * 0.04, 'litWarm');
    // dark timber window frames
    if (detail) for (let wx = -w / 2 + 3.2; wx <= w / 2 - 3.2; wx += 4.8) {
      kit.boxB(0.14, 1.8, 0.24, x + wx, y - 0.9, upperFront + front * 0.05, 'woodDark');
    }
    kit.box(w - 5.0, 0.16, 0.3, x, y + 0.85, upperFront, 'woodDark');
    // slim balcony rail
    if (f === storeys - 1) {
      kit.box(w - 3.0, 0.12, 0.75, x, y - 0.75, z + front * (d / 2 + 0.5), 'woodDark');
      if (detail) for (let wx = -w / 2 + 3.0; wx <= w / 2 - 3.0; wx += 2.4) {
        kit.boxB(0.09, 0.7, 0.09, x + wx, y - 1.45, z + front * (d / 2 + 0.85), 'woodDark');
      }
    }
  }
  // pitched roof (ridge along x) and gable ends
  const rise = gableRoof(kit, x, z, w, d, eave, roofKey, 0.42, 1.45);
  // ridge vent
  kit.boxB(2.6, 1.0, 0.7, x, eave + rise + 0.05, z, 'stoneDark');
  // vertical shop sign at one front corner
  if (name && detail) {
    const sx = x + (opt.signSide || 1) * (w / 2 - 2.2);
    const sz = z + front * (d / 2 + 2.45);
    const sm = signMaterial(kit.T, name, { px: 192, py: 640, bg: '#241c14', fg: opt.light || '#f2ddad', vertical: true, fontWeight: 700, border: 'rgba(198,160,82,.55)', emissive: 0.35 });
    kit.mesh(new kit.T.PlaneGeometry(1.35, 4.1), sm, sx, eave - 1.7, sz + front * 0.5, 0, Math.PI / 2, 0);
    kit.box(0.18, 4.35, 0.42, sx, eave - 1.7, sz + front * 0.5, 'woodDark');
    kit.bone([sx, eave + 0.25, sz + front * 0.5], [sx, eave - 0.15, z + front * (d / 2)], 0.05, 'woodDark', 4);
  }
  // horizontal fascia sign facing the lane, legible down the whole street
  if (name) {
    const hs = signMaterial(kit.T, name, { px: 768, py: 192, bg: '#241c14', fg: opt.light || '#f2ddad', vertical: false, fontWeight: 700, border: 'rgba(198,160,82,.5)', emissive: 0.35 });
    kit.quad(Math.min(9.5, w - 8), 1.35, x - w * 0.08, 5.55, fz + front * 0.25, hs, 0, front < 0 ? Math.PI : 0, 0);
  }
  // red lanterns under the arcade
  for (let lx = -w / 2 + 4; lx <= w / 2 - 4; lx += detail ? 8.2 : 12) {
    kit.instAdd('lantern', x + lx, 3.55, z + front * (d / 2 + 1.7), 0, 0.34, 0.3, 0.34);
  }
  return { eave, rise };
}

function buildTaikooli({ THREE: T, site }) {
  const kit = new Kit(T);
  if (!kit.parts.has('__inst:lantern')) kit.instGeo('lantern', new T.SphereGeometry(1, 10, 8), 'lantern');
  // paving + lanes
  const paving = pavingTex('taikooPaving', '#96938a', 'rgba(55,51,45,.34)', 58, false);
  paving.repeat.set(22, 15);
  const groundMat = new T.MeshStandardNodeMaterial({ map: paving, color: 0xffffff, roughness: 0.92, metalness: 0.02 });
  kit.quad(280, 190, 0, 0.04, 0, groundMat, -Math.PI / 2, 0, 0);
  kit.box(280, 0.12, 14, 0, 0.01, 0, 'stoneLight');
  // flagstone strips along the main lane
  for (let x = -136; x <= 136; x += 7) kit.box(4.6, 0.03, 38, x, 0.08, 0, 'stone');

  const northZ = 26, southZ = -26;
  const north = [
    { x: -108, w: 42, storeys: 2, name: '青瓦茶室', brick: 'brick', signSide: 1 },
    { x: -58, w: 44, storeys: 3, name: '竹影书房', brick: 'brickWarm', signSide: -1 },
    { x: -4, w: 44, storeys: 2, name: '蜀绣坊', brick: 'brick', signSide: 1 },
    { x: 50, w: 44, storeys: 3, name: '川西小馆', brick: 'brickWarm', signSide: -1 },
    { x: 100, w: 38, storeys: 2, name: '手作工坊', brick: 'brick', signSide: 1 },
  ];
  const south = [
    { x: -108, w: 42, storeys: 3, name: '瓦舍茶铺', brick: 'brickWarm', signSide: -1 },
    { x: -58, w: 44, storeys: 2, name: '锦官书斋', brick: 'brick', signSide: 1 },
    // x=-4: open plaza
    { x: 100, w: 38, storeys: 2, name: '青石咖啡', brick: 'brick', signSide: 1 },
  ];
  for (const b of north) taikooBlock(kit, { ...b, z: northZ, d: 28, front: -1 });
  for (const b of south) taikooBlock(kit, { ...b, z: southZ, d: 28, front: 1 });
  // back row of smaller courtyard blocks, making a real district grid
  const back = [
    { x: -94, w: 52, storeys: 2, name: '青竹茶舍', brick: 'brick', signSide: 1 },
    { x: -8, w: 56, storeys: 2, name: '蜀风小院', brick: 'brickWarm', signSide: -1 },
    { x: 82, w: 56, storeys: 2, name: '瓦檐书房', brick: 'brick', signSide: 1 },
  ];
  for (const b of back) taikooBlock(kit, { ...b, z: 72, d: 22, front: -1, detail: 0 });
  for (const b of back) taikooBlock(kit, { ...b, z: -72, d: 22, front: 1, detail: 0 });

  // ---- sleek glass flagship on the south lane
  {
    const x = 52, z = southZ, w = 42, d = 28, h = 16.5;
    kit.boxB(w + 2, 0.5, d + 2, x, 0, z, 'stoneDark');
    kit.boxB(w, h, d, x, 0.5, z, 'glassDeep');
    for (let i = 0; i <= 12; i++) {
      kit.box(0.2, h, 0.2, x - w / 2 + (i / 12) * w, h / 2 + 0.5, z + d / 2 + 0.1, 'steel');
      kit.box(0.2, h, 0.2, x - w / 2 + (i / 12) * w, h / 2 + 0.5, z - d / 2 - 0.1, 'steel');
    }
    for (let f = 0; f < 3; f++) kit.box(w - 1, 0.35, d - 1, x, 4.6 + f * 5.0, z, 'steel');
    kit.box(w - 3, 1.8, 0.18, x, 5.6, z + d / 2 + 0.15, 'lit');
    kit.box(w - 3, 1.8, 0.18, x, 10.6, z + d / 2 + 0.15, 'lit');
    kit.box(w + 3, 0.8, d + 3, x, h + 0.9, z, 'steel');
    kit.box(w + 1, 0.5, d + 1, x, h + 1.5, z, 'roofSlateDark');
    // cantilevered canopy
    kit.box(w * 0.6, 0.4, 8, x, 5.0, z + d / 2 + 4, 'steel');
    const sm = signMaterial(T, '光影馆', { px: 512, py: 128, bg: '#161b1d', fg: '#e7dcc4', vertical: false, fontWeight: 600, border: 'rgba(198,160,82,.4)', emissive: 0.5 });
    kit.quad(7.5, 1.9, x, 13.2, z + d / 2 + 0.32, sm);
  }

  // ---- plaza: stone court, shallow water basin, feature tree, low glass tea pavilion
  {
    const px = -4, pz = -26;
    kit.box(44, 0.18, 24, px, 0.1, pz, 'stoneLight');
    kit.boxB(20, 0.55, 10, px, 0.15, pz - 1, 'stoneDark');
    kit.quad(19.2, 9.2, px, 0.72, pz - 1, new T.MeshStandardNodeMaterial({ color: 0x3f6065, roughness: 0.12, metalness: 0.32 }), -Math.PI / 2, 0, 0);
    kit.boxB(20.4, 0.2, 0.4, px, 0.7, pz - 6, 'stoneLight');
    kit.boxB(20.4, 0.2, 0.4, px, 0.7, pz + 4, 'stoneLight');
    trees(kit, [[px - 16, pz + 9, 1.3, 0.2], [px + 15, pz + 7, 1.05, 1.1], [px - 15, pz - 10, 0.95, 2.0], [px + 17, pz - 9, 1.2, 0.8]], 1.1);
    // glass tea pavilion
    kit.boxB(19, 0.5, 11, px + 2, 0, pz - 10, 'stoneDark');
    kit.boxB(18, 6.2, 10, px + 2, 0.5, pz - 10, 'glassTeal');
    kit.box(20, 0.6, 12, px + 2, 6.9, pz - 10, 'steel');
    kit.box(16, 0.18, 8, px + 2, 3.6, pz - 10, 'woodDark');
    for (const sx of [-8, 8]) for (const sz of [-4, 4]) kit.boxB(0.2, 6.2, 0.2, px + 2 + sx, 0.5, pz - 10 + sz, 'steel');
    // benches around the basin
    for (const [bx, bz, br] of [[px - 13, pz + 1, 0], [px + 13, pz + 1, Math.PI]]) {
      kit.box(3.4, 0.22, 1.0, bx, 0.52, bz, 'wood', br);
      for (const s of [-1, 1]) kit.boxB(0.18, 0.5, 0.9, bx + s * 1.3, 0, bz, 'stoneDark', br);
    }
    // red lanterns on a short line
    lanternString(kit, [px - 18, 5.4, pz + 14], [px + 18, 5.4, pz + 14], 6, 0.7, 0.4);
  }

  // ---- narrow lanes, planters and trees
  const treeSpots = [];
  for (let x = -126; x <= 126; x += 18) {
    treeSpots.push([x, 10.1, 0.7 + 0.12 * Math.sin(x * 0.2), x * 0.03]);
    treeSpots.push([x + 7, -10.1, 0.68 + 0.1 * Math.cos(x * 0.17), x * 0.05]);
  }
  for (const x of [-126, -70, -14, 42, 98, 126]) {
    treeSpots.push([x, 50, 1.0, x * 0.02]);
    treeSpots.push([x, -50, 1.05, x * 0.04]);
    treeSpots.push([x, 88, 0.9, x * 0.01]);
    treeSpots.push([x, -88, 0.92, x * 0.03]);
  }
  trees(kit, treeSpots, 0.78);
  // long stone planters with clipped hedges down the lane
  for (let x = -122; x <= 122; x += 26) {
    kit.boxB(10, 0.65, 2.4, x, 0, 4.5, 'stone');
    kit.boxB(9.1, 0.8, 1.6, x, 0.65, 4.5, 'hedge');
    kit.boxB(10, 0.65, 2.4, x + 9, 0, -4.5, 'stone');
    kit.boxB(9.1, 0.8, 1.6, x + 9, 0.65, -4.5, 'hedge');
    kit.box(10.4, 0.18, 2.8, x, 0.05, 4.5, 'stoneLight');
  }
  // string lights across the main lane
  for (let x = -120; x <= 120; x += 34) lanternString(kit, [x, 6.6, -11.6], [x, 6.6, 11.6], 3, 0.9, 0.34);
  // low stone bollards at the lane ends
  for (let z = -18; z <= 18; z += 6) {
    kit.cylB(0.32, 0.42, 1.0, 10, -140, 0, z, 'stoneDark');
    kit.cylB(0.32, 0.42, 1.0, 10, 140, 0, z, 'stoneDark');
  }

  return finishLM(kit, site, 280, 190, 19);
}


// =============================================================================================
// 4 · 天府广场 — 300 m civic square: sun-bird roundel, fountain ring, 汉阙 gate pillars,
// planters, lamps and generic festival pennants (no statues, no political banners).
// =============================================================================================
function tianfuPavingTex() {
  return canvasTex('tianfuPaving', 1024, 1024, (c, W, H) => {
    const cx = W / 2, cy = H / 2;
    c.fillStyle = '#a29b8c';
    c.fillRect(0, 0, W, H);
    // concentric granite bands
    for (const [rr, col, lw] of [
      [0.155, '#b9b09d', 20], [0.205, '#8b8476', 8], [0.28, '#b4aa96', 24],
      [0.35, '#8c8577', 10], [0.43, '#b7ad99', 18], [0.475, '#837c6f', 8],
    ]) {
      c.beginPath();
      c.arc(cx, cy, rr * W, 0, TAU);
      c.strokeStyle = col;
      c.lineWidth = lw;
      c.stroke();
    }
    // radial paving joints and axes
    c.strokeStyle = 'rgba(70,65,57,.35)';
    c.lineWidth = 2;
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * W * 0.16, cy + Math.sin(a) * W * 0.16);
      c.lineTo(cx + Math.cos(a) * W * 0.48, cy + Math.sin(a) * W * 0.48);
      c.stroke();
    }
    // 6 m stone grid
    c.strokeStyle = 'rgba(66,61,54,.22)';
    c.lineWidth = 1.2;
    const step = W / 50;
    for (let i = 0; i <= 50; i++) {
      c.beginPath(); c.moveTo(i * step, 0); c.lineTo(i * step, H); c.stroke();
      c.beginPath(); c.moveTo(0, i * step); c.lineTo(W, i * step); c.stroke();
    }
    // broad cross axes
    c.fillStyle = 'rgba(190,180,160,.20)';
    c.fillRect(cx - W * 0.012, 0, W * 0.024, H);
    c.fillRect(0, cy - W * 0.012, W, W * 0.024);
    // stone grain
    const r = rng(2027);
    for (let i = 0; i < 2600; i++) {
      c.fillStyle = `rgba(60,55,48,${r() * 0.05})`;
      c.fillRect(r() * W, r() * H, 1 + r() * 4, 1 + r() * 2);
    }
  }, false);
}

function hanQue(kit, x, z) {
  kit.push(x, 0, z, 0, 1);
  kit.boxB(5.0, 1.2, 5.0, 0, 0, 0, 'stoneDark');
  kit.boxB(4.2, 0.8, 4.2, 0, 1.2, 0, 'stone');
  kit.boxB(3.2, 11.2, 3.2, 0, 2.0, 0, 'stoneLight');
  for (const y of [4.2, 7.1, 10.0]) kit.box(3.5, 0.35, 3.5, 0, y, 0, 'stoneDark');
  // shallow carved panels on the four faces
  for (const [dx, dz, ry] of [[0, 1.61, 0], [0, -1.61, 0], [1.61, 0, Math.PI / 2], [-1.61, 0, Math.PI / 2]]) {
    kit.box(1.5, 4.2, 0.08, dx, 7.4, dz, 'stone', ry);
  }
  kit.boxB(5.8, 0.8, 5.2, 0, 13.2, 0, 'stone');
  kit.box(6.5, 0.7, 5.9, 0, 14.4, 0, 'stoneDark');
  kit.box(6.9, 0.4, 6.2, 0, 15.0, 0, 'stoneLight');
  kit.box(6.0, 0.55, 4.8, 0, 15.45, 0, 'stone');
  kit.box(4.4, 0.7, 3.2, 0, 16.0, 0, 'stoneDark');
  kit.sphere(0.42, 0, 16.6, 0, 'gold', 1, 1, 1, 10);
  kit.pop();
}

function buildTianfuPlaza({ THREE: T, site }) {
  const kit = new Kit(T);
  const paving = tianfuPavingTex();
  const groundMat = new T.MeshStandardNodeMaterial({ map: paving, color: 0xffffff, roughness: 0.93, metalness: 0.02 });
  kit.quad(300, 300, 0, 0.04, 0, groundMat, -Math.PI / 2, 0, 0);
  // perimeter kerb / low stone bench wall
  for (const z of [-147, 147]) kit.boxB(300, 0.55, 1.6, 0, 0, z, 'stoneDark');
  for (const x of [-147, 147]) kit.boxB(1.6, 0.55, 300, x, 0, 0, 'stoneDark');

  // ---- 太阳神鸟 roundel (a 33 m granite disc) + fountain ring
  const birdMat = new T.MeshStandardNodeMaterial({
    map: sunBirdTex(), color: 0xffffff, roughness: 0.5, metalness: 0.35,
    emissive: 0x2a1b07, emissiveIntensity: 0.28,
  });
  kit.mesh(new T.CircleGeometry(33, 72), birdMat, 0, 0.3, 0, -Math.PI / 2, 0, 0);
  kit.torus(33.3, 0.3, 0, 0.36, 0, 'stoneLight', Math.PI / 2, 0, 0, 72, 6);
  // basin ring + water surface
  const waterMat = new T.MeshStandardNodeMaterial({ color: 0x2f6b78, roughness: 0.08, metalness: 0.45, transparent: true, opacity: 0.94, emissive: 0x0a2c33, emissiveIntensity: 0.3 });
  kit.mesh(new T.RingGeometry(34, 40.2, 72, 1), waterMat, 0, 0.24, 0, -Math.PI / 2, 0, 0);
  kit.add(new T.CylinderGeometry(41.0, 41.0, 0.42, 72, 1, true), 'stoneDark', 0, 0.23, 0);
  kit.add(new T.CylinderGeometry(33.9, 33.9, 0.24, 72, 1, true), 'stoneLight', 0, 0.36, 0);
  kit.torus(41.1, 0.3, 0, 0.55, 0, 'stoneLight', Math.PI / 2, 0, 0, 72, 6);
  // fountain jets (instanced) + droplets + base lights
  const jetGeo = new T.CylinderGeometry(0.2, 0.42, 1, 8, 1, true);
  kit.instGeo('jet', jetGeo, 'waterJet');
  kit.instGeo('droplet', new T.SphereGeometry(1, 6, 4), 'waterJet');
  kit.instGeo('jetLight', new T.CylinderGeometry(0.28, 0.34, 0.22, 8), 'litCool');
  const rj = 37.2;
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU;
    const h = 8.0 + 5.4 * (0.5 + 0.5 * Math.sin(i * 1.7));
    const x = Math.cos(a) * rj, z = Math.sin(a) * rj;
    kit.instAdd('jet', x, 0.3 + h / 2, z, -a, 1, h, 1);
    kit.instAdd('droplet', x, 0.35 + h, z, 0, 0.7, 0.55, 0.7);
    kit.instAdd('jetLight', x, 0.45, z, -a, 1, 1, 1);
  }

  // ---- 汉阙-like gate pillars flanking the north and south approaches
  for (const z of [-122, 122]) for (const x of [-40, 40]) hanQue(kit, x, z);

  // ---- symmetrical planters, lawns and tree groves
  const planter = (x, z, w, d, ry = 0) => {
    kit.boxB(w, 0.55, d, x, 0, z, 'stoneDark', ry);
    kit.boxB(w - 0.9, 0.38, d - 0.9, x, 0.55, z, 'stone', ry);
    kit.boxB(w - 1.6, 0.9, d - 1.6, x, 0.85, z, 'hedge', ry);
  };
  const groves = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    planter(sx * 86, sz * 50, 36, 14);
    planter(sx * 50, sz * 86, 14, 36);
    groves.push([sx * 80, sz * 50, 1.35, sx * 2 + sz]);
    groves.push([sx * 50, sz * 80, 1.25, sx + sz * 3]);
    groves.push([sx * 105, sz * 100, 1.45, sx * 4 + sz]);
    groves.push([sx * 108, sz * 62, 1.25, sx * 5 + sz]);
  }
  // perimeter trees
  for (let x = -132; x <= 132; x += 22) {
    groves.push([x, 136, 0.95, x * 0.03]);
    groves.push([x, -136, 1.0, x * 0.05]);
  }
  for (let z = -96; z <= 96; z += 24) {
    groves.push([131, z, 0.95, z]);
    groves.push([-131, z, 1.0, z + 1]);
  }
  // four broad lawns in the corners, with stone kerbs
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    kit.boxB(62, 0.32, 34, sx * 82, 0, sz * 82, 'stoneLight');
    kit.boxB(60, 0.3, 32, sx * 82, 0.32, sz * 82, 'hedge');
    kit.boxB(26, 0.4, 3.2, sx * 82, 0, sz * 64, 'stone');
  }
  trees(kit, groves, 1.15);
  // low hedges hugging the east / west edges
  for (const sx of [-1, 1]) {
    for (let z = -30; z <= 30; z += 20) {
      kit.boxB(3.4, 0.75, 14, sx * 139, 0, z, 'hedge');
      kit.boxB(4.0, 0.35, 15, sx * 139, 0, z, 'stoneDark');
    }
  }

  // ---- generic festival pennants (four plain colours, no emblems)
  const flagShape = new T.Shape();
  flagShape.moveTo(0, 0);
  flagShape.lineTo(3.4, 0.5);
  flagShape.lineTo(0, 1.9);
  flagShape.closePath();
  const flagGeo = new T.ShapeGeometry(flagShape);
  kit.instGeo('pole', new T.CylinderGeometry(0.09, 0.14, 11.0, 6), 'steel');
  for (const [nm, key] of [['flagA', 'flagA'], ['flagB', 'flagB'], ['flagC', 'flagC'], ['flagD', 'flagD']]) {
    kit.instGeo(nm, flagGeo, key);
  }
  let fi = 0;
  const addFlag = (x, z, ry) => {
    kit.instAdd('pole', x, 5.5, z, 0, 1, 1, 1);
    const nm = ['flagA', 'flagB', 'flagC', 'flagD'][fi++ % 4];
    kit.instAdd(nm, x, 8.7, z, ry, 1, 1, 1);
  };
  for (let x = -120; x <= 120; x += 20) { addFlag(x, 140, 0); addFlag(x, -140, Math.PI); }
  for (let z = -72; z <= 72; z += 20) { addFlag(140, z, Math.PI / 2); addFlag(-140, z, -Math.PI / 2); }

  // ---- benches and twin-lantern plaza lights
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + 0.1;
    const x = Math.cos(a) * 54, z = Math.sin(a) * 54;
    kit.box(3.2, 0.22, 1.15, x, 0.56, z, 'wood', -a);
    for (const s of [-1, 1]) kit.boxB(0.18, 0.5, 0.95, x + Math.cos(a + Math.PI / 2) * 0.8 * s, 0, z + Math.sin(a + Math.PI / 2) * 0.8 * s, 'stoneDark', -a);
    kit.cylB(0.24, 0.3, 0.5, 8, x - Math.cos(a) * 4.6, 0, z - Math.sin(a) * 4.6, 'stoneDark');
  }
  const lampSpots = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + Math.PI / 10;
    lampSpots.push([Math.cos(a) * 64, Math.sin(a) * 64, i]);
  }
  for (const [x, z] of lampSpots) {
    kit.cylB(0.16, 0.26, 7.4, 8, x, 0, z, 'darkSteel');
    kit.box(2.0, 0.14, 0.14, x, 7.4, z, 'darkSteel');
    for (const s of [-1, 1]) {
      kit.cylB(0.34, 0.42, 0.55, 8, x + s * 0.95, 7.0, z, 'litCool');
      kit.cylB(0.5, 0.55, 0.14, 8, x + s * 0.95, 7.55, z, 'darkSteel');
    }
  }

  // ---- small stone stele with the square's name (no political symbols)
  kit.boxB(2.4, 0.5, 1.4, -24, 0, 94, 'stoneDark');
  kit.boxB(1.8, 3.2, 0.55, -24, 0.5, 94, 'stoneLight');
  const sm = signMaterial(T, '天府广场', { px: 192, py: 512, bg: '#4a4337', fg: '#e4d3a8', vertical: true, fontWeight: 600, border: 'rgba(198,160,82,.35)', emissive: 0.12 });
  kit.quad(1.15, 2.4, -24, 2.1, 94.29, sm);

  return finishLM(kit, site, 300, 300, 19);
}

// =============================================================================================
// 5 · 四川科技馆 — the 1969 monumental hall on the north side of 天府广场: stepped facade,
// tall colonnade, beige stone, flat roof, central pediment and a flag-less mast.
// Nominal footprint 150 × 110 m.
// =============================================================================================
function buildScienceMuseum({ THREE: T, site }) {
  const kit = new Kit(T);
  // plaza + symmetrical steps (the whole composition sits on y = 0)
  kit.boxB(148, 0.5, 106, 0, 0, 0, 'stoneLight');
  for (let i = 0; i < 5; i++) {
    kit.boxB(112 - i * 2, 0.34, 2.2, 0, i * 0.1, 48.2 - i * 1.9, 'stone');
  }
  kit.boxB(148, 0.6, 14, 0, 0, 45, 'stone');
  // main mass (recessed behind the colonnade)
  kit.boxB(120, 22.8, 70, 0, 1.5, -7, 'beige');
  kit.boxB(120, 3.2, 70.8, 0, 24.3, -7, 'stoneLight');
  kit.boxB(122, 0.9, 72, 0, 27.5, -7, 'stone');
  // side wings, stepped down and set back
  for (const sx of [-1, 1]) {
    kit.boxB(14, 17.4, 60, sx * 67, 1.5, -9, 'beige');
    kit.boxB(14.8, 1.4, 61, sx * 67, 18.9, -9, 'stoneLight');
    kit.boxB(15.4, 0.7, 62, sx * 67, 20.3, -9, 'stone');
    // window slots on the wing's front
    for (let i = 0; i < 3; i++) {
      kit.box(2.4, 7.0, 0.18, sx * 67 + (i - 1) * 3.6, 9.2, 21.1, 'glassDeep');
      kit.box(2.8, 0.4, 0.5, sx * 67 + (i - 1) * 3.6, 12.9, 21.1, 'stoneLight');
    }
  }
  // ---- colonnade: 12 square columns + entablature across the front
  const colZ = 33.0;
  for (let i = 0; i < 12; i++) {
    const x = -49.5 + i * 9;
    kit.boxB(1.25, 0.55, 1.25, x, 1.5, colZ, 'stoneDark');
    kit.boxB(0.95, 15.0, 0.95, x, 1.7, colZ, 'stoneLight');
    kit.boxB(1.35, 0.45, 1.35, x, 16.7, colZ, 'stone');
  }
  kit.boxB(112, 2.0, 5.2, 0, 17.15, colZ, 'stoneLight');
  kit.box(114, 0.7, 6.0, 0, 19.5, colZ, 'stone');
  kit.box(112, 0.5, 5.6, 0, 20.1, colZ, 'stoneLight');
  // tall bronze-framed windows behind the columns
  for (let i = 0; i < 11; i++) {
    const x = -45 + i * 9;
    kit.box(4.6, 8.6, 0.25, x, 11.0, 28.2, 'glassDeep');
    kit.box(5.2, 0.35, 0.6, x, 15.4, 28.2, 'stoneDark');
    kit.box(0.35, 8.6, 0.6, x - 2.3, 11.0, 28.2, 'stoneDark');
    kit.box(0.35, 8.6, 0.6, x + 2.3, 11.0, 28.2, 'stoneDark');
  }
  // ---- central portico with 6 taller columns and a low pediment
  const pz = 35.6;
  for (let i = 0; i < 6; i++) {
    const x = -15 + i * 6;
    kit.boxB(1.35, 0.6, 1.35, x, 1.5, pz, 'stoneDark');
    kit.boxB(1.05, 18.0, 1.05, x, 1.8, pz, 'stoneLight');
    kit.boxB(1.5, 0.5, 1.5, x, 19.8, pz, 'stone');
  }
  kit.boxB(40, 2.2, 6.0, 0, 20.3, pz, 'stoneLight');
  kit.box(42, 0.8, 6.8, 0, 22.8, pz, 'stone');
  // pediment: recessed tympanum, stone raking cornice and a bronze disc
  kit.tri(42, 6.7, 0, 23.3, pz + 3.7, 'stoneLight');
  kit.tri(35, 5.1, 0, 23.45, pz + 3.78, 'stone');
  const rake = Math.atan(6.7 / 21);
  const rakeLen = Math.hypot(21, 6.7);
  for (const sgn of [-1, 1]) {
    kit.box(rakeLen + 1.2, 0.58, 1.3, sgn * 10.5, 23.3 + 3.35, pz + 3.95, 'stone', 0, 0, -sgn * rake);
  }
  kit.box(43, 0.65, 1.3, 0, 23.35, pz + 3.95, 'stone');
  kit.sphere(2.2, 0, 26.1, pz + 3.86, 'bronze', 1, 1, 0.16, 20);
  kit.torus(2.2, 0.22, 0, 26.1, pz + 3.92, 'stone', 0, 0, 0, 24, 6);
  // stepped attic behind the pediment
  kit.boxB(34, 4.6, 20, 0, 27.4, -10, 'beige');
  kit.boxB(36, 0.7, 22, 0, 32.0, -10, 'stoneLight');
  kit.boxB(28, 2.2, 15, 0, 32.7, -10, 'stone');
  // glazed bronze entrance doors under the portico
  kit.boxB(22, 6.4, 0.3, 0, 1.5, 30.7, 'glassDeep');
  for (let i = 0; i < 5; i++) kit.boxB(0.3, 6.4, 0.5, -10 + i * 5, 1.5, 30.8, 'bronze');
  const sciSign = signMaterial(T, '四川科技馆', { px: 768, py: 160, bg: '#8a7d63', fg: '#2c261c', vertical: false, fontWeight: 700, border: 'rgba(60,50,35,.5)', emissive: 0.05 });
  kit.quad(13, 2.7, 0, 21.5, pz + 3.46, sciSign);
  // ---- attic / roof pavilion and flag-less mast
  kit.boxB(44, 4.4, 26, 0, 28.4, -8, 'beige');
  kit.boxB(46, 0.7, 28, 0, 32.8, -8, 'stoneLight');
  kit.boxB(38, 1.1, 21, 0, 33.5, -8, 'stone');
  kit.boxB(10, 3.2, 8, 0, 34.6, -8, 'stoneLight');
  kit.cylB(0.22, 0.38, 15.5, 8, 0, 37.8, -8, 'steel');
  kit.cylB(0.55, 0.75, 1.2, 8, 0, 36.8, -8, 'darkSteel');
  kit.sphere(0.28, 0, 53.5, -8, 'darkSteel', 1, 1, 1, 8);
  // roof parapet
  for (const dz of [-41, 27]) kit.boxB(120, 1.0, 1.1, 0, 27.8, dz, 'stone');
  for (const dx of [-60, 60]) kit.boxB(1.1, 1.0, 68, dx, 27.8, -7, 'stone');
  // warm pavement in front + hedges / trees flanking the steps
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x = sx * (84 + i * 8);
      kit.boxB(6.5, 0.4, 26, x, 0, 24, 'stoneDark');
      kit.boxB(5.5, 1.0, 24, x, 0.4, 24, 'hedge');
    }
    kit.boxB(20, 0.45, 8, sx * 54, 0, 42, 'stone');
    trees(kit, [[sx * 55, 44, 1.15, sx], [sx * 70, 40, 0.95, sx + 2]], 1.0);
  }
  // modest entrance lamps
  for (const x of [-20, 20]) {
    kit.cylB(0.22, 0.3, 3.4, 8, x, 1.5, 42, 'darkSteel');
    kit.cylB(0.38, 0.45, 0.7, 8, x, 4.7, 42, 'lit');
  }

  return finishLM(kit, site, 150, 110, 54);
}


// =============================================================================================
// 6 · 成都博物馆 — five-storey angular brass volume wrapped in a woven diamond lattice, dark
// glass base, entrance canopy and roof pavilion. Nominal footprint 110 × 90 m.
// =============================================================================================
function diagBarsZ(kit, x0, x1, y0, y1, z, key = 'gold', spacing = 5.4, thick = 0.2, depth = 0.34) {
  const step = spacing * Math.SQRT2;
  for (let c = x0 - y1; c <= x1 - y0; c += step) {
    const xa = Math.max(x0, y0 + c), xb = Math.min(x1, y1 + c);
    if (xb - xa < 0.5) continue;
    kit.box((xb - xa) * Math.SQRT2, thick, depth, (xa + xb) / 2, (xa + xb) / 2 - c, z, key, 0, 0, Math.PI / 4);
  }
  for (let c = x0 + y0; c <= x1 + y1; c += step) {
    const xa = Math.max(x0, c - y1), xb = Math.min(x1, c - y0);
    if (xb - xa < 0.5) continue;
    kit.box((xb - xa) * Math.SQRT2, thick, depth, (xa + xb) / 2, c - (xa + xb) / 2, z, key, 0, 0, -Math.PI / 4);
  }
}

function diagBarsX(kit, z0, z1, y0, y1, x, key = 'gold', spacing = 5.4, thick = 0.2, depth = 0.34) {
  const step = spacing * Math.SQRT2;
  // family 1: y = z + c
  for (let c = y0 - z1; c <= y1 - z0; c += step) {
    const za = Math.max(z0, y0 - c), zb = Math.min(z1, y1 - c);
    if (zb - za < 0.5) continue;
    const zc = (za + zb) / 2;
    kit.box(thick, thick, (zb - za) * Math.SQRT2, x, zc + c, zc, key, 0, -Math.PI / 4, 0);
  }
  // family 2: y = -z + c
  for (let c = y0 + z0; c <= y1 + z1; c += step) {
    const za = Math.max(z0, c - y1), zb = Math.min(z1, c - y0);
    if (zb - za < 0.5) continue;
    const zc = (za + zb) / 2;
    kit.box(thick, thick, (zb - za) * Math.SQRT2, x, c - zc, zc, key, 0, Math.PI / 4, 0);
  }
}

function buildChengduMuseum({ THREE: T, site }) {
  const kit = new Kit(T);
  // stone plaza + three broad steps
  kit.boxB(104, 0.35, 84, 0, 0, 0, 'stoneLight');
  for (let i = 0; i < 3; i++) kit.boxB(64, 0.28, 1.7, 0, i * 0.28, 34 - i * 1.6, 'stone');
  // dark glass base, recessed under the brass mass
  kit.boxB(78, 5.2, 56, 0, 0.35, -2, 'glassDeep');
  for (let x = -37; x <= 37; x += 5) {
    kit.box(0.22, 5.0, 0.22, x, 2.9, 26.1, 'darkSteel');
    kit.box(0.22, 5.0, 0.22, x, 2.9, -30.1, 'darkSteel');
  }
  kit.box(64, 2.2, 0.18, 0, 2.0, 26.15, 'lit');
  // the angular brass volume (chamfered south-east corner) extruded 41 m
  const plan = [[-42, 31], [42, 31], [42, -6], [20, -31], [-42, -31]];
  const shape = new T.Shape();
  shape.moveTo(plan[0][0], plan[0][1]);
  for (let i = 1; i < plan.length; i++) shape.lineTo(plan[i][0], plan[i][1]);
  shape.closePath();
  const mass = new T.ExtrudeGeometry(shape, { depth: 41, bevelEnabled: false, curveSegments: 1 });
  mass.rotateX(-Math.PI / 2);
  kit.add(mass, 'brassWall', 0, 5.2, 0);
  // horizontal brass string courses on the flat faces
  for (const y of [12, 20, 28, 36, 43.5]) {
    kit.box(84, 0.55, 0.6, 0, y, 31.15, 'gold');
    kit.box(62, 0.55, 0.6, -11, y, -31.15, 'gold');
    kit.box(0.6, 0.55, 60, -42.2, y, 0, 'gold');
    kit.box(0.6, 0.55, 37, 42.2, y, 12.5, 'gold');
  }
  // vertical bronze fins at the flat-face edges
  for (const x of [-41.8, -14, 14, 41.8]) kit.box(0.7, 41, 0.7, x, 25.7, 31.3, 'bronze');
  for (const x of [-41.8, 19.2]) kit.box(0.7, 41, 0.7, x, 25.7, -31.3, 'bronze');
  for (const z of [-5.2, 12.6, 30.4]) kit.box(0.7, 41, 0.7, 42.3, 25.7, z, 'bronze');

  // woven diamond lattice, front / back / west / east + the chamfer face
  diagBarsZ(kit, -41.4, 41.4, 6.2, 45.4, 31.35, 'lattice', 2.9, 0.11, 0.22);
  diagBarsZ(kit, -41.4, 19, 6.2, 45.4, -31.35, 'lattice', 2.9, 0.11, 0.22);
  diagBarsX(kit, -30.4, 30.4, 6.2, 45.4, -42.3, 'lattice', 2.9, 0.11, 0.22);
  diagBarsX(kit, -5.6, 30.6, 6.2, 45.4, 42.3, 'lattice', 2.9, 0.11, 0.22);
  // bronze edge trim on the NE chamfer (visible only from the north side)
  for (const yy of [12, 24, 36, 6.2]) {
    kit.box(33.3, 0.5, 0.45, 31, yy, -18.5, 'gold', 2.29);
  }
  // narrow slit windows on the south face
  for (const [y, w] of [[13, 26], [23, 30], [33, 22]]) {
    kit.box(w, 1.1, 0.3, -8, y, 31.45, 'glassDeep');
    kit.box(w + 1.2, 0.35, 0.5, -8, y + 0.8, 31.5, 'bronze');
  }
  // entrance canopy and doors
  kit.box(30, 0.55, 9, 0, 6.3, 33.5, 'bronze');
  for (const x of [-13, 13]) kit.cylB(0.28, 0.34, 5.9, 8, x, 0.35, 37.3, 'bronze');
  kit.boxB(22, 4.8, 0.25, 0, 0.35, 26.4, 'glassDeep');
  for (let i = 0; i < 5; i++) kit.boxB(0.28, 4.8, 0.4, -10 + i * 5, 0.35, 26.5, 'bronze');
  kit.box(18, 0.5, 5, 0, 5.6, 28.5, 'gold');
  // roof pavilion, parapet and skylight
  kit.boxB(62, 5.6, 44, -4, 46.2, -1, 'brassWall');
  kit.boxB(64, 0.65, 46, -4, 51.8, -1, 'stoneLight');
  for (const y of [48, 50]) kit.box(62.5, 0.3, 44.5, -4, y, -1, 'gold');
  kit.boxB(20, 2.0, 12, -16, 52.4, -1, 'glassDeep');
  kit.boxB(21, 0.4, 13, -16, 54.4, -1, 'steel');
  // rooftop terrace rail
  for (const dz of [-23.5, 21.5]) kit.boxB(62, 0.9, 0.5, -4, 52.4, dz, 'bronze');
  // name plaque
  const sm = signMaterial(T, '成都博物馆', { px: 768, py: 160, bg: '#2a2118', fg: '#e4c68a', vertical: false, fontWeight: 700, border: 'rgba(198,160,82,.5)', emissive: 0.35 });
  kit.quad(11.5, 2.4, 4, 8.9, 31.7, sm);
  // flanking planters and trees
  for (const sx of [-1, 1]) {
    kit.boxB(16, 0.55, 6, sx * 44, 0, 38, 'stoneDark');
    kit.boxB(15, 0.8, 5, sx * 44, 0.55, 38, 'hedge');
    trees(kit, [[sx * 43, 40, 1.15, sx], [sx * 50, 30, 1.0, sx + 2]], 1.0);
  }

  return finishLM(kit, site, 110, 90, 55);
}

// =============================================================================================
// 7 · 九眼桥 — nine stone arches over the 锦江, stone balustrade, and the bar street with
// neon-style CJK signs on the east bank. Nominal footprint 170 × 100 m.
// =============================================================================================
function waterTexture() {
  return canvasTex('riverWater', 512, 512, (c, W, H) => {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#31565c');
    g.addColorStop(0.45, '#3e6a70');
    g.addColorStop(1, '#29494f');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // fade the long edges into the city ground, so the channel reads as a river, not a tank
    c.globalCompositeOperation = 'destination-out';
    const fade = c.createLinearGradient(0, 0, 0, H);
    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(0.12, 'rgba(0,0,0,0)');
    fade.addColorStop(0.88, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = fade;
    c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 130; i++) {
      const y = Math.random() * H;
      c.strokeStyle = `rgba(190,225,225,${0.025 + Math.random() * 0.06})`;
      c.lineWidth = 0.8 + Math.random() * 1.6;
      c.beginPath();
      c.moveTo(Math.random() * W, y);
      c.bezierCurveTo(W * 0.3, y + 4, W * 0.7, y - 5, W, y + 2);
      c.stroke();
    }
  }, true);
}

function buildJiuyanBridge({ THREE: T, site }) {
  const kit = new Kit(T);
  const waterY = 0.06;
  // quays + paving, with the river channel down the middle (bridge spans east–west)
  const pav = pavingTex('jiuyanPaving', '#8c877c', 'rgba(52,48,42,.4)', 56, true);
  pav.repeat.set(18, 10);
  const quayMat = new T.MeshStandardNodeMaterial({ map: pav, color: 0xffffff, roughness: 0.94, metalness: 0.02 });
  kit.quad(46, 100, 58, 0.2, 0, quayMat, -Math.PI / 2, 0, 0);
  kit.quad(46, 100, -58, 0.2, 0, quayMat, -Math.PI / 2, 0, 0);
  // river bed watermark under the water (avoids seeing the plain plane through gaps)
  const wtex = waterTexture();
  wtex.repeat.set(2, 7);
  const waterMat = new T.MeshStandardNodeMaterial({ map: wtex, color: 0x9fb9b9, roughness: 0.16, metalness: 0.38, transparent: true, opacity: 0.95, emissive: 0x0a2024, emissiveIntensity: 0.22 });
  kit.quad(70, 240, 0, waterY, 0, waterMat, -Math.PI / 2, 0, 0);
  // embankment walls and copings
  for (const sx of [-1, 1]) {
    kit.boxB(1.5, 1.1, 240, sx * 35.3, 0, 0, 'stoneWall');
    kit.boxB(2.1, 0.25, 240, sx * 35.3, 1.0, 0, 'stoneLight');
    // riverside walk strip
    kit.boxB(5.5, 0.2, 100, sx * 38.3, 0.2, 0, 'stone');
    for (let z = -54; z <= 54; z += 18) {
      kit.cylB(0.16, 0.22, 4.4, 6, sx * 38, 0.3, z, 'darkSteel');
      kit.sphere(0.36, sx * 38, 4.6, z, 'litCool', 1, 1, 1, 8);
    }
  }

  // ---- nine arches: centres at -28.8 … 28.8, 7.2 m spacing
  const spring = 0.65, rO = 3.15, rI = 2.55, deckY = 6.0;
  const archShape = new T.Shape();
  archShape.moveTo(rO, 0);
  archShape.absarc(0, 0, rO, 0, Math.PI, false);
  archShape.lineTo(-rI, 0);
  archShape.absarc(0, 0, rI, Math.PI, 0, true);
  archShape.closePath();
  const archGeo = new T.ExtrudeGeometry(archShape, { depth: 12, bevelEnabled: false, curveSegments: 14 });
  archGeo.translate(0, 0, -6);
  for (let i = 0; i < 9; i++) {
    const cx = -28.8 + i * 7.2;
    kit.add(archGeo.clone(), 'stoneWall', cx, spring, 0);
    // spandrel above the arch
    kit.boxB(6.3, deckY - (spring + rO), 12, cx, spring + rO, 0, 'stoneWall');
    // keystone
    kit.box(0.9, 0.75, 12.35, cx, spring + rO - 0.1, 0, 'stoneLight');
  }
  // piers between the arches + end abutments
  for (let i = 0; i < 8; i++) {
    const cx = -25.2 + i * 7.2;
    kit.boxB(0.95, deckY, 12.2, cx, 0, 0, 'stoneWall');
    kit.box(1.2, 0.5, 12.4, cx, 0.5, 0, 'stoneLight');
  }
  for (const sx of [-1, 1]) {
    kit.boxB(18.2, deckY, 12.4, sx * 41.1, 0, 0, 'stoneWall');
    kit.boxB(18.4, 0.6, 12.8, sx * 41.1, deckY - 0.6, 0, 'stoneLight');
  }
  // deck, cornice, approach ramps
  kit.boxB(100, 0.7, 13.0, 0, deckY - 0.35, 0, 'stoneWall');
  kit.box(101, 0.5, 13.6, 0, deckY + 0.55, 0, 'stoneLight');
  for (const sx of [-1, 1]) {
    kit.box(11.8, 0.55, 12.8, sx * 55.5, 3.4, 0, 'stoneWall', 0, 0, sx * 0.43);
    kit.box(11.8, 0.35, 13.2, sx * 55.5, 3.95, 0, 'stoneLight', 0, 0, sx * 0.43);
    for (const sz of [-1, 1]) kit.box(11.8, 0.8, 0.45, sx * 55.5, 4.45, sz * 6.3, 'stoneLight', 0, 0, sx * 0.43);
  }
  // stone balustrade: posts, panels, handrail
  for (const sz of [-1, 1]) {
    const z = sz * 6.35;
    for (let x = -49; x <= 49; x += 2.45) {
      kit.boxB(0.42, 1.15, 0.42, x, deckY + 0.8, z, 'stoneLight');
      kit.boxB(0.55, 0.22, 0.55, x, deckY + 1.95, z, 'stoneWall');
      if (x < 49) kit.box(2.05, 0.75, 0.16, x + 1.22, deckY + 1.3, z, 'stoneWall');
    }
    kit.box(99, 0.28, 0.55, 0, deckY + 2.2, z, 'stoneLight');
    // larger posts at the ends
    for (const sx of [-1, 1]) {
      kit.boxB(0.85, 1.6, 0.85, sx * 49.5, deckY + 0.8, z, 'stoneLight');
      kit.sphere(0.42, sx * 49.5, deckY + 2.6, z, 'stoneWall', 1, 1, 1, 8);
    }
  }
  // name plaque on the south balustrade
  const bridgeSign = signMaterial(T, '九眼桥', { px: 512, py: 160, bg: '#6d6557', fg: '#2c261c', vertical: false, fontWeight: 700, border: 'rgba(45,38,28,.6)', emissive: 0.04 });
  kit.quad(4.6, 1.25, 0, deckY + 2.2, 6.75, bridgeSign);

  // ---- bar street on the east bank (facing the river), neon-style signs
  const bars = [
    { x: 61, z: -24, w: 34, d: 18, h: 14, key: 0 },
    { x: 67, z: 16, w: 28, d: 17, h: 17, key: 1 },
    { x: 51, z: 40, w: 18, d: 13, h: 9, key: 2 },
  ];
  const names = [
    { t: '九眼桥·夜泊', bg: '#0c1418', fg: '#ff5c4a', neon: true, em: 1.8 },
    { t: '江畔清吧', bg: '#081216', fg: '#5ff0d0', neon: true, em: 1.7 },
    { t: '民谣酒馆', bg: '#130b10', fg: '#ff8ccb', neon: true, em: 1.7 },
    { t: '锦江夜话', bg: '#0d1117', fg: '#ffd479', neon: true, em: 1.7 },
    { t: '微醺', bg: '#101013', fg: '#8fc8ff', neon: true, em: 1.7 },
  ];
  bars.forEach((b, bi) => {
    kit.boxB(b.w + 2, 0.55, b.d + 2, b.x, 0.2, b.z, 'stoneDark');
    kit.boxB(b.w, b.h, b.d, b.x, 0.75, b.z, bi === 1 ? 'brickDark' : 'darkSteel');
    // glass river front + lit floors
    kit.box(b.w - 2, b.h - 4.2, 0.18, b.x, 0.75 + (b.h - 4.2) / 2 + 2.0, b.z - b.d / 2 - 0.1, 'glassDeep');
    for (let f = 0; f < Math.floor((b.h - 2) / 4); f++) {
      kit.box(b.w - 4, 1.4, 0.14, b.x, 3.2 + f * 4.0, b.z - b.d / 2 - 0.2, 'litWarm');
    }
    // ground floor bar front, timber and warm light
    kit.boxB(b.w - 2, 3.0, 0.24, b.x, 0.75, b.z - b.d / 2 - 0.15, 'woodDark');
    kit.box(b.w - 5, 1.8, 0.1, b.x, 2.0, b.z - b.d / 2 - 0.29, 'litWarm');
    // roof terrace parapet + canopy
    kit.boxB(b.w, 0.9, b.d, b.x, b.h + 0.75, b.z, 'stoneDark');
    kit.box(b.w + 1.6, 0.3, b.d + 1.6, b.x, b.h + 1.1, b.z, 'roofSlateDark');
    for (let f = 0; f < 2; f++) {
      const s = names[(bi * 2 + f) % names.length];
      const sw = 1.5, sh = f === 0 ? 5.8 : 4.2;
      const sx = b.x - b.w / 2 - 0.15;
      const sz = b.z + (f === 0 ? -3 : 5);
      const sm = signMaterial(T, s.t, { px: 192, py: 640, bg: s.bg, fg: s.fg, vertical: true, fontWeight: 800, border: 'rgba(255,255,255,.1)', neon: s.neon, emissive: s.em });
      kit.mesh(new T.PlaneGeometry(sw, sh), sm, sx, 3.6 + sh / 2, sz, 0, -Math.PI / 2, 0);
      kit.box(0.2, sh + 0.25, sw + 0.25, sx + 0.12, 3.6 + sh / 2, sz, 'darkSteel');
      // neon tube frame
      kit.boxB(0.09, sh + 0.4, 0.09, sx - 0.06, 3.4, sz - sw / 2 - 0.15, 'neonRed');
      kit.boxB(0.09, sh + 0.4, 0.09, sx - 0.06, 3.4, sz + sw / 2 + 0.15, 'neonRed');
    }
    // south face: warm windows, awnings and a second sign so the block reads from the bridge
    for (let f = 1; f < 3; f++) {
      kit.box(b.w * 0.7, 1.7, 0.16, b.x, 3.6 + f * 4.2, b.z + b.d / 2 + 0.12, 'lit');
      for (let g = -1; g <= 1; g++) kit.boxB(0.22, 4.0, 0.22, b.x + g * b.w * 0.28, 1.0, b.z + b.d / 2 + 0.2, 'darkSteel');
    }
    kit.box(b.w + 2, 0.35, 2.6, b.x, 4.0, b.z + b.d / 2 + 1.1, 'roofSlateDark');
    const hs = names[(bi + 3) % names.length];
    const hsm = signMaterial(T, hs.t, { px: 768, py: 192, bg: hs.bg, fg: hs.fg, vertical: false, fontWeight: 800, border: 'rgba(255,255,255,.1)', neon: true, emissive: hs.em });
    kit.quad(b.w * 0.62, 2.0, b.x, b.h - 3.2, b.z + b.d / 2 + 0.22, hsm);
    // rooftop string lights
    if (bi < 2) lanternString(kit, [b.x - b.w / 2 + 1, b.h + 2.4, b.z + b.d / 2], [b.x + b.w / 2 - 1, b.h + 2.4, b.z + b.d / 2], 5, 0.6, 0.3);
    trees(kit, [[b.x + b.w / 2 + 4, b.z - b.d / 2 + 2, 0.9, bi], [b.x + b.w / 2 + 3, b.z + b.d / 2 - 2, 0.8, bi + 2]], 0.9);
    lanternString(kit, [b.x - b.w / 2 + 2, 5.2, b.z - b.d / 2 - 0.6], [b.x + b.w / 2 - 2, 5.2, b.z - b.d / 2 - 0.6], 4, 0.5, 0.3);
  });
  // west bank: stone stele + willows, small pavilion
  kit.boxB(3.2, 0.6, 1.8, -44, 0.2, -18, 'stoneDark');
  kit.boxB(2.4, 3.0, 0.7, -44, 0.8, -18, 'stoneLight');
  const ws = signMaterial(T, '锦江', { px: 192, py: 512, bg: '#5f594d', fg: '#e0cfa4', vertical: true, fontWeight: 600, border: 'rgba(40,35,26,.5)', emissive: 0.05 });
  kit.quad(1.4, 2.2, -44, 2.2, -17.6, ws);
  kit.boxB(10, 0.4, 8, -46, 0.2, 30, 'stoneDark');
  kit.boxB(8, 3.4, 6, -46, 0.6, 30, 'woodDark');
  kit.boxB(9.6, 0.8, 7.6, -46, 3.9, 30, 'roofSlateDark');
  trees(kit, [[-48, -30, 1.2, 1], [-51, 12, 1.0, 3], [-42, 42, 0.95, 2], [-40, -8, 0.9, 0]], 1.15);
  // lanterns along the east quay
  for (let z = -45; z <= 45; z += 22) lanternString(kit, [46, 6.0, z], [46, 6.0, Math.min(60, z + 18)], 3, 0.4, 0.32);

  return finishLM(kit, site, 170, 100, 20);
}


// =============================================================================================
// 8 · 春熙路 — pedestrian shopping street: arcaded 4–6 storey commercial blocks, projecting
// vertical CJK signboards, a planted central mall, strings of lanterns and a panda mascot.
// Nominal footprint 220 × 80 m.
// =============================================================================================
function sittingPanda(kit, x, y, z, s, ry = 0) {
  kit.push(x, y, z, ry, s);
  kit.sphere(0.78, 0, 0.78, 0, 'pandaWhite', 1.0, 1.05, 0.9, 16);
  kit.sphere(0.56, 0, 1.62, 0.06, 'pandaWhite', 1.05, 1.0, 0.95, 16);
  kit.sphere(0.3, 0, 1.42, 0.5, 'pandaWhite', 1.2, 0.8, 0.9, 12);
  kit.sphere(0.11, 0, 1.45, 0.78, 'pandaBlack', 1, 0.75, 0.6, 8);
  kit.sphere(0.23, -0.42, 2.05, 0.0, 'pandaBlack', 1, 1, 0.62, 10);
  kit.sphere(0.23, 0.42, 2.05, 0.0, 'pandaBlack', 1, 1, 0.62, 10);
  kit.sphere(0.17, -0.22, 1.73, 0.47, 'pandaBlack', 0.9, 1.25, 0.35, 10);
  kit.sphere(0.17, 0.22, 1.73, 0.47, 'pandaBlack', 0.9, 1.25, 0.35, 10);
  kit.sphere(0.09, -0.22, 1.75, 0.63, 'pandaGlass', 1, 1, 1, 6);
  kit.sphere(0.09, 0.22, 1.75, 0.63, 'pandaGlass', 1, 1, 1, 6);
  // arms folded in the lap
  kit.bone([-0.55, 1.35, 0.2], [-0.18, 0.72, 0.45], 0.21, 'pandaBlack', 8);
  kit.bone([0.55, 1.35, 0.2], [0.18, 0.72, 0.45], 0.21, 'pandaBlack', 8);
  kit.sphere(0.25, -0.16, 0.7, 0.5, 'pandaBlack', 1, 0.9, 1, 8);
  kit.sphere(0.25, 0.16, 0.7, 0.5, 'pandaBlack', 1, 0.9, 1, 8);
  // feet
  kit.sphere(0.3, -0.38, 0.16, 0.55, 'pandaBlack', 1.1, 0.6, 1.3, 10);
  kit.sphere(0.3, 0.38, 0.16, 0.55, 'pandaBlack', 1.1, 0.6, 1.3, 10);
  kit.pop();
}

function chunxiBlock(kit, opt) {
  const { x, z, w, d, floors, side, mat, name, signA, signB, signBg, signFg } = opt;
  const H = 4.6 + floors * 3.5;
  const front = z + side * (d / 2);
  // solid ground-floor core, recessed 3 m to make the arcade
  kit.boxB(w, 4.6, d - 3.6, x, 0, z - side * 1.3, 'stoneDark');
  kit.boxB(w - 1.2, 0.45, d - 4.2, x, 0, z - side * 1.5, 'stone');
  // shopfront glazing + warm interior (on the core front)
  kit.box(w - 3.0, 3.7, 0.22, x, 2.15, z + side * (d / 2 - 3.05), 'glassTeal');
  kit.box(w - 4.6, 2.7, 0.12, x, 2.05, z + side * (d / 2 - 2.92), 'litWarm');
  // fabric awnings over the shopfront, alternating warm colours
  for (let ax = -w / 2 + 8; ax <= w / 2 - 8; ax += 11) {
    kit.box(8.4, 0.12, 1.5, x + ax, 4.05, front - side * 0.4, (ax / 11) % 2 ? 'flagA' : 'flagC', 0, -side * 0.16, 0);
  }
  // display window bays + dark timber stall frames in the arcade
  for (let dx = -w / 2 + 5; dx <= w / 2 - 5; dx += 8.2) {
    kit.boxB(0.28, 3.4, 0.3, x + dx, 0.3, z + side * (d / 2 - 2.8), 'woodDark');
    kit.box(3.2, 0.2, 0.9, x + dx + 3.8, 3.15, z + side * (d / 2 - 3.4), 'woodDark');
  }
  for (let dx = -w / 2 + 3.2; dx <= w / 2 - 3.2; dx += 4.4) {
    kit.boxB(0.18, 3.9, 0.18, x + dx, 0.1, z + side * (d / 2 - 2.85), 'darkSteel');
  }
  // upper commercial volume, overhanging the arcade
  kit.boxB(w, H - 4.6, d, x, 4.6, z, mat);
  kit.box(w + 0.9, 0.55, d + 0.9, x, 4.85, z, 'stoneLight');
  // arcade columns and the warm soffit
  for (let dx = -w / 2 + 2.2; dx <= w / 2 - 2.2; dx += 5.6) {
    kit.boxB(0.95, 4.6, 0.95, x + dx, 0, front - side * 0.5, 'stoneLight');
    kit.boxB(1.3, 0.25, 1.3, x + dx, 0.1, front - side * 0.5, 'stoneDark');
  }
  kit.box(w - 2, 0.35, 3.8, x, 4.35, z + side * (d / 2 - 1.9), 'woodDark');
  kit.box(w - 4, 0.14, 0.3, x, 4.1, z + side * (d / 2 - 0.7), 'lit');
  // upper floors: windows, sills, pilasters
  for (let f = 0; f < floors; f++) {
    const y = 6.7 + f * 3.5;
    const nWin = Math.max(2, Math.round(w / 9));
    for (let i = 0; i < nWin; i++) {
      const wx = x - w / 2 + (w / nWin) * (i + 0.5);
      kit.box(3.0, 2.0, 0.22, wx, y, front + side * 0.04, 'glassDeep');
      kit.box(2.5, 1.5, 0.1, wx, y + 0.05, front + side * 0.12, f % 2 ? 'litCool' : 'litWarm');
      kit.boxB(0.16, 2.2, 0.26, wx - 1.6, y - 1.1, front + side * 0.08, 'darkSteel');
      kit.boxB(0.16, 2.2, 0.26, wx + 1.6, y - 1.1, front + side * 0.08, 'darkSteel');
      kit.box(3.5, 0.22, 0.5, wx, y - 1.1, front + side * 0.1, 'stoneLight');
    }
    // continuous floor cornice
    kit.box(w + 0.4, 0.25, 0.7, x, y + 1.7, front + side * 0.2, 'stoneLight');
  }
  // parapet + roof gear
  kit.boxB(w + 0.8, 1.0, d + 0.8, x, H, z, 'stone');
  kit.boxB(w + 1.0, 0.3, d + 1.0, x, H + 0.95, z, 'stoneLight');
  kit.boxB(6.5, 2.0, 5.0, x + w * 0.22, H + 1.0, z - side * 3, 'stoneDark');
  kit.boxB(4.0, 1.2, 3.0, x - w * 0.24, H + 1.0, z - side * 2, 'stoneDark');
  // projecting vertical signboard (faces along the street, ±x)
  const sx = x + (w / 2 - 4.0) * (signA ? 1 : -1);
  const sz = front + side * 1.7;
  const sh = Math.min(9.0, H - 5.4);
  const sm = signMaterial(kit.T, name, {
    px: 224, py: 768, bg: signBg || '#7d241c', fg: signFg || '#f2d9a0',
    vertical: true, fontWeight: 800, border: 'rgba(235,205,145,.5)', emissive: 0.55,
  });
  kit.mesh(new kit.T.PlaneGeometry(2.3, sh), sm, sx, 5.2 + sh / 2, sz, 0, Math.PI / 2, 0);
  kit.box(0.25, sh + 0.3, 0.55, sx + 0.16, 5.2 + sh / 2, sz, 'woodDark');
  for (const yy of [5.5, 5.2 + sh]) kit.boxB(0.1, 0.1, 1.7, sx, yy, front + side * 0.9, 'darkSteel');
  // a second, smaller board on the other side of the entrance
  if (signB) {
    const s2m = signMaterial(kit.T, signB, { px: 224, py: 512, bg: '#1c2528', fg: '#e2d2b0', vertical: true, fontWeight: 700, border: 'rgba(200,180,140,.4)', emissive: 0.4 });
    kit.mesh(new kit.T.PlaneGeometry(1.7, 5.2), s2m, sx - 7.5, 9.5, sz, 0, Math.PI / 2, 0);
    kit.box(0.2, 5.5, 0.4, sx - 7.5 + 0.12, 9.5, sz, 'darkSteel');
  }
  // horizontal fascia sign over the arcade
  const fsm = signMaterial(kit.T, name, { px: 768, py: 192, bg: signBg || '#7d241c', fg: signFg || '#f2d9a0', vertical: false, fontWeight: 800, border: 'rgba(235,205,145,.4)', emissive: 0.45 });
  kit.quad(Math.min(10.5, w - 8), 1.5, x - w * 0.12, 5.75, front + side * 0.32, fsm, 0, side > 0 ? 0 : Math.PI, 0);
  // lanterns under the arcade
  for (let dx = -w / 2 + 3; dx <= w / 2 - 3; dx += 6.4) {
    kit.instAdd('lantern', x + dx, 3.8, front - side * 2.6, 0, 0.32, 0.28, 0.32);
  }
}

function buildChunxiRoad({ THREE: T, site }) {
  const kit = new Kit(T);
  if (!kit.parts.has('__inst:lantern')) kit.instGeo('lantern', new T.IcosahedronGeometry(1, 0), 'lantern');
  const pav = pavingTex('chunxiPaving', '#a29a8b', 'rgba(60,55,48,.3)', 60, true);
  pav.repeat.set(16, 6);
  const groundMat = new T.MeshStandardNodeMaterial({ map: pav, color: 0xffffff, roughness: 0.92, metalness: 0.02 });
  kit.quad(220, 80, 0, 0.04, 0, groundMat, -Math.PI / 2, 0, 0);
  // central darker mall band + stone borders
  kit.box(220, 0.1, 9.0, 0, 0.03, 0, 'stoneLight');
  for (const sz of [-1, 1]) kit.box(220, 0.12, 0.6, 0, 0.06, sz * 4.8, 'stoneDark');

  const north = [
    { x: -82, w: 46, floors: 5, mat: 'brickWarm', name: '春熙茶馆', signB: '盖碗茶', signBg: '#7d241c', signFg: '#f4d99e' },
    { x: -30, w: 44, floors: 4, mat: 'beige', name: '蜀锦行', signB: '蜀绣', signBg: '#1e3347', signFg: '#e8ce92' },
    { x: 24, w: 44, floors: 6, mat: 'brick', name: '熊猫文创', signB: '伴手礼', signBg: '#155c57', signFg: '#f1e6c8' },
    { x: 80, w: 46, floors: 5, mat: 'stoneLight', name: '锦城书局', signB: '书店', signBg: '#2f3a2a', signFg: '#efe2bf' },
  ];
  const south = [
    { x: -80, w: 48, floors: 5, mat: 'stoneLight', name: '龙抄手', signB: '小吃', signBg: '#8a2c1f', signFg: '#f5e3b5' },
    { x: -26, w: 42, floors: 6, mat: 'brickWarm', name: '甜水面', signB: '老字号', signBg: '#26452a', signFg: '#efe3c4' },
    { x: 26, w: 44, floors: 4, mat: 'beige', name: '川剧脸谱', signB: '戏园', signBg: '#241a18', signFg: '#e9c47c' },
    { x: 80, w: 44, floors: 5, mat: 'brick', name: '糖油果子', signB: '甜点', signBg: '#7b4a1b', signFg: '#ffe6ae' },
  ];
  for (const b of north) chunxiBlock(kit, { ...b, z: 28.5, d: 23, side: -1, signA: 1 });
  for (const b of south) chunxiBlock(kit, { ...b, z: -28.5, d: 23, side: 1, signA: 0 });

  // one modern glass flagship / department store entrance at the east end
  {
    const x = 110, z = -28, w = 20, d = 22, h = 23;
    kit.boxB(w, h, d, x, 0, z, 'glassDeep');
    for (let f = 0; f < 5; f++) kit.box(w - 2, 1.0, 0.2, x, 3.0 + f * 4.4, z + d / 2 + 0.1, 'litCool');
    for (let f = 0; f <= 5; f++) kit.box(w + 0.8, 0.45, d + 0.8, x, f * 4.4 + 0.4, z, 'steel');
    kit.box(w + 2, 0.8, d + 2, x, h + 0.7, z, 'steel');
  }

  // ---- planted central mall: stone planters, trees, benches, lamps
  const treeSpots = [];
  for (let x = -106; x <= 98; x += 24) {
    kit.boxB(7.0, 0.65, 3.0, x, 0, 0, 'stoneDark');
    kit.boxB(6.2, 0.55, 2.2, x, 0.65, 0, 'hedge');
    treeSpots.push([x - 1.2, 0, 0.94 + 0.16 * Math.sin(x * 0.14), x * 0.02]);
    // benches facing the trees
    kit.box(2.5, 0.18, 0.8, x - 3.8, 0.48, 0, 'wood');
    const bl = [-4.7, -2.9];
    for (const bx of bl) kit.boxB(0.16, 0.46, 0.7, x + bx, 0, 0, 'stoneDark');
    kit.box(2.5, 0.18, 0.8, x + 3.8, 0.48, 0, 'wood');
    for (const bx of [2.9, 4.7]) kit.boxB(0.16, 0.46, 0.7, x + bx, 0, 0, 'stoneDark');
  }
  trees(kit, treeSpots, 0.78);
  // bollards + lamps along the mall
  for (let x = -104; x <= 104; x += 13) {
    for (const sz of [-1, 1]) kit.cylB(0.13, 0.18, 1.0, 8, x, 0, sz * 4.9, 'darkSteel');
    kit.cylB(0.14, 0.2, 6.2, 8, x + 6.5, 0, 0, 'darkSteel');
    kit.cylB(0.3, 0.38, 0.5, 8, x + 6.5, 6.0, 0, 'lit');
  }
  // strings of red lanterns across the street
  for (let x = -96; x <= 96; x += 24) lanternString(kit, [x, 8.6, -16.6], [x, 8.6, 16.6], 5, 1.0, 0.36);
  // panda mascot on a stone plinth near the middle of the mall
  kit.boxB(3.2, 0.65, 3.2, 8, 0, 6.2, 'stoneDark');
  kit.boxB(2.6, 0.45, 2.6, 8, 0.65, 6.2, 'stoneLight');
  sittingPanda(kit, 8, 1.1, 6.2, 1.65, -0.3);
  // a few planters with flowers for colour
  for (const x of [-64, 20, 85]) {
    kit.boxB(4.6, 0.5, 1.8, x, 0, 7.5, 'stone');
    kit.cyl(0.55, 0.65, 0.5, 10, x - 1.2, 0.65, 7.5, 'flagA');
    kit.cyl(0.45, 0.55, 0.45, 10, x, 0.7, 7.5, 'flagC');
    kit.cyl(0.5, 0.6, 0.5, 10, x + 1.2, 0.65, 7.5, 'flagB');
  }
  // street name plaque
  const sm = signMaterial(T, '春熙路', { px: 768, py: 192, bg: '#2b241a', fg: '#e7d2a1', vertical: false, fontWeight: 700, border: 'rgba(198,160,82,.5)', emissive: 0.25 });
  kit.quad(6.0, 1.45, 0, 7.8, 16.2, sm);

  return finishLM(kit, site, 220, 80, 29);
}

export const LANDMARKS = {
  ifs_panda: { label: '成都IFS·爬墙熊猫', build: buildIFS },
  tv_tower: { label: '四川广播电视塔', build: buildTVTower },
  taikooli: { label: '成都远洋太古里', build: buildTaikooli },
  tianfu_plaza: { label: '天府广场', build: buildTianfuPlaza },
  science_museum: { label: '四川科技馆', build: buildScienceMuseum },
  chengdu_museum: { label: '成都博物馆', build: buildChengduMuseum },
  jiuyan_bridge: { label: '九眼桥', build: buildJiuyanBridge },
  chunxi_road: { label: '春熙路', build: buildChunxiRoad },
};

