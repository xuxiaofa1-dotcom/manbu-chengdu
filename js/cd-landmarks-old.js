// Chengdu's traditional / historic landmarks as procedural three.js models for 漫步成都.
//
// Every landmark is built in LOCAL metres, its long footprint axis along +x and its short axis along +z,
// footprint centred on the origin, ground at y = 0. The engine places and rotates the group on the OSM
// footprint; `build()` returns { group, top }. Everything is merged per material (and instanced for repeated
// small things) so each landmark contributes only a handful of draw calls.
//
// Standalone: only three/webgpu, three/tsl and BufferGeometryUtils are imported, no engine modules.
import * as THREE from 'three/webgpu';
import { positionWorld, normalWorld, texture as texNode } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------------------------------------
// Palette (Sichuan / Chinese traditional architecture, per the art direction)
// ---------------------------------------------------------------------------------------------
const C = {
  tile: 0x4a5259,
  tileDark: 0x353c42,
  tileLight: 0x5b656d,
  ridge: 0x3a4147,
  red: 0x9e3b2f,
  redDeep: 0x832f27,
  redBright: 0xa83228,
  wood: 0x6b4a2f,
  woodDark: 0x46301f,
  woodLight: 0x8a6a48,
  plaster: 0xe6e1d5,
  white: 0xf1eee5,
  brick: 0x8b8b86,
  brickDark: 0x6f6f6a,
  stone: 0xcfc9bb,
  stoneDark: 0xa8a294,
  stoneLight: 0xded8c9,
  gold: 0xc8a24a,
  bronze: 0x7a5f3a,
  bamboo: 0x5f7f3a,
  leaf: 0x4f6f3a,
  ginkgo: 0xbfa13a,
  trunk: 0x5a4632,
  water: 0x3f5d5a,
  cloth: 0x9e3b2f,
  awning: 0xd8c8a8,
  earth: 0x9a8a70,
};

const FONT_SANS = '"PingFang SC","Hiragino Sans GB","Heiti SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
const FONT_SERIF = '"STKaiti","Kaiti SC","KaiTi","Songti SC","SimSun","Noto Serif CJK SC",serif';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

// tiny deterministic PRNG (same sequence every build, so screenshots are stable)
function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------------------------
// Canvas textures (no external images). CJK-safe font stacks only.
// ---------------------------------------------------------------------------------------------
const TEX_CACHE = new Map();

function makeTex(key, w, h, draw, repeat = true) {
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
  t.generateMipmaps = true;
  TEX_CACHE.set(key, t);
  return t;
}

// 青瓦: dark blue-grey barrel tiles, one texture tile = 1.15 m of roof
const roofTileTexture = () => makeTex('roofTile', 256, 256, (c, W, H) => {
  c.fillStyle = '#525b63';
  c.fillRect(0, 0, W, H);
  const cols = 6, cw = W / cols;
  for (let i = 0; i < cols; i++) {
    const x = i * cw;
    const g = c.createLinearGradient(x, 0, x + cw, 0);
    g.addColorStop(0, '#353e45');
    g.addColorStop(0.14, '#707a82');
    g.addColorStop(0.4, '#5b656d');
    g.addColorStop(0.72, '#48525a');
    g.addColorStop(1, '#2f373d');
    c.fillStyle = g;
    c.fillRect(x + 1, 0, cw - 2, H);
    for (let y = 0; y < H; y += 36) {
      c.fillStyle = 'rgba(14,20,25,.5)';
      c.fillRect(x, y, cw, 2.5);
      c.fillStyle = 'rgba(210,225,235,.14)';
      c.fillRect(x + cw * 0.2, y + 3, cw * 0.32, 1.5);
    }
  }
  const r = rng(7);
  for (let i = 0; i < 340; i++) {
    c.fillStyle = `rgba(${r() > 0.5 ? '210,220,226' : '12,18,22'},${0.02 + r() * 0.05})`;
    c.fillRect(r() * W, r() * H, 1 + r() * 3, 2 + r() * 9);
  }
});

const greyBrickTexture = () => makeTex('greyBrick', 256, 256, (c, W, H) => {
  c.fillStyle = '#b0aca1';
  c.fillRect(0, 0, W, H);
  const r = rng(11);
  const bh = 20;
  for (let row = 0; row < H / bh; row++) {
    const y = row * bh;
    let x = row % 2 ? -30 : 0;
    while (x < W) {
      const bw = 52 + r() * 20;
      const tone = 128 + r() * 26;
      c.fillStyle = `rgb(${tone},${tone - 2},${tone - 8})`;
      c.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
      c.fillStyle = `rgba(45,45,42,${0.05 + r() * 0.1})`;
      c.fillRect(x + 3, y + bh - 5, bw - 6, 2);
      x += bw;
    }
  }
  for (let i = 0; i < 500; i++) {
    c.fillStyle = `rgba(60,60,55,${r() * 0.08})`;
    c.fillRect(r() * W, r() * H, 1 + r() * 4, 1 + r() * 4);
  }
});

const stonePavingTexture = () => makeTex('stonePaving', 256, 256, (c, W, H) => {
  c.fillStyle = '#726f65';
  c.fillRect(0, 0, W, H);
  const r = rng(23);
  const cell = 64;
  for (let y = 0; y < H; y += cell) {
    for (let x = 0; x < W; x += cell) {
      const inset = 2.5;
      const tone = 118 + r() * 30;
      c.fillStyle = `rgb(${tone},${tone - 5},${tone - 16})`;
      c.fillRect(x + inset, y + inset, cell - inset * 2, cell - inset * 2);
      c.strokeStyle = `rgba(60,56,48,${0.14 + r() * 0.2})`;
      c.lineWidth = 1;
      c.strokeRect(x + inset + 1, y + inset + 1, cell - inset * 2 - 2, cell - inset * 2 - 2);
      c.fillStyle = `rgba(95,88,75,${0.08 + r() * 0.14})`;
      c.fillRect(x + 4 + r() * 20, y + 4 + r() * 20, 6 + r() * 16, 2 + r() * 4);
    }
  }
  for (let y = 0; y < H; y += cell / 2) {
    c.fillStyle = 'rgba(66,62,53,.18)';
    c.fillRect(0, y, W, 1);
  }
});

const ashlarTexture = () => makeTex('ashlar', 256, 256, (c, W, H) => {
  c.fillStyle = '#7a756a';
  c.fillRect(0, 0, W, H);
  const r = rng(31);
  const bh = 42;
  for (let row = 0; row < 7; row++) {
    const y = row * bh;
    let x = row % 2 ? -36 : 0;
    while (x < W) {
      const bw = 80 + r() * 26;
      const tone = 120 + r() * 26;
      c.fillStyle = `rgb(${tone},${tone - 7},${tone - 20})`;
      c.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      c.fillStyle = 'rgba(55,50,43,.16)';
      c.fillRect(x + 4, y + bh - 8, bw - 8, 3);
      x += bw;
    }
  }
  for (let i = 0; i < 380; i++) {
    c.fillStyle = `rgba(55,50,43,${r() * 0.08})`;
    c.fillRect(r() * W, r() * H, 1 + r() * 7, 1 + r() * 2);
  }
});

const thatchTexture = () => makeTex('thatch', 256, 256, (c, W, H) => {
  c.fillStyle = '#b99a5f';
  c.fillRect(0, 0, W, H);
  const r = rng(41);
  for (let i = 0; i < 1600; i++) {
    const y = r() * H;
    const x = r() * W;
    const l = 10 + r() * 44;
    const tone = r();
    c.strokeStyle = tone > 0.72 ? `rgba(232,209,155,${0.35 + r() * 0.3})` : tone > 0.4 ? `rgba(139,112,63,${0.25 + r() * 0.3})` : `rgba(87,66,34,${0.18 + r() * 0.28})`;
    c.lineWidth = 0.8 + r() * 1.5;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + l, y + (r() - 0.5) * 4);
    c.stroke();
  }
  // horizontal binding courses
  for (let y = 10; y < H; y += 40) {
    c.strokeStyle = 'rgba(65,48,24,.45)';
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(0, y + (r() - 0.5) * 3);
    c.lineTo(W, y + (r() - 0.5) * 3);
    c.stroke();
  }
});

// 窗棂: warm paper behind a dark timber lattice
const latticeTexture = () => makeTex('lattice', 256, 256, (c, W, H) => {
  const g = c.createRadialGradient(W / 2, H / 2, 30, W / 2, H / 2, W * 0.72);
  g.addColorStop(0, '#f4e9ce');
  g.addColorStop(0.6, '#e4d3ae');
  g.addColorStop(1, '#c9b48a');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.strokeStyle = '#402b1b';
  c.lineWidth = 12;
  c.strokeRect(6, 6, W - 12, H - 12);
  c.lineWidth = 7;
  for (let i = 1; i < 4; i++) {
    c.beginPath(); c.moveTo((W / 4) * i, 8); c.lineTo((W / 4) * i, H - 8); c.stroke();
    c.beginPath(); c.moveTo(8, (H / 4) * i); c.lineTo(W - 8, (H / 4) * i); c.stroke();
  }
  // 步步锦 corner motifs
  c.lineWidth = 5;
  const k = 42;
  for (const [x, y, sx, sy] of [[14, 14, 1, 1], [W - 14, 14, -1, 1], [14, H - 14, 1, -1], [W - 14, H - 14, -1, -1]]) {
    c.beginPath();
    c.moveTo(x, y + sy * k);
    c.lineTo(x, y);
    c.lineTo(x + sx * k, y);
    c.stroke();
    c.beginPath();
    c.moveTo(x + sx * (k + 8), y + sy * 10);
    c.lineTo(x + sx * (k + 8), y + sy * (k + 8));
    c.lineTo(x + sx * 10, y + sy * (k + 8));
    c.stroke();
  }
  // paper grain
  const r = rng(53);
  for (let i = 0; i < 240; i++) {
    c.fillStyle = `rgba(120,95,55,${r() * 0.05})`;
    c.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3);
  }
}, false);

const lanternTexture = () => makeTex('lantern', 256, 256, (c, W, H) => {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#7e1d12');
  g.addColorStop(0.28, '#c3321f');
  g.addColorStop(0.55, '#d94426');
  g.addColorStop(0.82, '#b62a19');
  g.addColorStop(1, '#6e180f');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(244,208,120,.55)';
  c.lineWidth = 2;
  for (let i = 0; i < 16; i++) {
    const x = (i + 0.5) * (W / 16);
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, H);
    c.stroke();
  }
  c.strokeStyle = 'rgba(60,12,6,.6)';
  c.lineWidth = 3;
  for (let i = 0; i < 16; i++) {
    const x = i * (W / 16);
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke();
  }
  // gold medallions
  for (let i = 0; i < 8; i++) {
    c.fillStyle = i % 2 ? 'rgba(224,187,98,.28)' : 'rgba(224,187,98,.14)';
    c.beginPath();
    c.arc((i + 0.5) * (W / 8), H * 0.5, 16, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = 'rgba(240,210,130,.5)';
  c.fillRect(0, 6, W, 6);
  c.fillRect(0, H - 12, W, 6);
});

const bambooLeafTexture = () => makeTex('bambooLeaf', 128, 128, (c, W, H) => {
  c.clearRect(0, 0, W, H);
  const r = rng(61);
  for (let s = 0; s < 5; s++) {
    const bx = 20 + r() * 88, by = 110 - r() * 20;
    const ang = -Math.PI / 2 + (r() - 0.5) * 1.9;
    c.strokeStyle = 'rgba(70,90,40,.9)';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(bx, by);
    c.quadraticCurveTo(bx + Math.cos(ang) * 22, by + Math.sin(ang) * 22, bx + Math.cos(ang) * 44, by + Math.sin(ang) * 44);
    c.stroke();
    for (let l = 0; l < 3; l++) {
      const a = ang + (l - 1) * 0.5 + (r() - 0.5) * 0.3;
      const len = 26 + r() * 22;
      const cx = bx + Math.cos(ang) * (16 + l * 11);
      const cy = by + Math.sin(ang) * (16 + l * 11);
      c.save();
      c.translate(cx, cy);
      c.rotate(a);
      const grad = c.createLinearGradient(0, 0, 0, -len);
      grad.addColorStop(0, '#3d5a26');
      grad.addColorStop(1, '#7d9a45');
      c.fillStyle = grad;
      c.beginPath();
      c.ellipse(0, 0, 5.5, len * 0.5, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }
}, false);

// 匾额: lacquer board with real CJK characters in gold
function plaqueTexture(text, vertical = false, style = 'ink') {
  const key = `plaque|${text}|${vertical ? 1 : 0}|${style}`;
  if (TEX_CACHE.has(key)) return TEX_CACHE.get(key);
  const W = vertical ? 260 : 860;
  const H = vertical ? 700 : 260;
  const t = makeTex(key, W, H, (c) => {
    const bg = style === 'red' ? ['#7d2b23', '#4d1712'] : style === 'green' ? '#234437' : ['#241a12', '#100b08'];
    if (Array.isArray(bg)) {
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, bg[0]);
      g.addColorStop(1, bg[1]);
      c.fillStyle = g;
    } else c.fillStyle = bg;
    c.fillRect(0, 0, W, H);
    // lacquer grain
    const r = rng(text.length * 37 + W);
    for (let i = 0; i < 90; i++) {
      c.fillStyle = `rgba(190,150,90,${0.02 + r() * 0.04})`;
      c.fillRect(r() * W, 0, 1 + r() * 2, H);
    }
    // double gold frame
    c.strokeStyle = '#c8a24a';
    c.lineWidth = 9;
    c.strokeRect(15, 15, W - 30, H - 30);
    c.strokeStyle = 'rgba(232,201,128,.55)';
    c.lineWidth = 2;
    c.strokeRect(28, 28, W - 56, H - 56);
    // corner brackets
    c.fillStyle = '#c8a24a';
    for (const [x, y, sx, sy] of [[30, 30, 1, 1], [W - 30, 30, -1, 1], [30, H - 30, 1, -1], [W - 30, H - 30, -1, -1]]) {
      c.fillRect(x, y, sx * 26, sy * 5);
      c.fillRect(x, y, sx * 5, sy * 26);
    }
    // the characters
    const n = [...text].length;
    let size = vertical ? Math.min(W * 0.62, (H - 100) / n) : Math.min(H * 0.56, (W - 90) / n);
    c.font = `700 ${size}px ${FONT_SERIF}`;
    while (c.measureText(text).width > W - 100 && size > 24) {
      size *= 0.93;
      c.font = `700 ${size}px ${FONT_SERIF}`;
    }
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const grad = c.createLinearGradient(0, H * 0.2, 0, H * 0.85);
    grad.addColorStop(0, '#f4dc9c');
    grad.addColorStop(0.45, '#d9b35d');
    grad.addColorStop(1, '#a67c2e');
    c.fillStyle = grad;
    c.shadowColor = 'rgba(0,0,0,.55)';
    c.shadowBlur = 6;
    c.shadowOffsetY = 3;
    if (vertical) {
      const step = (H - 90) / n;
      [...text].forEach((ch, i) => c.fillText(ch, W / 2, 48 + step * (i + 0.5)));
    } else {
      c.fillText(text, W / 2, H / 2 + size * 0.04);
    }
    c.shadowBlur = 0;
    c.shadowOffsetY = 0;
  }, false);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 幌子 / 酒旗: a hanging cloth shop banner with vertical characters
function bannerTexture(text, style = 'red') {
  const key = `banner|${text}|${style}`;
  if (TEX_CACHE.has(key)) return TEX_CACHE.get(key);
  const W = 150, H = 470;
  const t = makeTex(key, W, H, (c) => {
    c.clearRect(0, 0, W, H);
    const pal = style === 'blue' ? ['#254a5a', '#122b36'] : style === 'cream' ? ['#e7d7b0', '#c9b184'] : ['#a83228', '#6e1d14'];
    const g = c.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, pal[1]);
    g.addColorStop(0.25, pal[0]);
    g.addColorStop(0.7, pal[0]);
    g.addColorStop(1, pal[1]);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(6, 0);
    c.lineTo(W - 6, 0);
    c.lineTo(W - 10, H - 36);
    for (let i = 3; i >= 0; i--) {
      c.lineTo(W / 2 + (i / 4) * (W - 32) + 8, H - 12);
      c.lineTo(W / 2 + ((i - 0.5) / 4) * (W - 32), H - 42);
    }
    c.lineTo(10, H - 36);
    c.closePath();
    c.fill();
    c.strokeStyle = style === 'cream' ? 'rgba(80,50,30,.4)' : 'rgba(238,205,125,.45)';
    c.lineWidth = 4;
    c.strokeRect(14, 16, W - 28, H - 70);
    const fg = style === 'cream' ? '#6e2a1c' : '#f1dda7';
    c.fillStyle = fg;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const n = [...text].length;
    const size = Math.min(74, (H - 110) / n);
    c.font = `700 ${size}px ${FONT_SERIF}`;
    [...text].forEach((ch, i) => c.fillText(ch, W / 2, 52 + (H - 120) * (i + 0.5) / n));
  }, false);
  return t;
}

// ---------------------------------------------------------------------------------------------
// Materials. MeshStandardNodeMaterial only (WebGPU renderer). Triplanar for masonry so that boxes
// of any size get correctly scaled bricks/stone without bespoke UVs.
// ---------------------------------------------------------------------------------------------
function triplanar(map, size, roughness = 0.92, metalness = 0) {
  const m = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness, metalness });
  const p = positionWorld.div(size);
  const n = normalWorld.abs().add(0.0001);
  const c = texNode(map, p.zy).rgb.mul(n.x)
    .add(texNode(map, p.xz).rgb.mul(n.y))
    .add(texNode(map, p.xy).rgb.mul(n.z));
  m.colorNode = c.div(n.x.add(n.y).add(n.z));
  return m;
}

function createMaterial(key) {
  const T = THREE;
  if (key.startsWith('plaque|')) {
    const [, text, vertical, style] = key.split('|');
    return new T.MeshStandardNodeMaterial({
      map: plaqueTexture(text, vertical === '1', style || 'ink'),
      roughness: 0.52,
      metalness: 0.12,
    });
  }
  if (key.startsWith('banner|')) {
    const [, text, style] = key.split('|');
    return new T.MeshStandardNodeMaterial({
      map: bannerTexture(text, style || 'red'),
      roughness: 0.9,
      metalness: 0,
      side: T.DoubleSide,
      transparent: true,
      alphaTest: 0.35,
    });
  }
  switch (key) {
    case 'tile': return new T.MeshStandardNodeMaterial({ map: roofTileTexture(), roughness: 0.84, metalness: 0.04, side: T.DoubleSide });
    case 'tileDark': return new T.MeshStandardNodeMaterial({ color: C.tileDark, roughness: 0.85, side: T.DoubleSide });
    case 'tilePlain': return new T.MeshStandardNodeMaterial({ color: C.tile, roughness: 0.85 });
    case 'ridge': return new T.MeshStandardNodeMaterial({ color: C.ridge, roughness: 0.8, metalness: 0.05, side: T.DoubleSide });
    case 'red': return new T.MeshStandardNodeMaterial({ color: C.red, roughness: 0.7 });
    case 'redDeep': return new T.MeshStandardNodeMaterial({ color: C.redDeep, roughness: 0.74 });
    case 'redBright': return new T.MeshStandardNodeMaterial({ color: C.redBright, roughness: 0.68 });
    case 'wood': return new T.MeshStandardNodeMaterial({ color: C.wood, roughness: 0.82 });
    case 'woodDark': return new T.MeshStandardNodeMaterial({ color: C.woodDark, roughness: 0.85 });
    case 'woodLight': return new T.MeshStandardNodeMaterial({ color: C.woodLight, roughness: 0.8 });
    case 'plaster': return new T.MeshStandardNodeMaterial({ color: C.plaster, roughness: 0.96, emissive: 0x1b1914, emissiveIntensity: 0.25 });
    case 'plaster2': return new T.MeshStandardNodeMaterial({ color: C.plaster, roughness: 0.96, side: T.DoubleSide, emissive: 0x1b1914, emissiveIntensity: 0.25 });
    case 'white': return new T.MeshStandardNodeMaterial({ color: C.white, roughness: 0.94 });
    case 'brick': return new T.MeshStandardNodeMaterial({ color: C.brick, roughness: 0.94 });
    case 'brickTri': return triplanar(greyBrickTexture(), 2.0, 0.94);
    case 'stone': return new T.MeshStandardNodeMaterial({ color: C.stone, roughness: 0.9 });
    case 'stoneLight': return new T.MeshStandardNodeMaterial({ color: C.stoneLight, roughness: 0.88 });
    case 'stoneDark': return new T.MeshStandardNodeMaterial({ color: C.stoneDark, roughness: 0.92 });
    case 'stoneTri': return triplanar(ashlarTexture(), 3.2, 0.9);
    case 'pavingTri': return triplanar(stonePavingTexture(), 2.8, 0.95);
    case 'gold': return new T.MeshStandardNodeMaterial({ color: C.gold, roughness: 0.34, metalness: 0.55, emissive: 0x2e1f06, emissiveIntensity: 0.4 });
    case 'bronze': return new T.MeshStandardNodeMaterial({ color: C.bronze, roughness: 0.46, metalness: 0.5, emissive: 0x150f06, emissiveIntensity: 0.3 });
    case 'water': return new T.MeshStandardNodeMaterial({ color: 0x4c615d, roughness: 0.3, metalness: 0.22 });
    case 'bamboo': return new T.MeshStandardNodeMaterial({ color: C.bamboo, roughness: 0.72 });
    case 'bambooDry': return new T.MeshStandardNodeMaterial({ color: 0x8a8f4a, roughness: 0.8 });
    case 'foliage': return new T.MeshStandardNodeMaterial({ color: C.leaf, roughness: 0.9 });
    case 'foliageDark': return new T.MeshStandardNodeMaterial({ color: 0x3c5730, roughness: 0.92 });
    case 'ginkgo': return new T.MeshStandardNodeMaterial({ color: C.ginkgo, roughness: 0.88 });
    case 'trunk': return new T.MeshStandardNodeMaterial({ color: C.trunk, roughness: 0.95 });
    case 'thatch': return new T.MeshStandardNodeMaterial({ map: thatchTexture(), roughness: 0.98, side: T.DoubleSide });
    case 'thatchPlain': return new T.MeshStandardNodeMaterial({ color: 0xb39458, roughness: 0.98, side: T.DoubleSide });
    case 'lattice': return new T.MeshStandardNodeMaterial({ map: latticeTexture(), roughness: 0.78, emissive: 0x4a3418, emissiveIntensity: 0.38, side: T.DoubleSide });
    case 'lantern': return new T.MeshStandardNodeMaterial({ map: lanternTexture(), roughness: 0.54, metalness: 0.05, emissive: 0x7a1608, emissiveIntensity: 0.55 });
    case 'leaf': return new T.MeshStandardNodeMaterial({ map: bambooLeafTexture(), roughness: 0.85, side: T.DoubleSide, transparent: true, alphaTest: 0.4, metalness: 0 });
    case 'cloth': return new T.MeshStandardNodeMaterial({ color: C.cloth, roughness: 0.92, side: T.DoubleSide });
    case 'awning': return new T.MeshStandardNodeMaterial({ color: C.awning, roughness: 0.94, side: T.DoubleSide });
    case 'paper': return new T.MeshStandardNodeMaterial({ color: 0xefe4c8, roughness: 0.9 });
    case 'terracotta': return new T.MeshStandardNodeMaterial({ color: 0xa8613f, roughness: 0.9 });
    case 'earth': return new T.MeshStandardNodeMaterial({ color: C.earth, roughness: 0.98 });
    case 'garden': return new T.MeshStandardNodeMaterial({ color: 0x5d6b4d, roughness: 0.98 });
    case 'black': return new T.MeshStandardNodeMaterial({ color: 0x1d1a17, roughness: 0.7 });
    case 'door': return new T.MeshStandardNodeMaterial({ color: 0x3f2a1a, roughness: 0.8 });
    default: return new T.MeshStandardNodeMaterial({ color: 0xff00ff, roughness: 0.8 });
  }
}

// ---------------------------------------------------------------------------------------------
// Kit: accumulates geometry per material, merges at the end, and collects instanced repeats.
// ---------------------------------------------------------------------------------------------
class Kit {
  constructor(T) {
    this.T = T;
    this.parts = new Map();
    this.shapes = new Map();
    this.matCache = new Map();
    this.group = new T.Group();
    this.group.name = 'cd-landmark';
  }

  material(key) {
    if (!this.matCache.has(key)) this.matCache.set(key, createMaterial(key));
    return this.matCache.get(key);
  }

  _norm(geo) {
    geo.clearGroups();
    let g = geo;
    if (g.index) g = g.toNonIndexed();
    if (!g.getAttribute('position')) return null;
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    if (!g.getAttribute('uv')) {
      const n = g.getAttribute('position').count;
      g.setAttribute('uv', new this.T.Float32BufferAttribute(new Float32Array(n * 2), 2));
    }
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    return g;
  }

  _matrix(x, y, z, rx, ry, rz, sx, sy, sz) {
    const T = this.T;
    return new T.Matrix4().compose(
      new T.Vector3(x, y, z),
      new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz, 'XYZ')),
      new T.Vector3(sx, sy, sz),
    );
  }

  _place(geo, key, matrix) {
    let g = this._norm(geo);
    if (!g) return;
    g.applyMatrix4(matrix);
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(g);
  }

  add(geo, key, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    this._place(geo, key, this._matrix(x, y, z, rx, ry, rz, sx, sy, sz));
  }

  // y is the centre of the box (as in three), which keeps the builders readable
  box(w, h, d, x, y, z, key, ry = 0, rx = 0, rz = 0) {
    this._place(new this.T.BoxGeometry(w, h, d), key, this._matrix(x, y, z, rx, ry, rz, 1, 1, 1));
  }

  // y is the centre of the cylinder
  cyl(rt, rb, h, seg, x, y, z, key, rx = 0, ry = 0, rz = 0) {
    this._place(new this.T.CylinderGeometry(rt, rb, h, seg), key, this._matrix(x, y, z, rx, ry, rz, 1, 1, 1));
  }

  // a box beam between two points (the long axis follows a→b)
  beam(a, b, w, h, key, ry = 0) {
    const T = this.T;
    const dir = new T.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 1e-4) return;
    const geo = new T.BoxGeometry(w, h, len);
    if (ry) geo.rotateY(ry);
    const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), dir.clone().normalize());
    const mid = new T.Vector3().addVectors(a, b).multiplyScalar(0.5);
    this._place(geo, key, new T.Matrix4().compose(mid, q, new T.Vector3(1, 1, 1)));
  }

  instGeo(name, geo, matKey) {
    if (this.shapes.has(name)) return;
    const g = this._norm(geo.clone());
    if (!g) return;
    this.shapes.set(name, { geo: g, matKey, mats: [] });
  }

  inst(name, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
    const sh = this.shapes.get(name);
    if (!sh) return;
    sh.mats.push(this._matrix(x, y, z, rx, ry, rz, sx, sy, sz));
  }

  // build an independently merged sub-assembly, then rotate / place it as a child group.
  // Used for buildings whose ridge runs along z (the whole compound axis): build them locally
  // (ridge along x), rotate 90°, drop in place.
  addSub(x, z, ry, fn) {
    const sub = new Kit(this.T);
    fn(sub);
    const sg = sub.finish();
    sg.position.set(x, 0, z);
    sg.rotation.y = ry;
    this.group.add(sg);
    this.group.userData.triangles = (this.group.userData.triangles || 0) + (sg.userData.triangles || 0);
    return sg;
  }

  finish() {
    const T = this.T;
    let tris = this.group.userData.triangles || 0;
    for (const [key, list] of this.parts) {
      if (!list.length) continue;
      const geo = mergeGeometries(list, false);
      if (!geo) {
        console.warn(`[cd-landmarks] could not merge material "${key}" (${list.length} parts)`);
        continue;
      }
      if (!geo.getAttribute('normal')) geo.computeVertexNormals();
      const mesh = new T.Mesh(geo, this.material(key));
      mesh.name = key;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      tris += geo.getAttribute('position').count / 3;
    }
    for (const [name, sh] of this.shapes) {
      if (!sh.mats.length) continue;
      const mesh = new T.InstancedMesh(sh.geo, this.material(sh.matKey), sh.mats.length);
      sh.mats.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.name = name;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      tris += (sh.geo.getAttribute('position').count / 3) * sh.mats.length;
    }
    this.group.userData.triangles = Math.round(tris);
    return this.group;
  }
}

// adapt the nominal model to the site footprint, then report the true height
function finishLandmark(kit, site, nomW, nomD, nomTop) {
  const g = kit.finish();
  const sw = Number(site && site.w) > 0 ? site.w : nomW;
  const sd = Number(site && site.d) > 0 ? site.d : nomD;
  const sx = clamp(sw / nomW, 0.62, 1.45);
  const sz = clamp(sd / nomD, 0.62, 1.45);
  const sy = site && Number(site.h) > 0 ? clamp(site.h / nomTop, 0.85, 1.15) : clamp((sx + sz) / 2, 0.88, 1.12);
  g.scale.set(sx, sy, sz);
  g.updateMatrixWorld(true);
  let top = nomTop * sy;
  try {
    const bb = new THREE.Box3().setFromObject(g);
    if (Number.isFinite(bb.max.y)) top = Math.max(top, bb.max.y);
  } catch {
    /* very large merged geometry can defy Box3; nomTop is authoritative */
  }
  return { group: g, top: Math.round(top * 100) / 100 };
}

// ---------------------------------------------------------------------------------------------
// Chinese roof toolkit. All roofs are lofted rims: each ring is a rectangle (or polygon) that
// shrinks towards the ridge / apex, with a concave "举折" height curve and lifted eave corners
// (起翘). Separate 翘角 horns and 垂脊 ridge beams make the silhouette read at 200 m.
// ---------------------------------------------------------------------------------------------
const TILE_M = 1.15; // roof texture repeat in metres

function rectRing(hw, hd, nx, nz) {
  const pts = [];
  for (let i = 0; i < nx; i++) pts.push([-hw + (2 * hw * i) / nx, hd]);
  for (let i = 0; i < nz; i++) pts.push([hw, hd - (2 * hd * i) / nz]);
  for (let i = 0; i < nx; i++) pts.push([hw - (2 * hw * i) / nx, -hd]);
  for (let i = 0; i < nz; i++) pts.push([-hw, -hd + (2 * hd * i) / nz]);
  return pts;
}

function polygonRing(r, sides, segPerSide, rot = 0) {
  const pts = [];
  for (let s = 0; s < sides; s++) {
    const a0 = rot + (s / sides) * Math.PI * 2;
    const a1 = rot + ((s + 1) / sides) * Math.PI * 2;
    for (let i = 0; i < segPerSide; i++) {
      const t = i / segPerSide;
      // straight polygon edge, not a circle: gives a proper octagonal 亭
      const x0 = Math.cos(a0) * r, z0 = Math.sin(a0) * r;
      const x1 = Math.cos(a1) * r, z1 = Math.sin(a1) * r;
      pts.push([lerp(x0, x1, t), lerp(z0, z1, t)]);
    }
  }
  return pts;
}

function eaveLift(x, z, hw, hd, cornerLift, spread) {
  let cd = Infinity;
  for (const [cx, cz] of [[hw, hd], [-hw, hd], [hw, -hd], [-hw, -hd]]) cd = Math.min(cd, Math.hypot(x - cx, z - cz));
  const f = clamp(1 - cd / spread, 0, 1);
  return cornerLift * Math.pow(f, 2.2);
}

function loftRoofGeo(T, o) {
  const w0 = o.w0, d0 = o.d0;
  const w1 = o.w1 === undefined ? 0.02 : o.w1;
  const d1 = o.d1 === undefined ? 0.02 : o.d1;
  const nx = o.nx || 12, nz = o.nz || 8, segV = o.segV || 6;
  const curve = o.curve === undefined ? 1.32 : o.curve;
  const cornerLift = o.cornerLift || 0;
  const spread = o.spread || Math.max(3.2, Math.min(w0, d0) * 0.24);
  const y0 = o.y0 || 0, y1 = o.y1;
  const base = rectRing(w0 / 2, d0 / 2, nx, nz);
  const N = base.length;
  const U = [];
  let acc = 0;
  for (let i = 0; i < N; i++) {
    U.push(acc);
    const a = base[i], b = base[(i + 1) % N];
    acc += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  const slopeLen = Math.hypot(y1 - y0, Math.max(0, (d0 - d1) / 2), Math.max(0, (w0 - w1) / 2)) || 1;
  const pos = [], uv = [];
  for (let k = 0; k <= segV; k++) {
    const s = k / segV;
    const hw = lerp(w0 / 2, Math.max(0.01, w1 / 2), s);
    const hd = lerp(d0 / 2, Math.max(0.01, d1 / 2), s);
    const ring = rectRing(hw, hd, nx, nz);
    const yb = y0 + (y1 - y0) * Math.pow(s, curve);
    for (let i = 0; i < N; i++) {
      const px = ring[i][0], pz = ring[i][1];
      let cd = Infinity;
      for (const [cx, cz] of [[hw, hd], [-hw, hd], [hw, -hd], [-hw, -hd]]) cd = Math.min(cd, Math.hypot(px - cx, pz - cz));
      const lift = cornerLift * Math.pow(clamp(1 - cd / spread, 0, 1), 2.2) * Math.pow(1 - s, 1.35);
      let x = px, z = pz;
      if (lift > 0) {
        const rr = Math.hypot(x, z) || 1;
        x += (x / rr) * lift * 0.55;
        z += (z / rr) * lift * 0.55;
      }
      pos.push(x, yb + lift, z);
      uv.push(U[i] / TILE_M, (s * slopeLen) / TILE_M);
    }
  }
  const idx = [];
  for (let k = 0; k < segV; k++) {
    for (let i = 0; i < N; i++) {
      const a = k * N + i, b = k * N + ((i + 1) % N);
      const c = (k + 1) * N + i, d = (k + 1) * N + ((i + 1) % N);
      idx.push(a, b, c, b, d, c);
    }
  }
  if (o.apex) {
    const apex = pos.length / 3;
    pos.push(0, y1, 0);
    uv.push(0, slopeLen / TILE_M);
    for (let i = 0; i < N; i++) {
      const a = segV * N + i, b = segV * N + ((i + 1) % N);
      idx.push(a, b, apex);
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return { geo, N, segV, slopeLen };
}

function eaveRingPoints(o) {
  const width = o.w0 || o.w;
  const depth = o.d0 || o.d;
  const nx = o.nx || 12, nz = o.nz || 8;
  const cornerLift = o.cornerLift || 0;
  const spread = o.spread || Math.max(3.2, Math.min(width, depth) * 0.24);
  const hw = width / 2, hd = depth / 2;
  const pts = rectRing(hw, hd, nx, nz);
  return pts.map(([px, pz]) => {
    const lift = eaveLift(px, pz, hw, hd, cornerLift, spread);
    const rr = Math.hypot(px, pz) || 1;
    const x = px + (px / rr) * lift * 0.55;
    const z = pz + (pz / rr) * lift * 0.55;
    return [x, (o.y0 || 0) + lift, z];
  });
}

// thin vertical fascia board that follows the lifted eave line
function eaveBoardGeo(T, ring, drop = 0.38) {
  const N = ring.length;
  const pos = [], idx = [];
  for (let i = 0; i < N; i++) {
    const [x, y, z] = ring[i];
    pos.push(x, y + 0.06, z, x, y - drop, z);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2, b = ((i + 1) % N) * 2;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// a swept, upturned corner tip (翘角)
function hornGeo(T, len = 2.4, rise = 1.2, w = 0.52, h = 0.46, seg = 5) {
  const pos = [], idx = [];
  const ringCount = seg + 1;
  for (let i = 0; i < ringCount; i++) {
    const t = i / seg;
    const cx = len * Math.pow(t, 0.92);
    const cy = rise * Math.pow(t, 1.85);
    const hw = Math.max(0.035, (w / 2) * (1 - 0.78 * t));
    const hh = Math.max(0.03, (h / 2) * (1 - 0.72 * t));
    pos.push(cx, cy - hh, -hw, cx, cy + hh, -hw, cx, cy + hh, hw, cx, cy - hh, hw);
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 4, b = (i + 1) * 4;
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      idx.push(a + k, b + k, a + k2, a + k2, b + k, b + k2);
    }
  }
  // caps
  pos.push(pos[0], pos[1], pos[2]);
  const startCenter = pos.length / 3 - 1;
  for (let k = 0; k < 4; k++) idx.push(startCenter, k, (k + 1) % 4);
  const endBase = seg * 4;
  const endCenter = pos.length / 3;
  pos.push(pos[endBase * 3], pos[endBase * 3 + 1], pos[endBase * 3 + 2]);
  for (let k = 0; k < 4; k++) idx.push(endCenter, endBase + ((k + 1) % 4), endBase + k);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function cornerCurve(o, sx, sz, K = 6) {
  const pts = [];
  const w0 = o.w0, d0 = o.d0;
  const w1 = o.w1 === undefined ? 0.02 : o.w1;
  const d1 = o.d1 === undefined ? 0.02 : o.d1;
  const curve = o.curve === undefined ? 1.32 : o.curve;
  const cornerLift = o.cornerLift || 0;
  const y0 = o.y0 || 0, y1 = o.y1;
  for (let k = 0; k <= K; k++) {
    const s = k / K;
    const hw = lerp(w0 / 2, Math.max(0.01, w1 / 2), s);
    const hd = lerp(d0 / 2, Math.max(0.01, d1 / 2), s);
    let x = sx * hw, z = sz * hd;
    const lift = cornerLift * Math.pow(1 - s, 1.35);
    if (s < 0.5) {
      const rr = Math.hypot(x, z) || 1;
      x += (x / rr) * lift * 0.55;
      z += (z / rr) * lift * 0.55;
    }
    const y = y0 + (y1 - y0) * Math.pow(s, curve) + lift;
    pts.push([x, y, z]);
  }
  return pts;
}

function addRidgePath(kit, pts, w = 0.26, h = 0.26, key = 'ridge') {
  const T = kit.T;
  for (let i = 0; i < pts.length - 1; i++) {
    kit.beam(new T.Vector3(...pts[i]), new T.Vector3(...pts[i + 1]), w, h, key);
  }
}

function addHorns(kit, w, d, y0, cornerLift, sx, sz, len = 2.3, spread) {
  const T = kit.T;
  const hw = w / 2, hd = d / 2;
  const sp = spread || Math.max(3.2, Math.min(w, d) * 0.24);
  const lift = eaveLift(sx * hw, sz * hd, hw, hd, cornerLift, sp);
  const x = sx * (hw + lift * 0.55 * (hw / (Math.hypot(hw, hd) || 1)));
  const z = sz * (hd + lift * 0.55 * (hd / (Math.hypot(hw, hd) || 1)));
  const y = y0 + lift;
  const ry = Math.atan2(-sz, sx);
  kit.add(hornGeo(T, len, len * 0.45, 0.82, 0.62), 'ridge', x, y - 0.22, z, 0, ry, 0);
  kit.add(new T.SphereGeometry(0.13, 6, 4), 'gold', x + Math.cos(ry) * len, y - 0.22 + len * 0.45, z - Math.sin(ry) * len);
}

function ridgeCap(kit, x0, x1, y, z = 0, key = 'ridge', horns = true) {
  const T = kit.T;
  const len = Math.max(0.4, x1 - x0);
  kit.box(len, 0.36, 0.56, (x0 + x1) / 2, y + 0.12, z, key);
  kit.box(len + 0.06, 0.24, 0.34, (x0 + x1) / 2, y + 0.38, z, key);
  if (horns) {
    for (const s of [-1, 1]) {
      // a compact ridge-end block (正吻), kept short so it reads as part of the roof
      kit.box(0.52, 0.55, 0.62, s * len / 2, y + 0.48, z, key);
    }
  }
}

// four-sided hip roof (庑殿), ridge along x
function roofHip(kit, o) {
  const T = kit.T;
  const w = o.w, d = o.d, y0 = o.y0, rise = o.rise;
  const ridgeLen = o.ridgeLen === undefined ? Math.max(0.8, w * 0.5) : o.ridgeLen;
  const cornerLift = o.cornerLift === undefined ? 0.9 : o.cornerLift;
  const cx = o.cx || 0, cz = o.cz || 0;
  const y1 = y0 + rise;
  const shell = loftRoofGeo(T, {
    w0: w, d0: d, w1: ridgeLen, d1: 0.02, y0, y1,
    cornerLift, segV: o.segV || 6, nx: o.nx || 12, nz: o.nz || 8, curve: o.curve || 1.32,
  });
  kit.add(shell.geo, 'tile', cx, 0, cz);
  const er = eaveRingPoints({ w0: w, d0: d, y0, cornerLift, nx: o.nx || 12, nz: o.nz || 8 });
  kit.add(eaveBoardGeo(T, er, 0.4), 'ridge', cx, 0, cz);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pts = cornerCurve({ w0: w, d0: d, w1: ridgeLen, d1: 0.02, y0, y1, cornerLift }, sx, sz, 6)
        .map(([x, y, z]) => [x + cx, y, z + cz]);
      addRidgePath(kit, pts, 0.26, 0.28);
      addHorns(kit, w, d, y0, cornerLift, sx, sz, Math.min(1.8, 1.1 + w * 0.016));
    }
  }
  ridgeCap(kit, cx - ridgeLen / 2, cx + ridgeLen / 2, y1, cz);
  return y1 + 0.55;
}

// gable roof (悬山/硬山): ridge along x, gable ends on ±x
function roofGable(kit, o) {
  const T = kit.T;
  const w = o.w, d = o.d, y0 = o.y0, rise = o.rise;
  const cornerLift = o.cornerLift === undefined ? 0.55 : o.cornerLift;
  const cx = o.cx || 0, cz = o.cz || 0;
  const y1 = y0 + rise;
  const ww = o.ridgeOverhang === undefined ? w : w + o.ridgeOverhang * 2;
  const shell = loftRoofGeo(T, {
    w0: ww, d0: d, w1: ww, d1: 0.02, y0, y1,
    cornerLift, segV: o.segV || 5, nx: o.nx || 10, nz: o.nz || 6, curve: o.curve || 1.3,
  });
  kit.add(shell.geo, o.mat || 'tile', cx, 0, cz);
  const er = eaveRingPoints({ w0: ww, d0: d, y0, cornerLift, nx: o.nx || 10, nz: o.nz || 6 });
  kit.add(eaveBoardGeo(T, er, o.eaveDrop || 0.34), o.eaveMat || 'ridge', cx, 0, cz);
  // gable walls, slightly inset behind the bargeboards
  for (const sx of [-1, 1]) {
    const gx = sx * (ww / 2 - 0.12);
    const pos = [gx, y0, -d / 2, gx, y0, d / 2, gx, y1, 0];
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
    geo.computeVertexNormals();
    kit.add(geo, o.gableMat || 'plaster2', cx, 0, cz);
    // bargeboards up the two roof edges of this gable
    if (o.barge !== false) {
      for (const sz of [-1, 1]) {
        const pts = cornerCurve({ w0: ww, d0: d, w1: ww, d1: 0.02, y0, y1, cornerLift }, sx, sz, 4)
          .map(([x, y, z]) => [x + cx, y, z + cz]);
        addRidgePath(kit, pts, 0.22, 0.26);
      }
    }
    if (o.medallion !== false) {
      kit.add(new T.CircleGeometry(0.5, 12), 'gold', gx + sx * 0.08, y0 + rise * 0.42, cz, 0, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
    }
  }  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) if (o.horns !== false) addHorns(kit, ww, d, y0, cornerLift, sx, sz, Math.min(2.2, 1.2 + d * 0.05));
  }
  ridgeCap(kit, cx - ww / 2, cx + ww / 2, y1, cz, o.ridgeKey || 'ridge', o.horns !== false);
  return y1 + 0.55;
}

// hip-gable (歇山): flared lower skirt + vertical gable + short upper gable roof
function roofXieshan(kit, o) {
  const T = kit.T;
  const w = o.w, d = o.d, y0 = o.y0, rise = o.rise;
  const cornerLift = o.cornerLift === undefined ? 1.15 : o.cornerLift;
  const cx = o.cx || 0, cz = o.cz || 0;
  const W2 = w * (o.upperW === undefined ? 0.56 : o.upperW);
  const D2 = d * (o.upperD === undefined ? 0.44 : o.upperD);
  const yMid = y0 + rise * 0.58;
  const y1 = y0 + rise;
  const lower = loftRoofGeo(T, {
    w0: w, d0: d, w1: W2, d1: D2, y0, y1: yMid,
    cornerLift, segV: 5, nx: o.nx || 14, nz: o.nz || 9, curve: 1.28,
  });
  kit.add(lower.geo, 'tile', cx, 0, cz);
  const er = eaveRingPoints({ w0: w, d0: d, y0, cornerLift, nx: o.nx || 14, nz: o.nz || 9 });
  kit.add(eaveBoardGeo(T, er, 0.42), 'ridge', cx, 0, cz);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pts = cornerCurve({ w0: w, d0: d, w1: W2, d1: D2, y0, y1: yMid, cornerLift }, sx, sz, 5)
        .map(([x, y, z]) => [x + cx, y, z + cz]);
      addRidgePath(kit, pts, 0.27, 0.29);
      if (o.horns !== false) addHorns(kit, w, d, y0, cornerLift, sx, sz, Math.min(1.5, 0.9 + w * 0.01));
    }
  }
  // upper gable storey / 山花
  const uw = W2 + 0.5;
  const ud = D2 + 0.35;
  const upper = loftRoofGeo(T, {
    w0: uw, d0: ud, w1: uw, d1: 0.02, y0: yMid - 0.08, y1,
    cornerLift: 0.22, segV: 3, nx: 8, nz: 4, curve: 1.15,
  });
  kit.add(upper.geo, 'tile', cx, 0, cz);
  for (const sx of [-1, 1]) {
    const gx = sx * (uw / 2 - 0.1);
    const pos = [gx, yMid, -ud / 2, gx, yMid, ud / 2, gx, y1, 0];
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
    geo.computeVertexNormals();
    kit.add(geo, o.gableMat || 'plaster2', cx, 0, cz);
    for (const sz of [-1, 1]) {
      const pts = cornerCurve({ w0: uw, d0: ud, w1: uw, d1: 0.02, y0: yMid - 0.08, y1, cornerLift: 0.22 }, sx, sz, 3)
        .map(([x, y, z]) => [x + cx, y, z + cz]);
      addRidgePath(kit, pts, 0.2, 0.24);
    }
    kit.add(new T.CircleGeometry(0.55, 12), 'gold', gx + sx * 0.1, yMid + (y1 - yMid) * 0.4, cz, 0, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
  }
  ridgeCap(kit, cx - uw / 2, cx + uw / 2, y1, cz);
  return y1 + 0.55;
}

// ring roof around a storey (腰檐): outer eave to an inner rect, no top cap
function roofSkirt(kit, o) {
  const T = kit.T;
  const w = o.w, d = o.d, wIn = o.wIn, dIn = o.dIn;
  const y0 = o.y0, y1 = o.y1;
  const cornerLift = o.cornerLift === undefined ? 0.9 : o.cornerLift;
  const cx = o.cx || 0, cz = o.cz || 0;
  const shell = loftRoofGeo(T, {
    w0: w, d0: d, w1: wIn, d1: dIn, y0, y1,
    cornerLift, segV: 4, nx: o.nx || 12, nz: o.nz || 8, curve: 1.25,
  });
  kit.add(shell.geo, 'tile', cx, 0, cz);
  const er = eaveRingPoints({ w0: w, d0: d, y0, cornerLift, nx: o.nx || 12, nz: o.nz || 8 });
  kit.add(eaveBoardGeo(T, er, 0.38), 'ridge', cx, 0, cz);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pts = cornerCurve({ w0: w, d0: d, w1: wIn, d1: dIn, y0, y1, cornerLift }, sx, sz, 5)
        .map(([x, y, z]) => [x + cx, y, z + cz]);
      addRidgePath(kit, pts, 0.24, 0.26);
      addHorns(kit, w, d, y0, cornerLift, sx, sz, Math.min(1.6, 1.0 + w * 0.014));
    }
  }
  return y1;
}

// square pyramid (攒尖)
function roofPyramid(kit, o) {
  const T = kit.T;
  const w = o.w, d = o.d, y0 = o.y0, rise = o.rise;
  const cornerLift = o.cornerLift === undefined ? 1.2 : o.cornerLift;
  const cx = o.cx || 0, cz = o.cz || 0;
  const y1 = y0 + rise;
  const shell = loftRoofGeo(T, {
    w0: w, d0: d, w1: 0.02, d1: 0.02, y0, y1,
    cornerLift, apex: true, segV: 7, nx: o.nx || 10, nz: o.nz || 8, curve: 1.35,
  });
  kit.add(shell.geo, 'tile', cx, 0, cz);
  const er = eaveRingPoints({ w0: w, d0: d, y0, cornerLift, nx: o.nx || 10, nz: o.nz || 8 });
  kit.add(eaveBoardGeo(T, er, 0.4), 'ridge', cx, 0, cz);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pts = cornerCurve({ w0: w, d0: d, w1: 0.02, d1: 0.02, y0, y1, cornerLift }, sx, sz, 6)
        .map(([x, y, z]) => [x + cx, y, z + cz]);
      addRidgePath(kit, pts, 0.24, 0.26);
      addHorns(kit, w, d, y0, cornerLift, sx, sz, Math.min(2.0, 1.2 + w * 0.03));
    }
  }
  return y1;
}

// octagonal pyramid roof (八卦亭)
function roofOctagon(kit, o) {
  const T = kit.T;
  const sides = 8;
  const segPer = o.segPer || 3;
  const r0 = o.r, r1 = o.rIn === undefined ? 0.02 : o.rIn;
  const y0 = o.y0, y1 = o.y1;
  const cornerLift = o.cornerLift === undefined ? 0.8 : o.cornerLift;
  const cx = o.cx || 0, cz = o.cz || 0;
  const rot = o.rot === undefined ? Math.PI / 8 : o.rot;
  const segV = o.segV || 5;
  const curve = 1.3;
  const pos = [], uv = [], idx = [];
  const N = sides * segPer;
  const U = [];
  let acc = 0;
  const basePts = polygonRing(r0, sides, segPer, rot);
  for (let i = 0; i < N; i++) {
    U.push(acc);
    const a = basePts[i], b = basePts[(i + 1) % N];
    acc += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  for (let k = 0; k <= segV; k++) {
    const s = k / segV;
    const rr = lerp(r0, r1, s);
    const ring = polygonRing(rr, sides, segPer, rot);
    const yb = y0 + (y1 - y0) * Math.pow(s, curve);
    for (let i = 0; i < N; i++) {
      const px = ring[i][0], pz = ring[i][1];
      let cd = Infinity;
      for (let v = 0; v < sides; v++) {
        const a = rot + (v / sides) * Math.PI * 2;
        cd = Math.min(cd, Math.hypot(px - Math.cos(a) * rr, pz - Math.sin(a) * rr));
      }
      const lift = cornerLift * Math.pow(clamp(1 - cd / (r0 * 0.16), 0, 1), 2) * Math.pow(1 - s, 1.4);
      pos.push(px + (px / (Math.hypot(px, pz) || 1)) * lift * 0.5, yb + lift, pz + (pz / (Math.hypot(px, pz) || 1)) * lift * 0.5);
      uv.push(U[i] / TILE_M, (s * Math.hypot(y1 - y0, r0)) / TILE_M);
    }
  }
  for (let k = 0; k < segV; k++) {
    for (let i = 0; i < N; i++) {
      const a = k * N + i, b = k * N + ((i + 1) % N);
      const c = (k + 1) * N + i, d = (k + 1) * N + ((i + 1) % N);
      idx.push(a, b, c, b, d, c);
    }
  }
  const apex = pos.length / 3;
  pos.push(0, y1, 0);
  uv.push(0, 1);
  for (let i = 0; i < N; i++) idx.push(segV * N + i, segV * N + ((i + 1) % N), apex);
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  kit.add(geo, 'tile', cx, 0, cz);
  // eave board ring
  const er = basePts.map(([px, pz]) => {
    const v = Math.hypot(px, pz) || 1;
    const lift = cornerLift * Math.pow(clamp(1 - Math.abs(((Math.atan2(pz, px) - rot + Math.PI * 4) % (Math.PI * 2)) / (Math.PI * 2) * sides % 1 - 0.5) * 2, 0, 1), 2);
    return [px + (px / v) * lift * 0.5, y0 + lift, pz + (pz / v) * lift * 0.5];
  });
  kit.add(eaveBoardGeo(T, er, 0.4), 'ridge', cx, 0, cz);
  // eight 垂脊 + horns
  for (let v = 0; v < sides; v++) {
    const a = rot + (v / sides) * Math.PI * 2;
    const sx = Math.cos(a), sz = Math.sin(a);
    const pts = [];
    for (let k = 0; k <= 5; k++) {
      const s = k / 5;
      const rr = lerp(r0, 0.02, s);
      const lift = cornerLift * Math.pow(1 - s, 1.4);
      pts.push([sx * (rr + lift * 0.5) + cx, y0 + (y1 - y0) * Math.pow(s, curve) + lift, sz * (rr + lift * 0.5) + cz]);
    }
    addRidgePath(kit, pts, 0.24, 0.26);
    const ry = Math.atan2(-sz, sx);
    kit.add(hornGeo(T, Math.min(2.2, 1.2 + r0 * 0.12), 1.1, 0.5, 0.44), 'ridge', cx + sx * r0, y0 + cornerLift - 0.05, cz + sz * r0, 0, ry, 0);
  }
  return y1;
}

// ---------------------------------------------------------------------------------------------
// Shared props
// ---------------------------------------------------------------------------------------------
function ensureShapes(kit) {
  const T = kit.T;
  if (kit.shapes.has('lantern')) return;
  kit.instGeo('lantern', new T.SphereGeometry(1, 6, 4), 'lantern');
  kit.instGeo('lanternCap', new T.CylinderGeometry(0.27, 0.31, 0.16, 6), 'gold');
  kit.instGeo('lanternTassel', new T.CylinderGeometry(0.035, 0.02, 0.5, 4), 'gold');
  const culm = new T.CylinderGeometry(0.045, 0.075, 1, 5, 1, true);
  culm.translate(0, 0.5, 0);
  kit.instGeo('culm', culm, 'bamboo');
  const leaf1 = new T.PlaneGeometry(4.2, 2.8);
  const leaf2 = new T.PlaneGeometry(4.2, 2.8);
  leaf2.rotateY(Math.PI / 2);
  const leaf3 = new T.PlaneGeometry(3.6, 3.2);
  leaf3.rotateX(-Math.PI / 2);
  leaf3.translate(0, 0.4, 0);
  kit.instGeo('leaf', mergeGeometries([leaf1.toNonIndexed(), leaf2.toNonIndexed(), leaf3.toNonIndexed()], false), 'leaf');
}

function lantern(kit, x, y, z, s = 1, ry = 0) {
  ensureShapes(kit);
  kit.inst('lantern', x, y, z, ry, 0.3 * s, 0.4 * s, 0.3 * s);
  kit.inst('lanternCap', x, y + 0.4 * s, z, ry, s, s, s);
  kit.inst('lanternCap', x, y - 0.4 * s, z, ry, s, s, s);
  kit.inst('lanternTassel', x, y - 0.66 * s, z, 0, s, s, s);
}

function lanternString(kit, x0, x1, y, z, count, s = 0.9) {
  const T = kit.T;
  kit.beam(new T.Vector3(x0, y + 0.5, z), new T.Vector3(x1, y + 0.5, z), 0.05, 0.05, 'woodDark');
  for (let i = 0; i < count; i++) {
    const x = lerp(x0, x1, (i + 0.5) / count);
    kit.beam(new T.Vector3(x, y + 0.5, z), new T.Vector3(x, y + 0.27, z), 0.03, 0.03, 'woodDark');
    lantern(kit, x, y, z, s);
  }
}

function bambooClump(kit, cx, cz, rx, rz, n, seed, hMin = 5, hMax = 9) {
  ensureShapes(kit);
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const rad = Math.sqrt(r());
    const x = cx + Math.cos(a) * rx * rad;
    const z = cz + Math.sin(a) * rz * rad;
    const h = hMin + r() * (hMax - hMin);
    kit.inst('culm', x, 0, z, r() * 6.283, 0.8 + r() * 0.55, h, 0.8 + r() * 0.55);
    kit.inst('leaf', x, h * 0.82, z, r() * 6.283, 1.45 + r() * 0.5, 1.1 + r() * 0.4, 1);
    kit.inst('leaf', x, h * 0.64, z, r() * 6.283, 1.15 + r() * 0.4, 0.95, 1);
    if (i % 2 === 0) kit.inst('leaf', x, h * 0.48, z, r() * 6.283, 0.9 + r() * 0.3, 0.8, 1);
  }
  shrub(kit, cx + rx * 0.4, cz, 0.7, 'foliageDark');
  shrub(kit, cx - rx * 0.3, cz + rz * 0.4, 0.6, 'foliageDark');
}

function tree(kit, x, z, s = 1, kind = 'green', seed = 1) {
  const T = kit.T;
  const r = rng(seed);
  const th = 2.6 * s;
  kit.cyl(0.16 * s, 0.3 * s, th, 6, x, th / 2, z, 'trunk');
  kit.cyl(0.1 * s, 0.16 * s, 1.8 * s, 5, x + 0.35 * s, th + 0.55 * s, z, 'trunk', 0, 0, 0.35);
  const key = kind === 'gold' ? 'ginkgo' : kind === 'dark' ? 'foliageDark' : 'foliage';
  const blobs = 3;
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2 + r() * 0.8;
    const rad = (0.75 + r() * 0.65) * s;
    const bx = x + Math.cos(a) * 0.8 * s;
    const bz = z + Math.sin(a) * 0.8 * s;
    const by = th + 1.65 * s + (r() - 0.5) * 0.7 * s;
    kit.add(new T.IcosahedronGeometry(rad, 0), key, bx, by, bz, r(), r(), r(), 1.15, 0.8, 1.05);
  }
  kit.add(new T.IcosahedronGeometry(1.25 * s, 0), key, x, th + 2.5 * s, z, r(), r(), r(), 1.3, 0.85, 1.15);
}

function shrub(kit, x, z, s = 1, key = 'foliageDark') {
  const T = kit.T;
  kit.add(new T.IcosahedronGeometry(0.8 * s, 0), key, x, 0.55 * s, z, 0, 0, 0, 1.3, 0.75, 1.1);
}

function pottedPlant(kit, x, z, s = 1) {
  const T = kit.T;
  kit.cyl(0.3 * s, 0.22 * s, 0.45 * s, 8, x, 0.225 * s, z, 'terracotta');
  kit.add(new T.IcosahedronGeometry(0.55 * s, 1), 'foliage', x, 0.8 * s, z, 0, 0, 0, 1, 1.2, 1);
}

function wallRun(kit, ax, az, bx, bz, h, th, key = 'red', cap = true) {
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz);
  if (len < 0.1) return;
  const ry = Math.atan2(-dz, dx);
  const mx = (ax + bx) / 2, mz = (az + bz) / 2;
  kit.box(len, h, th, mx, h / 2, mz, key, ry);
  kit.box(len + 0.06, 0.5, th + 0.12, mx, 0.25, mz, 'stoneDark', ry);
  if (cap) {
    kit.box(len + 0.2, 0.26, th + 0.46, mx, h + 0.13, mz, 'ridge', ry);
    kit.box(len + 0.12, 0.18, th + 0.16, mx, h + 0.34, mz, 'tilePlain', ry);
  }
}

function railing(kit, ax, az, bx, bz, y, h, key = 'red', spacing = 1.8) {
  const T = kit.T;
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz);
  if (len < 0.1) return;
  const n = Math.max(1, Math.round(len / spacing));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = ax + dx * t, z = az + dz * t;
    kit.box(0.14, h, 0.14, x, y + h / 2, z, key);
  }
  kit.beam(new T.Vector3(ax, y + h - 0.06, az), new T.Vector3(bx, y + h - 0.06, bz), 0.16, 0.12, key);
  kit.beam(new T.Vector3(ax, y + h * 0.42, az), new T.Vector3(bx, y + h * 0.42, bz), 0.1, 0.1, key);
}

function railingBox(kit, hw, hd, y, h, key = 'red') {
  railing(kit, -hw, -hd, hw, -hd, y, h, key);
  railing(kit, hw, -hd, hw, hd, y, h, key);
  railing(kit, hw, hd, -hw, hd, y, h, key);
  railing(kit, -hw, hd, -hw, -hd, y, h, key);
}

function stairs(kit, o) {
  const T = kit.T;
  const n = o.steps || 10;
  const rise = o.rise || 0.6;
  const run = o.run || 0.9;
  const w = o.w || 4;
  const key = o.key || 'stone';
  for (let i = 0; i < n; i++) {
    const top = o.y - i * rise;
    if (top <= 0.05) break;
    const dir = o.dir || 1;
    const x = o.x + dir * (i + 0.5) * run;
    kit.box(run + 0.02, top, w, x, top / 2, o.z, key);
  }
}

function pave(kit, w, d, x, z, key = 'pavingTri', y = 0.03, ry = 0) {
  const T = kit.T;
  const g = new T.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  g.rotateY(ry);
  kit.add(g, key, x, y, z);
}

function plaque(kit, text, w, h, x, y, z, ry = 0, style = 'ink', vertical = false) {
  const T = kit.T;
  const n = { x: Math.sin(ry), z: Math.cos(ry) };
  kit.box(w + 0.34, h + 0.26, 0.18, x - n.x * 0.08, y, z - n.z * 0.08, 'woodDark', ry);
  kit.box(w + 0.5, 0.12, 0.24, x - n.x * 0.06, y + h / 2 + 0.18, z - n.z * 0.06, 'gold', ry);
  const g = new T.PlaneGeometry(w, h);
  kit.add(g, `plaque|${text}|${vertical ? 1 : 0}|${style}`, x + n.x * 0.06, y, z + n.z * 0.06, 0, ry, 0);
}

function doorPanel(kit, w, h, x, y, z, ry = 0, double = true) {
  const T = kit.T;
  const n = { x: Math.sin(ry), z: Math.cos(ry) };
  kit.box(w + 0.35, h + 0.25, 0.16, x, y + 0.02, z, 'woodDark', ry);
  const panels = double ? 2 : 1;
  const pw = (w - 0.1) / panels;
  for (let i = 0; i < panels; i++) {
    const off = (i - (panels - 1) / 2) * pw;
    const px = x + n.x * 0.1 + Math.cos(ry) * off;
    const pz = z + n.z * 0.1 - Math.sin(ry) * off;
    const g = new T.PlaneGeometry(pw - 0.08, h - 0.12);
    kit.add(g, 'lattice', px, y, pz, 0, ry, 0);
  }
  kit.box(w + 0.6, 0.18, 0.35, x, y + h / 2 + 0.1, z, 'wood', ry);
}

function stoneDrum(kit, x, z, s = 1, ky = 0) {
  const T = kit.T;
  kit.box(0.75 * s, 0.35 * s, 0.6 * s, x, 0.18 * s + ky, z, 'stone', 0);
  kit.cyl(0.38 * s, 0.45 * s, 0.62 * s, 10, x, 0.68 * s + ky, z, 'stone', 0, 0, Math.PI / 2);
  kit.add(new T.SphereGeometry(0.16 * s, 8, 6), 'stoneLight', x, ky + 1.05 * s, z, 0, 0, 0, 1, 1, 1);
}

function incenseBurner(kit, x, z, s = 1, ky = 0) {
  const T = kit.T;
  kit.box(3.0 * s, 0.5 * s, 3.0 * s, x, ky + 0.25 * s, z, 'stone');
  kit.box(2.4 * s, 0.35 * s, 2.4 * s, x, ky + 0.68 * s, z, 'stoneLight');
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    kit.cyl(0.12 * s, 0.16 * s, 0.75 * s, 6, x + Math.cos(a) * 0.65 * s, ky + 1.15 * s, z + Math.sin(a) * 0.65 * s, 'bronze');
  }
  kit.cyl(0.95 * s, 0.72 * s, 1.05 * s, 10, x, ky + 1.9 * s, z, 'bronze');
  kit.cyl(1.02 * s, 1.02 * s, 0.16 * s, 10, x, ky + 2.45 * s, z, 'gold');
  // smoke escape: a small four-post canopy
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.cyl(0.05 * s, 0.05 * s, 1.25 * s, 5, x + sx * 0.78 * s, ky + 3.1 * s, z + sz * 0.78 * s, 'woodDark');
  kit.add(hornlessPyramid(T, 2.4 * s, 2.4 * s, ky + 3.65 * s, 0.9 * s), 'tile', x, 0, z);
  kit.add(new T.SphereGeometry(0.16 * s, 6, 4), 'gold', x, ky + 4.75 * s, z);
}

// tiny square pyramidal cap used by the incense burner
function hornlessPyramid(T, w, d, y0, rise) {
  const shell = loftRoofGeo(T, { w0: w, d0: d, w1: 0.02, d1: 0.02, y0, y1: y0 + rise, cornerLift: 0.2, apex: true, segV: 3, nx: 6, nz: 5 });
  return shell.geo;
}

function gateRoof(kit, w, d, y0, rise, cx = 0, cz = 0) {
  return roofXieshan(kit, { w, d, y0, rise, cx, cz, cornerLift: 1.0 });
}

// gate house / 门头 with a small tiled roof
function gateHouse(kit, x, z, w, d, h, plaqueText) {
  const T = kit.T;
  kit.box(w, h, d, x, h / 2, z, 'brickTri');
  kit.box(w + 0.4, 0.35, d + 0.4, x, h - 0.2, z, 'stone');
  kit.box(1.8, 2.5, 0.3, x, 1.25, z - d / 2 - 0.12, 'woodDark');
  if (plaqueText) plaque(kit, plaqueText, 1.5, 0.55, x, 3.1, z - d / 2 - 0.22, Math.PI);
  roofGable(kit, { w: w + 1.2, d: d + 1.6, y0: h + 0.3, rise: 1.7, cx: x, cz: z, cornerLift: 0.4 });
}

function hangingBanner(kit, text, x, z, y, style = 'red', ry = Math.PI / 2, scale = 1) {
  const T = kit.T;
  kit.beam(new T.Vector3(x, y + 0.1, z), new T.Vector3(x, y - 1.9 * scale, z), 0.05, 0.05, 'woodDark');
  kit.beam(new T.Vector3(x - 0.5, y + 0.1, z), new T.Vector3(x + 0.5, y + 0.1, z), 0.06, 0.06, 'woodDark');
  const g = new T.PlaneGeometry(0.95 * scale, 2.2 * scale);
  kit.add(g, `banner|${text}|${style}`, x, y - 1.35 * scale, z, 0, ry, 0);
}

function clothAwning(kit, x, z, w, d, y, ry = 0) {
  const T = kit.T;
  const g = new T.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2 + 0.18);
  kit.add(g, 'awning', x, y, z, 0, ry, 0);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      kit.cyl(0.06, 0.06, y, 5, x + Math.cos(ry) * sx * w / 2 - Math.sin(ry) * sz * d / 2, y / 2, z - Math.sin(ry) * sx * w / 2 - Math.cos(ry) * sz * d / 2, 'woodDark');
    }
  }
}

function teaTable(kit, x, z, s = 1, ry = 0) {
  const T = kit.T;
  kit.cyl(0.55 * s, 0.55 * s, 0.08 * s, 10, x, 0.72 * s, z, 'woodLight');
  kit.cyl(0.08 * s, 0.1 * s, 0.7 * s, 5, x, 0.36 * s, z, 'woodDark');
  for (let i = 0; i < 2; i++) {
    const a = ry + i * Math.PI;
    const cx = x + Math.cos(a) * 0.95 * s, cz = z + Math.sin(a) * 0.95 * s;
    kit.box(0.5 * s, 0.1 * s, 0.5 * s, cx, 0.45 * s, cz, 'bamboo');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.cyl(0.035 * s, 0.035 * s, 0.44 * s, 4, cx + sx * 0.19 * s, 0.22 * s, cz + sz * 0.19 * s, 'bamboo');
    kit.box(0.5 * s, 0.55 * s, 0.08 * s, cx, 0.82 * s, cz + 0.22 * s, 'bamboo');
  }
}

function stoneLantern(kit, x, z, s = 1) {
  const T = kit.T;
  kit.cyl(0.3 * s, 0.4 * s, 1.2 * s, 6, x, 0.6 * s, z, 'stone');
  kit.box(0.9 * s, 0.2 * s, 0.9 * s, x, 1.28 * s, z, 'stoneLight');
  kit.box(0.6 * s, 0.6 * s, 0.6 * s, x, 1.65 * s, z, 'stoneLight');
  kit.add(hornlessPyramid(T, 1.1 * s, 1.1 * s, 1.95 * s, 0.5 * s), 'stoneLight', x, 0, z);
}

function stoneHitchingPost(kit, x, z) {
  const T = kit.T;
  kit.box(0.34, 1.35, 0.34, x, 0.675, z, 'stone');
  kit.box(0.5, 0.3, 0.34, x, 1.45, z, 'stoneDark');
  kit.box(0.42, 0.25, 0.2, x, 1.02, z, 'stoneDark');
}

// a red wall with a tiled coping, subdivided so it curves
function redWallPath(kit, pts, h, th = 0.75) {
  for (let i = 0; i < pts.length - 1; i++) {
    wallRun(kit, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], h, th, 'red', true);
  }
}

function wornStonePath(kit, pts, width = 3.4, key = 'stoneTri', y = 0.05) {
  const T = kit.T;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1];
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 0.2) continue;
    const ry = Math.atan2(-dz, dx);
    const g = new T.PlaneGeometry(len + 0.4, width);
    g.rotateX(-Math.PI / 2);
    kit.add(g, key, (ax + bx) / 2, y, (az + bz) / 2, 0, ry, 0);
  }
}

function tileRidgeBeams(kit, x0, x1, y, z, w = 0.3) {
  kit.box(x1 - x0, 0.32, w, (x0 + x1) / 2, y + 0.1, z, 'ridge');
}

// ---------------------------------------------------------------------------------------------
// Whole-building composites shared by the temple / street landmarks
// ---------------------------------------------------------------------------------------------
// front steps descending toward −z from a platform's front edge
function stairsFront(kit, x, zEdge, w, baseH, mat = 'stoneLight') {
  const n = 4;
  for (let i = 0; i < n; i++) {
    const top = Math.max(0.12, baseH * (1 - (i + 1) * 0.23));
    kit.box(w, top, 0.5, x, top / 2, zEdge - (i + 0.5) * 0.48, mat);
  }
}

// A timber hall: stone platform, red colonnade, white plaster body, lattice doors,
// 匾额 and a 歇山 roof (optionally 重檐). Ridge along x, front facing −z.
function hall(kit, o) {
  const T = kit.T;
  const x = o.x || 0, z = o.z || 0;
  const w = o.w, d = o.d, h = o.h;
  const baseH = o.baseH === undefined ? 1.0 : o.baseH;
  const rise = o.rise === undefined ? Math.min(6.2, Math.max(2.6, d * 0.32)) : o.rise;
  const doubleEave = !!o.doubleEave;
  const nBays = o.bays || Math.max(3, Math.round(w / 5.6));
  const wallW = w - 1.6, wallD = d - 1.6;
  const frontWall = z - wallD / 2;
  const col = o.column || 'red';

  // platform + moulding + front steps
  kit.box(w + 4, baseH, d + 4, x, baseH / 2, z, o.plinth || 'stoneLight');
  kit.box(w + 4.6, 0.24, d + 4.6, x, baseH + 0.06, z, 'stone');
  stairsFront(kit, x, z - d / 2 - 2, Math.min(w * 0.46, 9), baseH);

  // white plaster body on a grey brick dado
  kit.box(wallW, h, wallD, x, baseH + h / 2, z, 'plaster');
  kit.box(wallW + 0.14, Math.min(1.1, h * 0.28), wallD + 0.14, x, baseH + Math.min(1.1, h * 0.28) / 2, z, 'brickTri');

  // red colonnade on the two long facades
  const colY = baseH + h / 2;
  for (let i = 0; i <= nBays; i++) {
    const px = x - w / 2 + (w * i) / nBays;
    for (const sz of [-1, 1]) {
      kit.cyl(0.34, 0.38, 0.26, 8, px, baseH + 0.13, z + (sz * d) / 2, 'stoneLight');
      kit.cyl(0.27, 0.31, h + 0.2, 8, px, colY + 0.06, z + (sz * d) / 2, col);
      // bracket set
      kit.box(0.62, 0.2, 0.36, px, baseH + h - 0.5, z + (sz * d) / 2, 'wood');
      kit.box(0.3, 0.28, 0.52, px, baseH + h - 0.32, z + (sz * d) / 2 - sz * 0.24, 'woodDark');
    }
  }
  for (const sz of [-1, 1]) kit.box(w + 1.0, 0.42, 0.4, x, baseH + h - 0.16, z + (sz * d) / 2, 'wood');
  for (const sx of [-1, 1]) kit.box(0.4, 0.42, d + 1.0, x + (sx * w) / 2, baseH + h - 0.16, z, 'wood');

  // door + lattice windows on the front, smaller windows at the sides
  const doorH = Math.min(3.5, h * 0.56);
  const doorW = Math.min(3.2, w * 0.17);
  doorPanel(kit, doorW, doorH, x, baseH + doorH / 2 + 0.08, frontWall - 0.02, Math.PI);
  const wy = baseH + h * 0.57;
  const wh = Math.min(2.6, h * 0.38);
  const wx = Math.min(w * 0.3, 3.6);
  for (const sx of [-1, 1]) {
    const g = new T.PlaneGeometry(1.9, wh);
    kit.add(g, 'lattice', x + sx * wx, wy, frontWall - 0.03, 0, Math.PI, 0);
    kit.box(2.2, 0.15, 0.16, x + sx * wx, wy + wh / 2 + 0.08, frontWall - 0.06, 'woodDark');
    kit.box(2.2, 0.15, 0.16, x + sx * wx, wy - wh / 2 - 0.08, frontWall - 0.06, 'woodDark');
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const g = new T.PlaneGeometry(1.8, wh);
      kit.add(g, 'lattice', x + sx * (wallW / 2 + 0.02), wy, z + sz * w * 0.22, 0, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
    }
  }

  // 匾额, hung under the eave line at the front colonnade so the deep eaves cannot hide it
  if (o.plaqueText) {
    const py = doubleEave ? baseH + h * 0.56 : baseH + h * 0.86;
    const pw = Math.min(w * 0.34, 5.4);
    plaque(kit, o.plaqueText, pw, pw * 0.3, x, py, z - d / 2 - 0.45, Math.PI, o.plaqueStyle || 'ink');
  }

  // roof
  let top;
  if (doubleEave) {
    const yl = baseH + h * 0.66;
    roofSkirt(kit, {
      cx: x, cz: z, w: w + 7, d: d + 7, wIn: wallW, dIn: wallD,
      y0: yl, y1: yl + 1.55, cornerLift: 1.15, nx: 12, nz: 9,
    });
    top = roofXieshan(kit, {
      cx: x, cz: z, w: w + 4.4, d: d + 4.4, y0: baseH + h, rise,
      cornerLift: 1.28, upperW: 0.55, upperD: 0.44, nx: o.nx || 13, nz: o.nz || 9, gableMat: o.gableMat, horns: false,
    });
  } else {
    top = roofXieshan(kit, {
      cx: x, cz: z, w: w + 4.4, d: d + 4.4, y0: baseH + h, rise,
      cornerLift: 1.2, upperW: 0.56, upperD: 0.44, nx: o.nx || 13, nz: o.nz || 9, gableMat: o.gableMat, horns: false,
    });
  }
  for (const sx of [-1, 1]) lantern(kit, x + sx * (w / 2 - 0.6), baseH + h - 0.7, z - d / 2 - 0.9, 0.78);
  if (o.drums !== false) {
    for (const sx of [-1, 1]) stoneDrum(kit, x + sx * (doorW / 2 + 1.3), z - d / 2 - 3.0, 0.85, 0);
  }
  return top;
}

// A square 2-storey pavilion (bell / drum tower), 重檐攒尖.
function squarePavilion(kit, o) {
  const T = kit.T;
  const x = o.x || 0, z = o.z || 0, w = o.w || 8;
  const h = o.h || 3.4, baseH = o.baseH === undefined ? 0.8 : o.baseH;
  kit.box(w + 2.2, baseH, w + 2.2, x, baseH / 2, z, 'stoneLight');
  kit.box(w + 0.6, 0.24, w + 0.6, x, baseH + 0.08, z, 'stone');
  // brick lower room with lattice panels
  kit.box(w - 0.6, 1.15, w - 0.6, x, baseH + 0.58, z, 'brickTri');
  for (const face of [0, 1, 2, 3]) {
    const sg = face % 2 === 0 ? 1 : -1;
    if (face < 2) {
      const g = new T.PlaneGeometry(w * 0.52, 1.4);
      kit.add(g, 'lattice', x, baseH + 1.55, z + sg * (w / 2 - 0.3), 0, sg > 0 ? 0 : Math.PI, 0);
    } else {
      const g = new T.PlaneGeometry(w * 0.52, 1.4);
      kit.add(g, 'lattice', x + sg * (w / 2 - 0.3), baseH + 1.55, z, 0, sg > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
    }
  }
  // eight columns
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      kit.cyl(0.3, 0.34, h, 8, x + sx * w / 2, baseH + h / 2, z + sz * w / 2, 'red');
    }
    kit.cyl(0.26, 0.3, h, 8, x + sx * w / 2, baseH + h / 2, z, 'red');
    kit.cyl(0.26, 0.3, h, 8, x, baseH + h / 2, z + sx * w / 2, 'red');
  }
  for (const sz of [-1, 1]) kit.box(w + 0.8, 0.38, 0.34, x, baseH + h - 0.18, z + sz * w / 2, 'wood');
  for (const sx of [-1, 1]) kit.box(0.34, 0.38, w + 0.8, x + sx * w / 2, baseH + h - 0.18, z, 'wood');
  if (o.doubleEave !== false) {
    roofSkirt(kit, { cx: x, cz: z, w: w + 3.4, d: w + 3.4, wIn: w * 0.66, dIn: w * 0.66, y0: baseH + h, y1: baseH + h + 1.15, cornerLift: 0.95, nx: 10, nz: 8 });
    // upper drum
    kit.box(w * 0.6, 1.75, w * 0.6, x, baseH + h + 1.55, z, 'plaster');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.cyl(0.22, 0.24, 1.9, 8, x + sx * w * 0.31, baseH + h + 1.6, z + sz * w * 0.31, 'red');
    for (const sx of [-1, 1]) {
      const g = new T.PlaneGeometry(w * 0.34, 1.1);
      kit.add(g, 'lattice', x, baseH + h + 1.5, z + sx * (w * 0.31), 0, sx > 0 ? 0 : Math.PI, 0);
    }
    const top = roofPyramid(kit, { cx: x, cz: z, w: w * 0.86, d: w * 0.86, y0: baseH + h + 2.4, rise: 2.3, cornerLift: 0.9, nx: 8, nz: 6 });
    kit.cyl(0.45, 0.55, 0.4, 8, x, baseH + h + 4.7, z, 'gold');
    kit.add(new T.SphereGeometry(0.35, 8, 6), 'gold', x, baseH + h + 5.25, z);
    kit.cyl(0.03, 0.13, 0.9, 6, x, baseH + h + 5.85, z, 'gold');
    if (o.plaqueText) plaque(kit, o.plaqueText, 2.0, 0.7, x, baseH + h - 1.0, z - w / 2 - 1.75, Math.PI, 'ink');
    for (const sx of [-1, 1]) lantern(kit, x + sx * (w / 2 + 0.4), baseH + h - 0.8, z - w / 2 - 0.8, 0.7);
    return top + 0.4;
  }
  const top = roofPyramid(kit, { cx: x, cz: z, w: w + 3.4, d: w + 3.4, y0: baseH + h, rise: 2.7, cornerLift: 0.9, nx: 8, nz: 6 });
  return top;
}

// A 川西民居 shop-house on a lane: grey brick + white plaster, timber shopfront,
// a tiled gable roof with modest upturned corners, optional 门头 and hanging 幌子.
function shopHouse(kit, o) {
  const T = kit.T;
  const { x, z, w, d, face = 1, h = 5.0, two = false, gate = false, sign = '', banner = '', awning = false } = o;
  const front = z + (face * d) / 2;
  const fy = 0.45;
  kit.box(w + 0.2, 0.45, d + 0.2, x, 0.225, z, 'stoneDark');
  const lowH = two ? h * 0.54 : h;
  kit.box(w, lowH, d, x, fy + lowH / 2, z, 'brickTri');
  if (two) kit.box(w - 0.06, h - lowH, d - 0.06, x, fy + lowH + (h - lowH) / 2, z, 'plaster');
  // timber shopfront
  const panelH = Math.min(2.7, lowH * 0.62);
  kit.box(w - 0.9, panelH, 0.18, x, fy + panelH / 2, front + face * 0.1, 'door');
  kit.box(1.8, 2.35, 0.2, x, fy + 1.17, front + face * 0.2, 'woodDark');
  for (const sx of [-1, 1]) {
    const g = new T.PlaneGeometry(1.7, 1.4);
    kit.add(g, 'lattice', x + sx * w * 0.27, fy + 1.6, front + face * 0.21, 0, face > 0 ? 0 : Math.PI, 0);
    kit.box(2.0, 0.12, 0.5, x + sx * w * 0.27, fy + 0.82, front + face * 0.35, 'wood');
  }
  if (two) {
    for (const sx of [-1, 1]) {
      const g = new T.PlaneGeometry(1.75, 1.4);
      kit.add(g, 'lattice', x + sx * (w * 0.24), fy + lowH + 0.92, front + face * 0.09, 0, face > 0 ? 0 : Math.PI, 0);
      if (!o.simple) {
        kit.box(2.0, 0.12, 0.12, x + sx * (w * 0.24), fy + lowH + 1.66, front + face * 0.14, 'woodDark');
        kit.box(2.0, 0.12, 0.12, x + sx * (w * 0.24), fy + lowH + 0.2, front + face * 0.14, 'woodDark');
      }
    }
    kit.box(w - 0.8, 0.14, 0.9, x, fy + lowH + 0.16, front + face * 0.43, 'wood');
    if (o.simple) {
      kit.box(w - 0.9, 0.09, 0.12, x, fy + lowH + 0.95, front + face * 0.45, 'woodDark');
      kit.box(w - 0.9, 0.07, 0.1, x, fy + lowH + 0.55, front + face * 0.45, 'woodDark');
    } else {
      railing(kit, x - w / 2 + 0.45, front + face * 0.45, x + w / 2 - 0.45, front + face * 0.45, fy + lowH + 0.24, 0.68, 'woodDark', 1.7);
    }
  }
  if (sign) plaque(kit, sign, Math.min(w * 0.44, 2.8), 0.82, x, fy + 3.0, front + face * 0.3, face > 0 ? 0 : Math.PI, 'ink');
  if (awning) clothAwning(kit, x, front + face * 1.2, Math.min(w - 1.6, 4.8), 2.1, fy + 2.72, 0);
  if (banner) hangingBanner(kit, banner, x - w * 0.3, front + face * 1.2, fy + 3.05, 'red', face > 0 ? 0 : Math.PI, 0.9);
  const lights = o.lights === undefined ? 2 : o.lights;
  if (lights >= 1) lantern(kit, x - (w / 2 - 0.7), fy + 2.75, front + face * 0.82, 0.66);
  if (lights >= 2) lantern(kit, x + (w / 2 - 0.7), fy + 2.75, front + face * 0.82, 0.66);
  const top = roofGable(kit, {
    cx: x, cz: z, w: w + 1.3, d: d + 2.8,
    y0: fy + h + 0.1, rise: 1.65 + Math.min(0.9, Math.max(0, h - 4) * 0.22),
    cornerLift: 0.36, nx: 5, nz: 3, segV: 3, ridgeOverhang: 0.5,
    gableMat: two ? 'plaster2' : 'brickTri', horns: false, barge: !o.simple, medallion: !o.simple,
  });
  let highest = top;
  if (gate) {
    const gx = x, gz = front + face * 1.55;
    for (const sx of [-1, 1]) kit.box(1.15, 4.5, 1.1, gx + sx * 1.9, 2.25, gz, 'brickTri');
    kit.box(4.4, 0.6, 1.2, gx, 4.55, gz, 'wood');
    plaque(kit, o.plaqueText || '门头', 2.5, 0.8, gx, 3.9, gz + face * 0.62, face > 0 ? 0 : Math.PI, 'ink');
    highest = Math.max(highest, roofXieshan(kit, { cx: gx, cz: gz, w: 6.2, d: 3.6, y0: 4.85, rise: 1.9, cornerLift: 0.8, nx: 7, nz: 5, upperW: 0.55, upperD: 0.4 }));
    stoneHitchingPost(kit, gx + 2.8, gz + face * 0.2);
    stoneHitchingPost(kit, gx - 2.8, gz + face * 0.2);
  }
  return highest;
}

// bamboo picket fence along a polyline
function bambooFence(kit, pts, h = 1.45) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.2) continue;
    const n = Math.max(1, Math.round(len / 2.6));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      kit.box(0.1, h, 0.1, ax + (bx - ax) * t, h / 2, az + (bz - az) * t, 'bambooDry');
    }
    for (const yy of [h * 0.32, h * 0.78]) {
      kit.beam(new kit.T.Vector3(ax, yy, az), new kit.T.Vector3(bx, yy, bz), 0.07, 0.07, 'bambooDry');
    }
  }
}

// a circular "moon gate" opening in a wall (visual, the wall is solid behind)
function moonGate(kit, x, z, ry, r = 1.6, wallH = 3.2) {
  const T = kit.T;
  const nx = Math.sin(ry), nz = Math.cos(ry);
  const cy = Math.min(wallH - 0.1, r + 0.28);
  kit.add(new T.CircleGeometry(r, 24), 'black', x + nx * 0.04, cy, z + nz * 0.04, 0, ry, 0);
  kit.add(new T.TorusGeometry(r + 0.1, 0.16, 5, 24), 'stoneLight', x + nx * 0.07, cy, z + nz * 0.07, 0, ry, 0);
  kit.box(1.6, 0.18, 0.5, x, 0.09, z, 'stoneLight', ry);
}

// red lanterns strung across a lane between two poles
function crossLanterns(kit, x, za, zb, y, count) {
  const T = kit.T;
  for (const z of [za, zb]) {
    kit.cyl(0.09, 0.11, y, 5, x, y / 2, z, 'woodDark');
    kit.box(0.5, 0.18, 0.5, x, 0.12, z, 'stone');
  }
  kit.beam(new T.Vector3(x, y, za), new T.Vector3(x, y, zb), 0.04, 0.04, 'woodDark');
  for (let i = 0; i < count; i++) {
    const z = lerp(za, zb, (i + 0.5) / count);
    kit.beam(new T.Vector3(x, y, z), new T.Vector3(x, y - 0.25, z), 0.03, 0.03, 'woodDark');
    lantern(kit, x, y - 0.55, z, 0.62);
  }
}


// =============================================================================================
// 3 · 文殊院 — Buddhist monastery: 山门, 天王殿, 大雄宝殿, bell & drum pavilions, courtyard 香炉.
// The compound axis runs along z; all hall ridges run along x, so no rotation is needed.
// =============================================================================================
function buildWenshu({ THREE: T, site }) {
  const kit = new Kit(T);
  // courtyard paving + planting beds
  pave(kit, 158, 90, 0, 0, 'stoneTri', 0.05);
  kit.box(8, 0.11, 74, 0, 0.1, -6, 'pavingTri');
  for (const sx of [-1, 1]) {
    kit.box(26, 0.16, 70, sx * 60, 0.12, 0, 'garden');
    for (let i = 0; i < 4; i++) shrub(kit, sx * (48 + i * 6), -24 + i * 15, 0.85, 'foliageDark');
  }
  // monastery walls (a gate opening is left in the front wall; the wall sits just behind the gate)
  wallRun(kit, -80, -44, -14, -44, 4.2, 0.85);
  wallRun(kit, 14, -44, 80, -44, 4.2, 0.85);
  wallRun(kit, 80, -44, 80, 46, 4.2, 0.85);
  wallRun(kit, 80, 46, -80, 46, 4.2, 0.85);
  wallRun(kit, -80, 46, -80, -44, 4.2, 0.85);

  // 山门 (three doors) and its forecourt
  hall(kit, { x: 0, z: -40, w: 26, d: 11, h: 5.8, baseH: 0.8, rise: 3.5, plaqueText: '文殊院', bays: 5, gableMat: 'plaster2' });
  for (const sx of [-1, 1]) {
    doorPanel(kit, 2.3, 3.2, sx * 6.1, 1.75, -44.72, Math.PI);
    stoneLantern(kit, sx * 8.5, -47.6, 0.85);
  }
  plaque(kit, '文殊院', 4.4, 1.3, 0, 4.5, -34.2, 0, 'ink');

  // 天王殿
  hall(kit, { x: 0, z: -18, w: 30, d: 15, h: 6.6, baseH: 0.95, rise: 3.4, plaqueText: '天王殿', bays: 5 });
  for (const sx of [-1, 1]) doorPanel(kit, 2.2, 3.1, sx * 6.4, 1.9, -25.7, Math.PI);

  // bell & drum pavilions flanking the gate courtyard
  squarePavilion(kit, { x: -40, z: -26, w: 8.4, h: 3.5, baseH: 0.8, plaqueText: '钟楼' });
  squarePavilion(kit, { x: 40, z: -26, w: 8.4, h: 3.5, baseH: 0.8, plaqueText: '鼓楼' });
  for (const sx of [-1, 1]) {
    for (const [bx, bz, r] of [[sx * 25, 16, 1.1], [sx * 62, 16, 1.4], [sx * 26, 27, 1.0], [sx * 62, 27, 1.2], [sx * 66, -25, 1.3]]) shrub(kit, bx, bz, r, sx > 0 ? 'foliageDark' : 'foliage');
    kit.add(new T.DodecahedronGeometry(1.2, 0), 'stoneDark', sx * 20, 0.5, 24, 0, sx, 0, 1.2, 0.7, 1.0);
  }

  // central courtyard: 香炉, stone lanterns, path
  incenseBurner(kit, 0, -2.5, 1.25, 0.05);
  for (const sx of [-1, 1]) stoneLantern(kit, sx * 7.4, -2.5, 0.9);
  for (const sx of [-1, 1]) kit.box(1.8, 0.5, 0.6, sx * 5.2, 0.3, -31.5, 'stoneLight');

  // 大雄宝殿: raised, double-eaved, the tallest roof in the compound
  hall(kit, {
    x: 0, z: 19, w: 36, d: 20, h: 9.0, baseH: 1.3, rise: 5.0,
    doubleEave: true, plaqueText: '大雄宝殿', bays: 7, gableMat: 'plaster2',
  });
  for (const sx of [-1, 1]) stoneLantern(kit, sx * 12, 6.2, 0.85);
  for (const sx of [-1, 1]) kit.box(1.2, 0.8, 1.2, sx * 14, 0.4, 5.2, 'stone');

  // rear garden, closed by the wall; trees and bamboo keep it from reading empty
  for (const sx of [-1, 1]) {
    tree(kit, sx * 26, 35, 1.1, sx > 0 ? 'green' : 'ginkgo', 430 + sx);
    bambooClump(kit, sx * 14, 40, 5, 3, 10, 440 + sx, 6, 9);
  }
  for (const sx of [-1, 1]) kit.box(2.2, 0.32, 0.5, sx * 7.5, 0.5, 33.4, 'stoneLight');

  // side garden walls with moon gates
  for (const sx of [-1, 1]) {
    wallRun(kit, sx * 48, -22, sx * 48, -8, 3.2, 0.7);
    wallRun(kit, sx * 48, 8, sx * 48, 22, 3.2, 0.7);
    moonGate(kit, sx * 48, 0, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 1.7, 3.2);
    kit.box(48, 0.16, 6, sx * 58, 0.13, -30, 'garden');
    bambooClump(kit, sx * 58, -10, 6, 14, 20, 100 + sx, 5.5, 9);
  }

  // courtyard trees
  const treeSpots = [[-30, 7, 'green'], [30, 7, 'gold'], [-28, -35, 'dark'], [28, -35, 'green'], [-20, 29, 'green'], [20, 29, 'ginkgo'], [0, 33, 'dark']];
  treeSpots.forEach(([x, z, k], i) => tree(kit, x, z, 1.05 + (i % 3) * 0.12, k, 300 + i));
  for (const sx of [-1, 1]) {
    kit.box(4.2, 0.45, 4.2, sx * 33, 0.24, -26, 'stone');
    shrub(kit, sx * 33, 22, 1.1);
  }
  // lanterns at the gate and the main hall
  for (const sx of [-1, 1]) {
    lantern(kit, sx * 10.5, 5.1, -45.6, 0.9);
    lantern(kit, sx * 16, 9.4, 7.0, 0.9);
  }

  return finishLandmark(kit, site, 170, 100, 16.4);
}

// =============================================================================================
// 4 · 宽窄巷子 — three parallel 川西民居 lanes: grey brick, white plaster, tiled gables,
// carved gate houses, stone hitching posts, tea awnings and lanterns.
// =============================================================================================
function buildKuanzhai({ THREE: T, site }) {
  const kit = new Kit(T);
  const lanes = [
    { z: 42, name: '宽巷子', wide: true },
    { z: 0, name: '窄巷子', wide: false },
    { z: -42, name: '井巷子', wide: false },
  ];
  const laneHalf = 4.2;
  const rowDepth = 15;
  const signs = ['盖碗茶', '川菜', '蜀锦', '小吃', '竹编', '糖画', '老茶', '酒'];
  const banners = ['茶', '酒', '川菜', '蜀锦'];

  // paving + back-garden strips
  for (const lane of lanes) {
    pave(kit, 178, 9.2, 0, lane.z, 'pavingTri', 0.045);
    for (const side of [-1, 1]) pave(kit, 178, 2.4, 0, lane.z + side * (laneHalf + 1.1), 'stoneTri', 0.055);
  }
  for (const z of [21, -21]) kit.box(174, 0.14, 3.4, 0, 0.07, z, 'garden');
  kit.box(174, 0.14, 3.4, 0, 0.07, 63.4, 'garden');
  kit.box(174, 0.14, 3.4, 0, 0.07, -63.4, 'garden');

  // six rows of shop-houses, 6 bays each
  lanes.forEach((lane, li) => {
    for (const side of [-1, 1]) {
      const face = -side;
      const frontEdge = lane.z + side * (laneHalf + 0.15);
      const centre = frontEdge + side * (rowDepth / 2);
      for (let m = 0; m < 4; m++) {
        const w = 34;
        const x = -54 + m * 36;
        const v = li * 13 + (side > 0 ? 5 : 0) + m;
        const two = (v % 2) === 0;
        const gate = m === 1 && li !== 2;
        const h = 4.5 + ((v * 7) % 4) * 0.42 + (two ? 0.4 : 0);
        const sign = signs[v % signs.length];
        const banner = m % 2 === 0 ? banners[v % banners.length] : '';
        const awning = lane.wide && m % 2 === 1;
        const lights = m === 1 ? 1 : 0;
        shopHouse(kit, {
          x, z: centre, w, d: rowDepth, face, h, two, gate,
          sign, banner, awning, lights, simple: !gate,
          plaqueText: gate ? (li === 0 ? '宽巷子' : li === 1 ? '窄巷子' : '井巷子') : undefined,
        });
        if (m === 1) stoneHitchingPost(kit, x + w * 0.32, frontEdge + face * 1.4);
        if (m === 3) pottedPlant(kit, x - w * 0.36, frontEdge + face * 1.15, 0.9);
      }
    }
  });

  // lane string lights (a light bamboo pole on each side)
  for (const lane of lanes) {
    for (const x of [-58, -12, 58]) {
      crossLanterns(kit, x, lane.z - 4.0, lane.z + 4.0, 5.4, 2);
    }
  }

  // 牌坊 at the west entrance of 宽巷子 (built facing −z locally, then turned to face −x)
  const paifang = (sub) => {
    for (const px of [-7.0, -2.5, 2.5, 7.0]) {
      sub.box(1.1, 0.45, 1.1, px, 0.22, 0, 'stone');
      sub.cyl(0.34, 0.42, 5.4, 8, px, 2.7, 0, 'red');
    }
    sub.box(16.0, 0.5, 0.55, 0, 4.95, 0, 'wood');
    sub.box(15.0, 0.35, 0.45, 0, 5.55, 0, 'red');
    plaque(sub, '宽窄巷子', 4.4, 1.35, 0, 4.55, -0.42, Math.PI, 'ink');
    roofXieshan(sub, { cx: 0, cz: 0, w: 6.2, d: 3.4, y0: 5.75, rise: 2.0, cornerLift: 0.85, nx: 7, nz: 5, upperW: 0.55, upperD: 0.4 });
    for (const px of [-7.0, 7.0]) {
      roofGable(sub, { cx: px, cz: 0, w: 5.0, d: 3.0, y0: 4.95, rise: 1.4, cornerLift: 0.35, nx: 5, nz: 3, segV: 3, horns: false, gableMat: 'plaster2' });
    }
    for (const px of [-4.7, 4.7]) {
      sub.cyl(0.25, 0.3, 0.7, 8, px, 4.75, 0, 'stoneLight');
    }
  };
  kit.addSub(-88, 42, Math.PI / 2, paifang);

  // vertical stone steles with the three lane names
  lanes.forEach((lane, i) => {
    const x = -88.5, z = lane.z + (i === 0 ? 8.5 : 9.5);
    kit.box(1.6, 2.6, 0.55, x, 1.3, z, 'stoneLight');
    kit.box(1.9, 0.26, 0.85, x, 2.68, z, 'stone');
    kit.add(hornlessPyramid(kit.T, 2.0, 0.9, 2.75, 0.35), 'tile', x, 0, z);
    kit.add(new T.PlaneGeometry(1.0, 1.9), `plaque|${lane.name}|1|ink`, x - 0.29, 1.45, z, 0, -Math.PI / 2, 0);
  });

  // tea corner in 宽巷子
  const teaZ = 42 + 3.0;
  clothAwning(kit, 8, teaZ, 8.5, 2.6, 2.9, 0);
  teaTable(kit, 6.4, teaZ, 1.1, 0);
  teaTable(kit, 9.6, teaZ, 1.1, Math.PI);
  for (const [x, z] of [[-30, 34], [28, 34], [46, 50], [-12, -34], [36, -50]]) pottedPlant(kit, x, z, 1.0);
  for (const lane of lanes) {
    kit.box(2.4, 0.38, 0.6, -8, 0.19, lane.z + 2.7, 'stoneLight');
    pottedPlant(kit, 40, lane.z - 2.9, 0.85);
  }
  for (const [x, z, s, k] of [[-68, 51, 1.0, 'green'], [68, 52, 1.1, 'dark'], [-58, -51, 1.0, 'green'], [58, -51, 1.05, 'green'], [-26, 21, 0.85, 'dark'], [28, -21, 0.85, 'green']]) tree(kit, x, z, s, k, 500 + x);
  for (const lane of lanes) {
    for (const x of [-70, -20, 30, 70]) kit.box(1.1, 0.55, 0.55, x, 0.28, lane.z - laneHalf - 0.4, 'stoneLight');
  }

  return finishLandmark(kit, site, 200, 130, 9.6);
}

// =============================================================================================
// 5 · 武侯祠·锦里 — the 红墙夹道 bamboo corridor, a 山门, and a short 锦里 commercial lane
// with timber shopfronts, banners, lanterns and a 牌坊.
// =============================================================================================
function buildWuhou({ THREE: T, site }) {
  const kit = new Kit(T);
  ensureShapes(kit);
  // earth/garden base between the two set pieces
  kit.box(150, 0.1, 16, 0, 0.05, 4, 'garden');

  // ---- 红墙夹道: a gently curving red-wall corridor lined with bamboo
  const pathPts = [];
  for (let i = 0; i <= 12; i++) {
    const x = -52 + i * 9.2;
    pathPts.push([x, -20 + Math.sin((i / 12) * Math.PI * 1.35) * 2.0]);
  }
  wornStonePath(kit, pathPts, 8.8, 'stoneTri');
  const leftWall = pathPts.map(([x, z]) => [x, z - 4.7]);
  const rightWall = pathPts.map(([x, z]) => [x, z + 4.7]);
  redWallPath(kit, leftWall, 3.2, 0.72);
  redWallPath(kit, rightWall, 3.2, 0.72);
  for (const sx of [-1, 1]) {
    kit.box(1.2, 0.28, 1.2, -52, 0.9, -20 + sx * 6.2, 'stone');
    stoneLantern(kit, -50.5, -20 + sx * 6.2, 0.8);
  }
  // bamboo leaning over both walls
  const r = rng(909);
  for (let i = 0; i < 58; i++) {
    const t = r();
    const idx = Math.min(pathPts.length - 2, Math.floor(t * (pathPts.length - 1)));
    const x = lerp(pathPts[idx][0], pathPts[idx + 1][0], r()) + (r() - 0.5) * 5;
    const zc = lerp(pathPts[idx][1], pathPts[idx + 1][1], r());
    const side = r() > 0.5 ? 1 : -1;
    const z = zc + side * (6.2 + r() * 6.5);
    const h = 6 + r() * 4;
    kit.inst('culm', x, 0, z, r() * 6.28, 0.9 + r() * 0.6, h, 0.9 + r() * 0.6);
    if (i % 2 === 0) kit.inst('leaf', x, h * 0.8, z, r() * 6.28, 1.45 + r() * 0.4, 1.0, 1);
    if (i % 3 === 0) kit.inst('leaf', x, h * 0.6, z, r() * 6.28, 0.95, 0.85, 1);
  }
  for (let i = 0; i < 8; i++) bambooClump(kit, -20 + i * 11, -9 + (i % 3) * 3, 3, 2, 5, 800 + i, 6, 9);

  // ---- 山门 (facing −x, at the west end of the corridor)
  kit.addSub(-64, -20, Math.PI / 2, (sub) => {
    hall(sub, { x: 0, z: 0, w: 20, d: 9, h: 5.4, baseH: 0.8, rise: 3.2, plaqueText: '武侯祠', bays: 5, gableMat: 'plaster2' });
    for (const sx of [-1, 1]) doorPanel(sub, 2.1, 2.9, sx * 5.0, 1.75, -3.72, Math.PI);
  });
  kit.box(9, 0.1, 20, -57, 0.06, -20, 'pavingTri');
  for (const sx of [-1, 1]) tree(kit, -58, -20 + sx * 10.5, 1.0, sx > 0 ? 'gold' : 'green', 411 + sx);

  // ---- 锦里 lane at z = +28
  const laneZ = 28;
  pave(kit, 132, 10, 12, laneZ, 'pavingTri', 0.05);
  for (const side of [-1, 1]) {
    const frontEdge = laneZ + side * 5.0;
    const centre = frontEdge + side * 7.0;
    for (let m = 0; m < 4; m++) {
      const w = 28;
      const x = -16 + m * 28;
      shopHouse(kit, {
        x, z: centre, w, d: 14, face: -side,
        h: 5.1 + (m % 3) * 0.45, two: true,
        gate: m === 2,
        sign: ['锦里', '小吃', '川味', '蜀绣'][(m + (side > 0 ? 1 : 0)) % 4],
        banner: m % 2 === 0 ? ['茶', '川菜', '小吃', '蜀锦'][m % 4] : '',
        awning: m % 2 === 1,
        plaqueText: m === 2 ? '锦里' : undefined,
        lights: m % 2,
      });
    }
  }
  // 牌坊 over the lane's west entrance
  kit.addSub(-46, laneZ, Math.PI / 2, (sub) => {
    for (const px of [-6.6, -2.3, 2.3, 6.6]) {
      sub.box(1.0, 0.4, 1.0, px, 0.2, 0, 'stone');
      sub.cyl(0.3, 0.38, 5.0, 8, px, 2.5, 0, 'red');
    }
    sub.box(14.8, 0.45, 0.5, 0, 4.55, 0, 'wood');
    plaque(sub, '锦里', 3.2, 1.0, 0, 4.2, -0.4, Math.PI, 'ink');
    roofXieshan(sub, { cx: 0, cz: 0, w: 5.8, d: 3.2, y0: 5.3, rise: 1.9, cornerLift: 0.8, nx: 7, nz: 5, upperW: 0.55, upperD: 0.4 });
    for (const px of [-6.6, 6.6]) roofGable(sub, { cx: px, cz: 0, w: 4.6, d: 2.8, y0: 4.55, rise: 1.3, cornerLift: 0.3, nx: 5, nz: 3, segV: 3, horns: false, gableMat: 'plaster2' });
  });
  for (const x of [-18, 18, 44]) crossLanterns(kit, x, laneZ - 4.8, laneZ + 4.8, 5.6, 4);
  teaTable(kit, 18, laneZ - 2.2, 1.0, 0.4);
  teaTable(kit, 40, laneZ + 2.0, 1.0, 2.5);
  for (const [x, z] of [[-36, 36], [52, 37], [-28, 19], [60, 20]]) pottedPlant(kit, x, z, 0.95);
  for (const [x, z] of [[-40, 8], [56, 8], [-20, 42], [66, 44]]) tree(kit, x, z, 1.05, 'green', 700 + x);
  stoneLantern(kit, 61, -14, 0.9);

  return finishLandmark(kit, site, 170, 100, 12.0);
}


// =============================================================================================
// 6 · 青羊宫 — Daoist temple: 山门, 混元殿, and the octagonal double-eaved 八卦亭 with a gilded top
// =============================================================================================
function buildQingyang({ THREE: T, site }) {
  const kit = new Kit(T);
  pave(kit, 134, 78, 0, 0, 'stoneTri', 0.05);
  kit.box(9, 0.12, 66, 0, 0.11, -4, 'pavingTri');
  for (const sx of [-1, 1]) {
    kit.box(20, 0.16, 54, sx * 52, 0.12, 0, 'garden');
    for (let i = 0; i < 3; i++) shrub(kit, sx * (44 + i * 4), -20 + i * 18, 0.9, 'foliageDark');
  }
  // enclosure walls with a gate opening in the front wall (the gate stands just proud of it)
  wallRun(kit, -68, -38, -13, -38, 4.0, 0.8);
  wallRun(kit, 13, -38, 68, -38, 4.0, 0.8);
  wallRun(kit, 68, -38, 68, 40, 4.0, 0.8);
  wallRun(kit, 68, 40, -68, 40, 4.0, 0.8);
  wallRun(kit, -68, 40, -68, -38, 4.0, 0.8);

  // 山门
  hall(kit, { x: 0, z: -32.5, w: 24, d: 10, h: 5.4, baseH: 0.85, rise: 3.3, plaqueText: '青羊宫', bays: 5, gableMat: 'plaster2' });
  for (const sx of [-1, 1]) stoneLantern(kit, sx * 9, -39.6, 0.85);
  plaque(kit, '青羊宫', 4.2, 1.25, 0, 4.2, -27.2, 0, 'ink');

  // 混元殿, double-eaved
  hall(kit, {
    x: 0, z: -8, w: 32, d: 18, h: 8.2, baseH: 1.05, rise: 4.2,
    doubleEave: true, plaqueText: '混元殿', bays: 7, gableMat: 'plaster2',
  });
  for (const sx of [-1, 1]) kit.box(1.2, 0.7, 1.2, sx * 10, 0.35, -19.4, 'stone');

  // courtyard 香炉 + stone lanterns
  incenseBurner(kit, 0, 7.0, 1.15, 0.05);
  for (const sx of [-1, 1]) stoneLantern(kit, sx * 6.5, 4.5, 0.85);
  for (const sx of [-1, 1]) kit.box(2.4, 0.4, 0.6, sx * 5.2, 0.25, -24.5, 'stone');

  // ---- 八卦亭: octagonal terraces, eight red columns, double octagonal eaves, gold finial
  const px = 0, pz = 22;
  kit.cyl(10.4, 11.0, 0.8, 8, px, 0.4, pz, 'stoneTri', 0, Math.PI / 8, 0);
  kit.cyl(9.7, 9.9, 0.35, 8, px, 0.97, pz, 'stoneLight', 0, Math.PI / 8, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 8;
    const nx = Math.cos(a), nz = Math.sin(a);
    for (let k = 0; k < 3; k++) {
      const top = Math.max(0.15, 1.15 - k * 0.3);
      kit.box(5.4, top, 0.7, px + nx * (10.2 + k * 0.65 + 0.3), top / 2, pz + nz * (10.2 + k * 0.65 + 0.3), 'stoneLight', -a);
    }
  }
  kit.add(new T.TorusGeometry(3.0, 0.1, 4, 8, Math.PI * 2), 'gold', px, 1.16, pz, Math.PI / 2, 0, Math.PI / 8);
  // eight columns
  const R = 7.0;
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i / 8) * Math.PI * 2;
    const cx = px + Math.cos(a) * R, cz = pz + Math.sin(a) * R;
    kit.cyl(0.55, 0.62, 0.3, 8, cx, 1.2, cz, 'stoneLight');
    kit.cyl(0.32, 0.36, 4.55, 8, cx, 3.6, cz, 'red');
    lantern(kit, cx, 4.7, cz, 0.65);
  }
  // ring beams and low balustrade between the columns
  for (let i = 0; i < 8; i++) {
    const a0 = Math.PI / 8 + (i / 8) * Math.PI * 2;
    const a1 = Math.PI / 8 + ((i + 1) / 8) * Math.PI * 2;
    const p0 = new T.Vector3(px + Math.cos(a0) * R, 5.6, pz + Math.sin(a0) * R);
    const p1 = new T.Vector3(px + Math.cos(a1) * R, 5.6, pz + Math.sin(a1) * R);
    kit.beam(p0, p1, 0.4, 0.42, 'wood');
    const r0 = new T.Vector3(px + Math.cos(a0) * (R - 0.2), 2.1, pz + Math.sin(a0) * (R - 0.2));
    const r1 = new T.Vector3(px + Math.cos(a1) * (R - 0.2), 2.1, pz + Math.sin(a1) * (R - 0.2));
    kit.beam(r0, r1, 0.14, 0.12, 'red');
    kit.beam(r0.clone().setY(1.6), r1.clone().setY(1.6), 0.14, 0.12, 'red');
  }
  // central altar + bronze censer
  kit.box(3.2, 1.0, 3.2, px, 1.65, pz, 'stone');
  kit.cyl(0.7, 0.5, 0.8, 8, px, 2.5, pz, 'bronze');
  kit.cyl(0.78, 0.78, 0.14, 8, px, 2.95, pz, 'gold');
  // inner octagonal screens on four rear faces
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 8 + Math.PI / 4 + (i / 8) * Math.PI * 2;
    const g = new T.PlaneGeometry(2.8, 2.6);
    kit.add(g, 'lattice', px + Math.cos(a) * 5.2, 3.1, pz + Math.sin(a) * 5.2, 0, -a + Math.PI / 2, 0);
  }
  // upper octagonal storey
  kit.cyl(5.3, 5.3, 2.7, 8, px, 7.35, pz, 'plaster', 0, Math.PI / 8, 0);
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i / 8) * Math.PI * 2;
    kit.cyl(0.22, 0.24, 2.9, 8, px + Math.cos(a) * 5.35, 7.35, pz + Math.sin(a) * 5.35, 'red');
    const g = new T.PlaneGeometry(2.3, 1.7);
    kit.add(g, 'lattice', px + Math.cos(a) * 5.42, 7.3, pz + Math.sin(a) * 5.42, 0, -a + Math.PI / 2, 0);
  }
  roofOctagon(kit, { cx: px, cz: pz, r: 10.2, y0: 5.75, y1: 7.55, cornerLift: 1.05, segPer: 3, segV: 4, rot: Math.PI / 8 });
  roofOctagon(kit, { cx: px, cz: pz, r: 7.5, y0: 8.9, y1: 12.4, cornerLift: 1.15, segPer: 3, segV: 5, rot: Math.PI / 8 });
  // gilded 宝顶
  kit.cyl(0.95, 1.1, 0.4, 10, px, 12.6, pz, 'gold');
  kit.cyl(0.6, 0.78, 0.25, 10, px, 12.92, pz, 'gold');
  kit.add(new T.SphereGeometry(0.7, 10, 8), 'gold', px, 13.45, pz);
  kit.cyl(0.25, 0.45, 0.55, 8, px, 14.0, pz, 'gold');
  kit.cyl(0.04, 0.2, 1.15, 6, px, 14.75, pz, 'gold');
  kit.add(new T.SphereGeometry(0.15, 6, 5), 'gold', px, 15.4, pz);
  plaque(kit, '八卦亭', 2.4, 0.85, px, 4.7, pz - 7.1, Math.PI, 'ink');
  plaque(kit, '八卦亭', 2.4, 0.85, px, 4.7, pz + 7.1, 0, 'ink');

  // garden trees + bamboo
  for (const [x, z, s, k] of [[-28, -2, 1.1, 'green'], [28, -2, 1.1, 'gold'], [-30, 18, 1.0, 'dark'], [30, 18, 1.05, 'green'], [-20, 33, 0.95, 'green'], [20, 33, 0.95, 'dark']]) {
    tree(kit, x, z, s, k, 900 + x);
  }
  for (const sx of [-1, 1]) bambooClump(kit, sx * 58, 24, 6, 8, 16, 950 + sx, 5.5, 9);
  for (const [x, z] of [[-12, 12], [12, 12], [-8, -22], [8, -22]]) pottedPlant(kit, x, z, 0.95);

  return finishLandmark(kit, site, 150, 95, 15.5);
}

// =============================================================================================
// 7 · 杜甫草堂 — thatched cottage, pond, 柴门, bamboo fence and grove
// =============================================================================================
function pondGeometry(T, rx, rz, seed) {
  const sh = new T.Shape();
  const n = 28;
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = 1 + 0.07 * Math.sin(i * 2.3) + (r() - 0.5) * 0.1;
    pts.push([Math.cos(a) * rx * rr, Math.sin(a) * rz * rr]);
  }
  sh.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < n; i++) sh.lineTo(pts[i][0], pts[i][1]);
  sh.closePath();
  const g = new T.ShapeGeometry(sh);
  g.rotateX(-Math.PI / 2);
  return g;
}

function buildDufu({ THREE: T, site }) {
  const kit = new Kit(T);
  // enclosed garden
  kit.box(108, 0.12, 78, 0, 0.06, 0, 'garden');
  const cx = 18, cz = 8;
  // pond
  const pondX = -10, pondZ = -16;
  kit.add(pondGeometry(T, 18, 9.5, 123), 'water', pondX, 0.16, pondZ);
  const rp = rng(321);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const rr = 1 + (rp() - 0.5) * 0.14;
    kit.add(new T.DodecahedronGeometry(0.65 + rp() * 0.5, 0), 'stoneDark',
      pondX + Math.cos(a) * 18.2 * rr, 0.28, pondZ + Math.sin(a) * 9.5 * rr, 0, rp() * 3, 0, 1.2, 0.55, 1);
  }
  // little wooden bridge over the pond
  for (let i = 0; i < 5; i++) {
    kit.box(2.6, 0.16, 2.4, pondX + 1 + i * 2.2, 0.85 + Math.sin((i / 4) * Math.PI) * 0.35, pondZ + i * 2.2 - 4.2, 'woodLight');
    kit.box(0.12, 0.5, 0.12, pondX + 2.2 * i - 0.1, 1.15, pondZ + i * 2.2 - 4.2, 'wood');
  }
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) kit.box(0.1, 0.9, 2.4, pondX + 1 + i * 2.2, 1.35, pondZ + i * 2.2 - 4.2 + sx * 0.9, 'woodDark');
  }
  // stone path from the 柴门 around the pond to the cottage
  wornStonePath(kit, [[-20, -35], [-18, -30], [-12, -28], [2, -27.5], [10, -23], [13, -12], [14, -3], [15, 2]], 2.8, 'stoneTri', 0.16);
  // lotus pads
  for (let i = 0; i < 12; i++) {
    const a = rp() * Math.PI * 2;
    const rr = 0.3 + rp() * 0.6;
    const pad = new T.CircleGeometry(0.35 + rp() * 0.4, 8);
    pad.rotateX(-Math.PI / 2);
    kit.add(pad, i % 3 === 0 ? 'foliage' : 'foliageDark', pondX + Math.cos(a) * 17 * rr, 0.18, pondZ + Math.sin(a) * 9 * rr);
  }

  // ---- the thatched cottage
  kit.box(22, 0.55, 12, cx, 0.275, cz, 'stoneTri');
  kit.box(18, 3.1, 8, cx, 2.1, cz, 'earth');
  // timber frame + veranda
  for (const xo of [-8.8, -4.4, 0, 4.4, 8.8]) {
    for (const zz of [cz - 4.05, cz + 4.05]) kit.cyl(0.16, 0.18, 3.3, 6, cx + xo, 2.1, zz, 'wood');
    kit.cyl(0.14, 0.16, 3.2, 6, cx + xo, 1.6, cz - 6.3, 'wood');
  }
  kit.box(19.2, 0.18, 0.28, cx, 3.62, cz - 4.08, 'wood');
  kit.box(19.2, 0.18, 0.28, cx, 3.62, cz + 4.08, 'wood');
  kit.box(19, 0.16, 2.5, cx, 0.65, cz - 5.3, 'woodLight');
  railing(kit, cx - 9, cz - 6.5, cx - 2.5, cz - 6.5, 0.7, 0.75, 'bambooDry', 2.2);
  railing(kit, cx + 2.5, cz - 6.5, cx + 9, cz - 6.5, 0.7, 0.75, 'bambooDry', 2.2);
  for (let i = 0; i < 3; i++) kit.box(1.4, 0.28, 0.7, cx, 0.14 + i * 0.14, cz - 6.6 + i * 0.16, 'stone');
  doorPanel(kit, 2.4, 2.7, cx, 1.85, cz - 4.12, Math.PI);
  for (const sx of [-1, 1]) {
    const g = new T.PlaneGeometry(2.2, 1.8);
    kit.add(g, 'lattice', cx + sx * 5.4, 2.15, cz - 4.14, 0, Math.PI, 0);
    kit.box(2.5, 0.14, 0.16, cx + sx * 5.4, 3.1, cz - 4.18, 'woodDark');
  }
  // thick straw roof + ragged eave and rounded ridge
  roofGable(kit, {
    cx, cz, w: 22, d: 14, y0: 3.72, rise: 2.9, cornerLift: 0.32, nx: 9, nz: 4, segV: 4,
    mat: 'thatch', eaveMat: 'thatchPlain', eaveDrop: 0.55, gableMat: 'earth',
    ridgeKey: 'woodDark', horns: false, barge: false,
  });
  kit.cyl(0.5, 0.5, 22.2, 8, cx, 6.72, cz, 'thatchPlain', 0, 0, Math.PI / 2);
  for (const sz of [-1, 1]) {
    for (let i = 0; i < 12; i++) {
      const x = cx - 10.4 + i * 1.9;
      kit.box(1.7, 0.55, 0.35, x, 3.62, cz + sz * 6.8, 'thatchPlain', 0, 0, (i % 3 - 1) * 0.06);
    }
  }
  kit.cyl(0.28, 0.3, 20, 8, cx, 6.2, cz, 'woodDark', 0, 0, Math.PI / 2);

  // ---- 柴门 (brushwood gate) in the south fence
  const gx = -20, gz = -38;
  for (const sx of [-1, 1]) {
    kit.cyl(0.2, 0.24, 3.3, 6, gx + sx * 2.6, 1.65, gz, 'wood');
    kit.box(0.6, 0.35, 0.6, gx + sx * 2.6, 0.18, gz, 'stone');
  }
  kit.box(6.0, 0.25, 0.3, gx, 2.95, gz, 'wood');
  kit.box(4.4, 2.4, 0.14, gx, 1.2, gz - 0.05, 'wood');
  roofGable(kit, { cx: gx, cz: gz, w: 7.6, d: 4.6, y0: 3.15, rise: 1.35, cornerLift: 0.2, nx: 6, nz: 3, segV: 3, mat: 'thatch', eaveMat: 'thatchPlain', gableMat: 'wood', ridgeKey: 'woodDark', horns: false, barge: false });
  plaque(kit, '草堂', 2.2, 0.75, gx, 2.4, gz - 0.16, Math.PI, 'ink');
  kit.cyl(0.32, 0.32, 6.2, 8, gx, 3.35, gz, 'woodDark', 0, 0, Math.PI / 2);
  // bamboo fence around the garden, leaving the gate open
  bambooFence(kit, [[-52, -38], [-26, -38]], 1.45);
  bambooFence(kit, [[-14, -38], [52, -38]], 1.45);
  bambooFence(kit, [[52, -38], [52, 38]], 1.45);
  bambooFence(kit, [[52, 38], [-52, 38]], 1.45);
  bambooFence(kit, [[-52, 38], [-52, -38]], 1.45);

  // ---- 水井 + stone table
  kit.cyl(1.25, 1.35, 0.9, 10, 0, 9.5, 0, 'stone');
  kit.cyl(1.02, 1.02, 0.12, 10, 0, 0.86, 9.5, 'water');
  for (const sx of [-1, 1]) kit.cyl(0.13, 0.15, 2.4, 6, sx * 1.2, 1.2, 9.5, 'wood');
  roofGable(kit, { cx: 0, cz: 9.5, w: 3.4, d: 2.8, y0: 2.4, rise: 0.9, cornerLift: 0.1, nx: 4, nz: 2, segV: 2, mat: 'thatch', eaveMat: 'thatchPlain', gableMat: 'wood', ridgeKey: 'woodDark', horns: false, barge: false });
  teaTable(kit, 9, 9, 1.15, 0.4);
  for (const [x, z] of [[6, 11], [12, 10], [9, 6]]) kit.cyl(0.38, 0.42, 0.5, 8, x, 0.25, z, 'stone');

  // ---- bamboo grove + trees + reeds
  for (const [x, z, radx, radz, n, seed] of [
    [38, 24, 10, 8, 18, 51],
    [38, -14, 8, 8, 14, 52],
    [-38, 24, 10, 8, 16, 53],
    [-38, -22, 8, 6, 12, 54],
    [8, 24, 8, 5, 12, 55],
    [-24, 6, 6, 6, 10, 56],
    [-10, 30, 5, 5, 9, 57],
    [36, 4, 5, 4, 8, 58],
  ]) {
    bambooClump(kit, x, z, radx, radz, n, seed, 5.5, 9.5);
  }
  for (const [x, z, s, k] of [[-36, 33, 1.2, 'green'], [34, 33, 1.1, 'dark'], [-30, -28, 1.05, 'green']]) tree(kit, x, z, s, k, 610 + x);
  for (const [x, z, s] of [[-6, -4, 0.85], [26, 22, 0.9], [-34, 8, 0.8], [10, 30, 0.9]]) shrub(kit, x, z, s);
  for (let i = 0; i < 26; i++) {
    const a = rp() * Math.PI * 2;
    const rr = 0.85 + rp() * 0.2;
    const x = pondX + Math.cos(a) * 18 * rr;
    const z = pondZ + Math.sin(a) * 9.5 * rr;
    const h = 1.2 + rp() * 1.2;
    kit.cyl(0.02, 0.035, h, 4, x, h / 2 + 0.15, z, 'bambooDry');
    kit.add(new T.IcosahedronGeometry(0.25, 0), 'foliage', x, h + 0.15, z, 0, 0, 0, 0.7, 1.6, 0.7);
  }
  for (const [x, z] of [[26, -6], [8, -4], [26, 2]]) shrub(kit, x, z, 0.9);
  // reeds at the pond edge: a few instanced sprays
  ensureShapes(kit);
  const rr2 = rng(771);
  for (let i = 0; i < 30; i++) {
    const a = rr2() * Math.PI * 2;
    const x = pondX + Math.cos(a) * 16.5;
    const z = pondZ + Math.sin(a) * 8.4;
    const h = 1.4 + rr2() * 1.6;
    kit.cyl(0.02, 0.03, h, 4, x, h / 2 + 0.16, z, 'bambooDry');
  }

  return finishLandmark(kit, site, 120, 90, 7.5);
}

// =============================================================================================
// 8 · 大慈寺 — compact city temple: 山门, one grand hall with a tall grey 歇山 roof,
// a bell pavilion and an incense burner, next to the modern city.
// =============================================================================================
function buildDaci({ THREE: T, site }) {
  const kit = new Kit(T);
  pave(kit, 106, 72, 0, 0, 'stoneTri', 0.05);
  kit.box(8, 0.12, 58, 0, 0.11, 0, 'pavingTri');
  for (const sx of [-1, 1]) {
    kit.box(14, 0.16, 50, sx * 42, 0.12, 2, 'garden');
    for (let i = 0; i < 3; i++) shrub(kit, sx * (38 + i * 3), -14 + i * 16, 0.85, 'foliageDark');
  }
  // enclosure with a gate opening in the front wall
  wallRun(kit, -52, -36, -12, -36, 4.0, 0.8);
  wallRun(kit, 12, -36, 52, -36, 4.0, 0.8);
  wallRun(kit, 52, -36, 52, 36, 4.0, 0.8);
  wallRun(kit, 52, 36, -52, 36, 4.0, 0.8);
  wallRun(kit, -52, 36, -52, -36, 4.0, 0.8);

  // 山门
  hall(kit, { x: 0, z: -31, w: 22, d: 9, h: 5.4, baseH: 0.9, rise: 3.2, plaqueText: '大慈寺', bays: 5, gableMat: 'plaster2' });
  for (const sx of [-1, 1]) doorPanel(kit, 2.1, 3.0, sx * 5.2, 1.85, -35.36, Math.PI);
  for (const sx of [-1, 1]) stoneLantern(kit, sx * 8.5, -36.8, 0.9);

  // grand hall with a very tall grey roof
  hall(kit, {
    x: 0, z: 15, w: 34, d: 20, h: 8.8, baseH: 1.3, rise: 6.0,
    plaqueText: '大雄宝殿', bays: 7, gableMat: 'plaster2',
  });
  for (const sx of [-1, 1]) stoneLantern(kit, sx * 13, 1.6, 0.9);
  for (const sx of [-1, 1]) kit.box(1.4, 0.9, 1.4, sx * 15, 0.45, 0.8, 'stone');

  // bell pavilion on the west side, with a visible bronze bell
  squarePavilion(kit, { x: -30, z: -5, w: 8.6, h: 4.0, baseH: 0.9, plaqueText: '钟楼' });
  kit.cyl(0.34, 0.85, 1.6, 10, -30, 4.9, -5, 'bronze');
  kit.cyl(0.9, 0.9, 0.16, 10, -30, 5.72, -5, 'gold');
  kit.cyl(0.06, 0.06, 0.6, 5, -30, 6.1, -5, 'bronze');
  kit.add(new T.SphereGeometry(0.18, 6, 5), 'bronze', -30, 4.0, -5);
  // the hall's drum / side shrine on the east side
  squarePavilion(kit, { x: 30, z: -5, w: 8.6, h: 4.0, baseH: 0.9, plaqueText: '鼓楼' });

  // incense burner in the courtyard
  incenseBurner(kit, 0, -4, 1.2, 0.05);
  for (const sx of [-1, 1]) kit.box(2.0, 0.5, 0.6, sx * 5.0, 0.3, -20.5, 'stone');

  // two low side halls facing the axis
  kit.addSub(-40, 10, -Math.PI / 2, (sub) => {
    hall(sub, { x: 0, z: 0, w: 18, d: 8, h: 4.2, baseH: 0.7, rise: 2.5, plaqueText: '观音殿', bays: 4, drums: false });
  });
  kit.addSub(40, 10, Math.PI / 2, (sub) => {
    hall(sub, { x: 0, z: 0, w: 18, d: 8, h: 4.2, baseH: 0.7, rise: 2.5, plaqueText: '说法堂', bays: 4, drums: false });
  });

  // courtyard trees, lanterns, bamboo in the side gardens
  for (const [x, z, s, k] of [[-22, 24, 1.1, 'green'], [22, 24, 1.05, 'gold'], [-24, -13, 0.95, 'dark'], [24, -13, 0.95, 'green']]) {
    tree(kit, x, z, s, k, 1200 + x);
  }
  for (const sx of [-1, 1]) bambooClump(kit, sx * 45, 26, 4, 6, 10, 1250 + sx, 5, 8);
  for (const sx of [-1, 1]) {
    lantern(kit, sx * 9.5, 5.0, -34.0, 0.85);
    lantern(kit, sx * 15, 9.9, 4.0, 0.9);
  }
  for (const [x, z] of [[-6, -21], [6, -21], [-6, 3], [6, 3]]) pottedPlant(kit, x, z, 0.9);

  return finishLandmark(kit, site, 120, 85, 17.2);
}

// =============================================================================================
// 1 · 安顺廊桥 — covered timber bridge over the 府河: three stone arches, a roofed corridor and
// three pavilions (the middle one taller, 歇山顶)
// =============================================================================================
function buildAnsun({ THREE: T, site }) {
  const kit = new Kit(T);
  const DECK = 8.6;           // walking surface over the water
  const BW = 20;              // bridge body width (short axis, z)
  const L = 76;               // masonry bridge body length (long axis, x)
  const CORR = 64;            // covered corridor length

  // ---- river reach under the bridge, held between stone quays
  kit.box(70, 0.16, 46, 0, 0.08, 0, 'water');
  for (const sx of [-1, 1]) kit.box(1.5, 1.05, 48, sx * 35.2, 0.52, 0, 'stoneTri');
  for (const sz of [-1, 1]) kit.box(72, 1.05, 1.5, 0, 0.52, sz * 23.2, 'stoneTri');
  for (const sz of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      kit.add(new T.DodecahedronGeometry(0.75 + (i % 3) * 0.22, 0), 'stoneDark', -29 + i * 11.6, 0.34, sz * 22.9, 0, i, 0, 1.4, 0.65, 1);
    }
  }

  // ---- bridge body: three semicircular arches in a solid ashlar spandrel wall
  const shape = new T.Shape();
  shape.moveTo(-L / 2, 0.1);
  shape.lineTo(L / 2, 0.1);
  shape.lineTo(L / 2, DECK - 0.55);
  shape.lineTo(-L / 2, DECK - 0.55);
  shape.closePath();
  const arches = [-24, 0, 24];
  const R = 6.2, SPRING = 1.0;
  for (const cx of arches) {
    const hole = new T.Path();
    hole.moveTo(cx - R, 0.1);
    hole.lineTo(cx - R, SPRING);
    hole.absarc(cx, SPRING, R, Math.PI, 0, true);
    hole.lineTo(cx + R, 0.1);
    hole.closePath();
    shape.holes.push(hole);
  }
  const body = new T.ExtrudeGeometry(shape, { depth: BW, bevelEnabled: false, curveSegments: 14 });
  body.translate(0, 0, -BW / 2);
  kit.add(body, 'stoneTri');
  // arch rings / voussoirs proud of both faces
  for (const cx of arches) {
    for (const sz of [-1, 1]) {
      const ring = new T.TorusGeometry(R, 0.3, 4, 22, Math.PI);
      kit.add(ring, 'stoneLight', cx, SPRING, sz * (BW / 2 + 0.05));
    }
  }
  // cutwaters on the piers
  for (const cx of [-12, 12]) {
    for (const sz of [-1, 1]) {
      const cone = new T.ConeGeometry(1.55, 3.4, 4);
      kit.add(cone, 'stoneDark', cx, 2.2, sz * (BW / 2 + 1.0), (Math.PI / 2) * sz, Math.PI / 4, 0);
    }
  }
  // deck slab, cornice, bridge-end abutment blocks
  kit.box(L, 0.55, BW + 1.1, 0, DECK - 0.27, 0, 'stoneLight');
  kit.box(L - 0.3, 0.22, BW + 1.9, 0, DECK - 0.66, 0, 'stone');
  for (const sx of [-1, 1]) kit.box(2.4, DECK - 0.7, BW + 1.1, sx * (L / 2 - 0.9), (DECK - 0.7) / 2, 0, 'stoneTri');

  // ---- stair flights down to the banks at both ends
  stairs(kit, { x: L / 2, z: 0, w: 16, steps: 10, rise: 0.84, run: 0.96, y: DECK, dir: 1, key: 'stoneTri' });
  stairs(kit, { x: -L / 2, z: 0, w: 16, steps: 10, rise: 0.84, run: 0.96, y: DECK, dir: -1, key: 'stoneTri' });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const a = new T.Vector3(sx * L / 2, DECK + 0.35, sz * 8.2);
      const b = new T.Vector3(sx * (L / 2 + 9.6), 0.6, sz * 8.2);
      kit.beam(a, b, 0.5, 0.75, 'stoneLight');
      kit.box(0.7, 1.3, 0.7, b.x, 0.65, b.z, 'stone');
      kit.add(new T.SphereGeometry(0.28, 8, 6), 'gold', b.x, 1.45, b.z);
    }
  }

  // ---- stone parapet along the deck
  for (const sz of [-1, 1]) {
    const z = sz * (BW / 2 - 0.2);
    kit.box(L - 0.8, 0.34, 0.55, 0, DECK + 0.17, z, 'stoneLight');
    railing(kit, -L / 2 + 0.6, z, L / 2 - 0.6, z, DECK + 0.3, 1.0, 'stoneLight', 2.7);
  }

  // ---- corridor floor, columns and rails
  kit.box(CORR, 0.16, 14.2, 0, DECK + 0.08, 0, 'woodLight');
  const colX = [];
  for (let x = -32; x <= 32.01; x += 4) colX.push(x);
  for (const x of colX) {
    for (const sz of [-1, 1]) {
      kit.cyl(0.4, 0.44, 0.3, 8, x, DECK + 0.31, sz * 7.2, 'stoneLight');
      kit.cyl(0.27, 0.3, 3.95, 8, x, DECK + 2.42, sz * 7.2, 'red');
      kit.box(0.65, 0.38, 0.5, x, DECK + 4.2, sz * 7.2, 'wood');
    }
    kit.box(0.32, 0.38, 14.0, x, DECK + 4.22, 0, 'wood');
  }
  for (const sz of [-1, 1]) {
    kit.beam(new T.Vector3(-33, DECK + 4.05, sz * 7.2), new T.Vector3(33, DECK + 4.05, sz * 7.2), 0.4, 0.5, 'wood');
    railing(kit, -32, sz * 7.35, -9.8, sz * 7.35, DECK + 0.15, 0.95, 'red', 1.7);
    railing(kit, 9.8, sz * 7.35, 32, sz * 7.35, DECK + 0.15, 0.95, 'red', 1.7);
    for (let x = -30; x < 31; x += 8) {
      if (Math.abs(x) < 10) continue;
      kit.box(4.8, 0.12, 0.55, x, DECK + 0.52, sz * 6.4, 'wood');
      kit.box(0.14, 0.48, 0.5, x - 2.1, DECK + 0.26, sz * 6.4, 'woodDark');
      kit.box(0.14, 0.48, 0.5, x + 2.1, DECK + 0.26, sz * 6.4, 'woodDark');
    }
  }

  // ---- corridor roof (悬山) kept below the pavilion roofs
  roofGable(kit, { w: CORR + 6, d: 19.6, y0: DECK + 4.4, rise: 2.35, cornerLift: 0.75, segV: 5, nx: 22, nz: 5, ridgeOverhang: 1.0 });

  // ---- side pavilions, clearly taller than the corridor
  for (const px of [-24, 24]) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        kit.cyl(0.4, 0.44, 0.3, 8, px + sx * 5.0, DECK + 0.3, sz * 5.0, 'stoneLight');
        kit.cyl(0.3, 0.33, 4.7, 8, px + sx * 5.0, DECK + 2.65, sz * 5.0, 'red');
      }
    }
    for (const sz of [-1, 1]) {
      const g = new T.PlaneGeometry(7.4, 2.5);
      kit.add(g, 'lattice', px, DECK + 2.3, sz * 5.05, 0, sz > 0 ? 0 : Math.PI, 0);
      plaque(kit, '廊桥', 2.4, 0.82, px, DECK + 4.55, sz * 5.12, sz > 0 ? 0 : Math.PI);
    }
    roofXieshan(kit, { w: 15.2, d: 15.2, y0: DECK + 5.0, rise: 3.0, cornerLift: 1.1, cx: px, cz: 0, nx: 11, nz: 9 });
    ribbonLights(kit, px, DECK + 4.7, 6.2, 4);
  }

  // ---- central pavilion: open lower storey, eave skirt, upper timber storey, 歇山顶
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      kit.cyl(0.42, 0.46, 0.32, 8, sx * 8.2, DECK + 0.31, sz * 8.2, 'stoneLight');
      kit.cyl(0.33, 0.36, 5.2, 8, sx * 8.2, DECK + 3.0, sz * 8.2, 'red');
      kit.cyl(0.4, 0.44, 0.3, 8, sx * 4.0, DECK + 0.3, sz * 8.2, 'stoneLight');
      kit.cyl(0.29, 0.32, 5.0, 8, sx * 4.0, DECK + 2.85, sz * 8.2, 'red');
    }
  }
  for (const sz of [-1, 1]) {
    kit.beam(new T.Vector3(-9, DECK + 5.4, sz * 8.2), new T.Vector3(9, DECK + 5.4, sz * 8.2), 0.4, 0.48, 'wood');
    const g = new T.PlaneGeometry(7.8, 2.6);
    kit.add(g, 'lattice', 0, DECK + 2.7, sz * 8.26, 0, sz > 0 ? 0 : Math.PI, 0);
  }
  kit.box(17.4, 0.26, 17.4, 0, DECK + 5.55, 0, 'wood');
  railingBox(kit, 8.5, 8.5, DECK + 5.7, 0.95, 'red');
  roofSkirt(kit, { w: 19.6, d: 19.6, wIn: 11.2, dIn: 11.2, y0: DECK + 5.6, y1: DECK + 7.55, cornerLift: 1.2, nx: 12, nz: 10 });
  // upper storey
  kit.box(9.4, 3.7, 9.4, 0, DECK + 9.45, 0, 'plaster');
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      kit.cyl(0.28, 0.3, 3.8, 8, sx * 4.9, DECK + 9.6, sz * 4.9, 'red');
    }
  }
  for (const sz of [-1, 1]) {
    const g = new T.PlaneGeometry(2.2, 2.2);
    kit.add(g, 'lattice', -2.1, DECK + 9.4, sz * 4.72, 0, sz > 0 ? 0 : Math.PI, 0);
    const g2 = new T.PlaneGeometry(2.2, 2.2);
    kit.add(g2, 'lattice', 2.1, DECK + 9.4, sz * 4.72, 0, sz > 0 ? 0 : Math.PI, 0);
  }
  for (const sx of [-1, 1]) {
    const g = new T.PlaneGeometry(2.2, 2.2);
    kit.add(g, 'lattice', sx * 4.72, DECK + 9.4, 0, 0, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
  }
  roofXieshan(kit, { w: 13.8, d: 13.8, y0: DECK + 11.1, rise: 3.4, cornerLift: 1.2, upperW: 0.52, upperD: 0.42, nx: 11, nz: 9 });
  kit.add(new T.SphereGeometry(0.3, 8, 6), 'gold', 0, DECK + 14.7, 0);

  // ---- name plaques on the upper storey + lanterns
  plaque(kit, '安顺廊桥', 4.3, 1.35, 0, DECK + 9.6, 4.78, 0);
  plaque(kit, '安顺廊桥', 4.3, 1.35, 0, DECK + 9.6, -4.78, Math.PI);
  for (const sz of [-1, 1]) {
    for (const x of [-30, -18, 18, 30]) lantern(kit, x, DECK + 3.6, sz * 7.9, 0.75);
  }
  ribbonLights(kit, 0, DECK + 6.5, 8.4, 6);

  return finishLandmark(kit, site, 96, 34, 24.8);
}

// small helper: a ring of red lanterns hung below an eave line (flat layout)
function ribbonLights(kit, cx, y, r, n) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.4;
    lantern(kit, cx + Math.cos(a) * r, y, Math.sin(a) * r, 0.65);
  }
}

// =============================================================================================
// 2 · 望江楼 — four-storey timber tower (攒尖顶) in a bamboo grove
// =============================================================================================
function buildWangjiang({ THREE: T, site }) {
  const kit = new Kit(T);
  const TOP = 30.5;

  // ---- garden: green ground, stone apron, a worn approach path
  kit.box(52, 0.14, 52, 0, 0.07, 0, 'garden');
  kit.box(27, 0.1, 27, 0, 0.17, 0, 'stoneTri');
  wornStonePath(kit, [[0, -26], [0, -19], [0, -13.8]], 4.2, 'stoneTri');
  // two stone terraces
  kit.box(20, 0.9, 20, 0, 0.45, 0, 'stoneTri');
  kit.box(17.2, 0.5, 17.2, 0, 1.15, 0, 'stoneLight');
  // flights on all four sides
  for (let i = 0; i < 4; i++) {
    const top = 1.4 - i * 0.34;
    if (top <= 0.12) break;
    const off = 8.6 + (i + 0.5) * 0.8;
    kit.box(6.4, top, 0.8, 0, top / 2, -off, 'stoneLight');
    kit.box(6.4, top, 0.8, 0, top / 2, off, 'stoneLight');
    kit.box(0.8, top, 6.4, -off, top / 2, 0, 'stoneLight');
    kit.box(0.8, top, 6.4, off, top / 2, 0, 'stoneLight');
  }
  // balustrade on three sides, leaving the approach open
  railing(kit, -8.3, 8.3, 8.3, 8.3, 1.42, 0.9, 'stoneLight');
  railing(kit, -8.3, -8.3, -8.3, 8.3, 1.42, 0.9, 'stoneLight');
  railing(kit, 8.3, -8.3, 8.3, 8.3, 1.42, 0.9, 'stoneLight');

  // four timber storeys, each with an eave skirt and a balcony above it
  const levels = [
    { w: 12.6, y0: 1.5, y1: 6.55, out: 17.2 },
    { w: 11.7, y0: 7.65, y1: 12.1, out: 16.2 },
    { w: 10.8, y0: 13.2, y1: 17.65, out: 15.2 },
    { w: 9.9, y0: 18.75, y1: 23.1, out: 13.4 },
  ];

  levels.forEach((lv, idx) => {
    const y0 = lv.y0, y1 = lv.y1, w = lv.w, h = y1 - y0;
    const hx = w / 2;
    // white plaster wall, inset behind the red columns
    kit.box(w - 1.0, h, w - 1.0, 0, y0 + h / 2, 0, 'plaster');
    // grey brick plinth
    kit.box(w - 0.92, 0.62, w - 0.92, 0, y0 + 0.44, 0, 'brickTri');
    // stone sill
    kit.box(w + 0.35, 0.22, w + 0.35, 0, y0 + 0.08, 0, 'stoneDark');
    // eight red columns at corners + mid-face
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        kit.cyl(0.3, 0.35, 0.28, 8, sx * hx, y0 + 0.14, sz * hx, 'stoneLight');
        kit.cyl(0.24, 0.28, h - 0.2, 8, sx * hx, y0 + h / 2, sz * hx, 'red');
      }
    }
    for (const s of [-1, 1]) {
      kit.cyl(0.25, 0.32, 0.28, 8, 0, y0 + 0.14, s * hx, 'stoneLight');
      kit.cyl(0.22, 0.26, h - 0.2, 8, 0, y0 + h / 2, s * hx, 'red');
      kit.cyl(0.25, 0.32, 0.28, 8, s * hx, y0 + 0.14, 0, 'stoneLight');
      kit.cyl(0.22, 0.26, h - 0.2, 8, s * hx, y0 + h / 2, 0, 'red');
    }
    // lintel and simple bracket row under the eave
    for (const sz of [-1, 1]) kit.box(w + 1.0, 0.38, 0.34, 0, y1 - 0.2, sz * hx, 'wood');
    for (const sx of [-1, 1]) kit.box(0.34, 0.38, w + 1.0, sx * hx, y1 - 0.2, 0, 'wood');
    for (let i = 0; i < 4; i++) {
      const t = (i / 3 - 0.5) * (w - 2.6);
      for (const sz of [-1, 1]) {
        kit.box(0.46, 0.2, 0.34, t, y1 - 0.46, sz * (hx - 0.22), 'wood');
        kit.box(0.24, 0.26, 0.46, t, y1 - 0.28, sz * (hx - 0.04), 'woodDark');
      }
      for (const sx of [-1, 1]) {
        kit.box(0.34, 0.2, 0.46, sx * (hx - 0.22), y1 - 0.46, t, 'wood');
        kit.box(0.24, 0.26, 0.46, sx * (hx - 0.04), y1 - 0.28, t, 'woodDark');
      }
    }
    // lattice windows, two per face, framed in dark timber
    const wy = y0 + h * 0.55;
    const wh = Math.min(2.6, h * 0.5);
    for (const face of [0, 1, 2, 3]) {
      const along = face < 2 ? 'z' : 'x';
      const sign = face % 2 === 0 ? 1 : -1;
      for (const s of [-1, 1]) {
        const off = s * w * 0.255;
        const g = new T.PlaneGeometry(2.0, wh);
        let px, pz, ry;
        if (along === 'z') {
          px = off; pz = sign * (hx - 0.49); ry = sign > 0 ? 0 : Math.PI;
        } else {
          px = sign * (hx - 0.49); pz = off; ry = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
        // do not cover the ground-floor door on the −z face
        if (idx === 0 && face === 1 && Math.abs(off) < 2.0) continue;
        kit.add(g, 'lattice', px, wy, pz, 0, ry, 0);
        kit.box(2.3, 0.14, 0.14, px, wy + wh / 2 + 0.07, pz, 'woodDark', ry);
        kit.box(2.3, 0.14, 0.14, px, wy - wh / 2 - 0.07, pz, 'woodDark', ry);
        kit.box(0.14, wh + 0.28, 0.14, px - Math.cos(ry) * 1.08, wy, pz + Math.sin(ry) * 1.08, 'woodDark', ry);
        kit.box(0.14, wh + 0.28, 0.14, px + Math.cos(ry) * 1.08, wy, pz - Math.sin(ry) * 1.08, 'woodDark', ry);
      }
    }
    if (idx === 0) {
      doorPanel(kit, 2.4, 3.1, 0, 1.65, -(hx - 0.47), Math.PI);
    }
    // balcony deck + 美人靠 railing, sitting on the skirt of the storey below
    if (idx > 0) {
      const bw = w + 2.1;
      kit.box(bw, 0.22, bw, 0, y0 - 0.1, 0, 'wood');
      railingBox(kit, bw / 2 - 0.06, bw / 2 - 0.06, y0 + 0.02, 0.85, 'red');
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        lantern(kit, Math.cos(a) * (bw / 2 - 0.55), y0 + 0.72, Math.sin(a) * (bw / 2 - 0.55), 0.72);
      }
    }
    // eave skirt around the next storey, then the pyramid crown
    if (idx < 3) {
      roofSkirt(kit, {
        w: lv.out, d: lv.out,
        wIn: levels[idx + 1].w + 0.9, dIn: levels[idx + 1].w + 0.9,
        y0: y1, y1: levels[idx + 1].y0 - 0.05,
        cornerLift: 1.0, nx: 12, nz: 10,
      });
    } else {
      roofPyramid(kit, { w: lv.out, d: lv.out, y0: y1, rise: 4.3, cornerLift: 1.35, nx: 12, nz: 10 });
      // gilded 宝顶
      kit.cyl(0.95, 1.15, 0.5, 10, 0, y1 + 4.2, 0, 'gold');
      kit.cyl(0.7, 0.82, 0.26, 10, 0, y1 + 4.58, 0, 'gold');
      kit.add(new T.SphereGeometry(0.82, 10, 8), 'gold', 0, y1 + 5.2, 0);
      kit.cyl(0.32, 0.52, 0.55, 8, 0, y1 + 5.85, 0, 'gold');
      kit.cyl(0.045, 0.26, 1.55, 8, 0, y1 + 6.9, 0, 'gold');
      kit.add(new T.SphereGeometry(0.17, 6, 5), 'gold', 0, y1 + 7.72, 0);
    }
  });

  // ---- name plaques (the tower is 崇丽阁; 望江楼 is the name everyone knows)
  plaque(kit, '望江楼', 3.2, 1.05, 0, 5.35, -(6.3 - 0.47), Math.PI, 'ink');
  plaque(kit, '望江楼', 2.6, 0.85, 0, 21.25, 4.44, 0, 'ink');
  plaque(kit, '望江楼', 2.6, 0.85, 0, 21.25, -4.44, Math.PI, 'ink');
  plaque(kit, '崇丽阁', 2.4, 0.8, 5.36, 9.9, 0, Math.PI / 2, 'ink');
  plaque(kit, '崇丽阁', 2.4, 0.8, -5.36, 9.9, 0, -Math.PI / 2, 'ink');

  // ---- bamboo grove + garden furniture
  ensureShapes(kit);
  const r = rng(2024);
  for (let i = 0; i < 68; i++) {
    const a = r() * Math.PI * 2;
    const rad = 14.8 + r() * 10.6;
    if (Math.abs(a + Math.PI / 2) < 0.26) continue;
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    const h = 6.5 + r() * 4.5;
    kit.inst('culm', x, 0, z, r() * 6.28, 0.9 + r() * 0.55, h, 0.9 + r() * 0.55);
    kit.inst('leaf', x, h * 0.82, z, r() * 6.28, 1.2 + r() * 0.35, 1.0 + r() * 0.3, 1);
    kit.inst('leaf', x, h * 0.6, z, r() * 6.28, 0.95 + r() * 0.3, 0.85, 1);
  }
  for (const sx of [-1, 1]) {
    kit.box(2.4, 0.42, 0.6, sx * 5.5, 0.38, -13.4, 'stoneLight');
    stoneLantern(kit, sx * 4.6, -12.4, 0.8);
  }
  // low stone curb around the lawn
  for (const [x, z, w, d] of [[0, 26.1, 52.4, 0.5], [0, -26.1, 52.4, 0.5], [26.1, 0, 0.5, 52.4], [-26.1, 0, 0.5, 52.4]]) {
    kit.box(w, 0.3, d, x, 0.22, z, 'stoneLight');
  }
  tree(kit, -20.5, 9.5, 1.25, 'green', 5);
  tree(kit, 20, 13, 1.15, 'dark', 6);
  tree(kit, 18, -18, 1.3, 'green', 7);
  tree(kit, -18, -17, 1.1, 'gold', 8);
  for (const [x, z, s] of [[-11.5, -8, 1.1], [11.5, -9, 1.0], [-12, 6, 0.9], [12.5, 7, 1.1], [0, 16.5, 1.0], [-6, 14, 0.8]]) shrub(kit, x, z, s);

  return finishLandmark(kit, site, 60, 60, TOP);
}

// ---------------------------------------------------------------------------------------------
export const LANDMARKS = {
  ansun_bridge: {
    label: '安顺廊桥',
    build: buildAnsun,
  },
  wangjiang_tower: {
    label: '望江楼',
    build: buildWangjiang,
  },
  wenshu_monastery: {
    label: '文殊院',
    build: buildWenshu,
  },
  kuanzhai: {
    label: '宽窄巷子',
    build: buildKuanzhai,
  },
  wuhou_jinli: {
    label: '武侯祠·锦里',
    build: buildWuhou,
  },
  qingyang_palace: {
    label: '青羊宫',
    build: buildQingyang,
  },
  dufu_cottage: {
    label: '杜甫草堂',
    build: buildDufu,
  },
  daci_temple: {
    label: '大慈寺',
    build: buildDaci,
  },
};
