import * as THREE from 'three/webgpu';

// 骑大熊猫: a procedural giant panda (≈2.45 m at the ears, ≈3.2 m nose to tail) with a player rider.
//
// No skinning: the animal is a nested Group rig of spheres and capsules. controllers.js drives the gait
// through posePandaRig() from the entity's speed / turn / hop state. +Z is forward, the ground is y = 0,
// so entity.mesh sits on the ground at the same height as the cyclist and scooter.
//
// Panda markings follow the real animal: white head & body, black ears, eye patches, muzzle band, shoulder
// cape & all four legs, plus a Chengdu lucky red scarf, a bamboo sprig and a blanket the rider sits on.

const FUR_WHITE = 0xece6da;
const FUR_CREAM = 0xdcd2c1;
const FUR_BLACK = 0x232329;
const PATCH_BLACK = 0x1b1b21;
const SCARF_RED = 0xc8102e;
const SCARF_DARK = 0x930f22;
const GOLD = 0xd8a545;
const SADDLE_RED = 0x9c1226;
const BAMBOO = 0x7cae48;
const BAMBOO_DARK = 0x527f2c;
const JACKET = 0x1f6b74;
const JACKET_TRIM = 0xeadfc8;
const PANTS = 0x262a35;
const SKIN = 0xd9a077;
const HAIR = 0x281a13;
const STRAW = 0xd9b477;

// Sphere geometries are shared and per-mesh non-uniformly scaled; detail levels keep the tiny parts cheap.
const sphereGeometries = new Map();
const capsuleGeometries = new Map();

function sphereGeometry(detail) {
  let geometry = sphereGeometries.get(detail);
  if (!geometry) {
    const sizes = { detail: [24, 16], medium: [16, 12], small: [10, 8], tiny: [6, 4] };
    const [widthSegments, heightSegments] = sizes[detail] || sizes.medium;
    geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
    sphereGeometries.set(detail, geometry);
  }
  return geometry;
}

function capsuleGeometry(radius, length, radialSegments = 12) {
  const key = `${radius}|${length}|${radialSegments}`;
  let geometry = capsuleGeometries.get(key);
  if (!geometry) {
    geometry = new THREE.CapsuleGeometry(radius, length, 4, radialSegments);
    capsuleGeometries.set(key, geometry);
  }
  return geometry;
}

function group(parent, x = 0, y = 0, z = 0) {
  const node = new THREE.Group();
  node.position.set(x, y, z);
  parent.add(node);
  return node;
}

function ball(parent, material, x, y, z, sx, sy, sz, detail = 'medium') {
  const mesh = new THREE.Mesh(sphereGeometry(detail), material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function box(parent, material, x, y, z, sx, sy, sz) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// A bone pointing down from its pivot: the capsule hangs below the joint and `tip` is the child joint.
function bone(pivot, material, radius, length, radialSegments = 12) {
  const total = length + radius * 2;
  const mesh = new THREE.Mesh(capsuleGeometry(radius, length, radialSegments), material);
  mesh.position.y = -total * 0.5;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  pivot.add(mesh);
  const tip = group(pivot, 0, -total, 0);
  return tip;
}

export const PANDA_SPEC = {
  height: 2.45, // metres to the ear tips
  length: 3.2, // nose to tail
  width: 1.63,
  bodyRadius: 1.1, // collision cylinder used by controllers.js
  bodyHeight: 2.6
};

function createMaterials() {
  const standard = (color, roughness = 0.86, metalness = 0) =>
    new THREE.MeshStandardNodeMaterial({ color, roughness, metalness });
  return {
    white: standard(FUR_WHITE, 0.88),
    cream: standard(FUR_CREAM, 0.92),
    black: standard(FUR_BLACK, 0.86),
    patch: standard(PATCH_BLACK, 0.84),
    nose: standard(0x121216, 0.34),
    eye: standard(0x07070a, 0.14),
    glint: new THREE.MeshBasicNodeMaterial({ color: 0xffffff }),
    scarf: standard(SCARF_RED, 0.64),
    scarfDark: standard(SCARF_DARK, 0.7),
    scarfDouble: new THREE.MeshStandardNodeMaterial({
      color: SCARF_RED,
      roughness: 0.64,
      side: THREE.DoubleSide
    }),
    saddleDouble: new THREE.MeshStandardNodeMaterial({
      color: SADDLE_RED,
      roughness: 0.62,
      side: THREE.DoubleSide
    }),
    gold: standard(GOLD, 0.36, 0.35),
    saddle: standard(SADDLE_RED, 0.62),
    bamboo: standard(BAMBOO, 0.6),
    bambooDark: standard(BAMBOO_DARK, 0.68),
    jacket: standard(JACKET, 0.68),
    trim: standard(JACKET_TRIM, 0.8),
    pants: standard(PANTS, 0.75),
    skin: standard(SKIN, 0.62),
    hair: standard(HAIR, 0.82),
    straw: standard(STRAW, 0.78)
  };
}

function buildFrontLeg(parent, materials, side) {
  const shoulder = group(parent, side * 0.56, 1.21, 0.64);
  shoulder.rotation.z = -side * 0.045;
  const elbow = bone(shoulder, materials.black, 0.23, 0.10);
  const paw = bone(elbow, materials.black, 0.205, 0.09);
  elbow.rotation.x = 0.05;
  const pad = ball(paw, materials.black, 0, -0.02, 0.035, 0.215, 0.135, 0.255, 'small');
  for (let toe = -1; toe <= 1; toe++) {
    ball(paw, materials.patch, toe * 0.085, -0.055, 0.19, 0.055, 0.05, 0.065, 'tiny');
  }
  return {
    side,
    front: true,
    shoulder,
    elbow,
    paw,
    pad,
    baseElbow: 0.05,
    baseShoulderZ: -side * 0.045,
    swingScale: 1.0
  };
}

function buildHindLeg(parent, materials, side) {
  const hip = group(parent, side * 0.52, 1.22, -0.66);
  hip.rotation.z = -side * 0.03;
  // Heavy black haunch over the hip, then the leg proper
  ball(parent, materials.black, side * 0.52, 1.16, -0.64, 0.34, 0.43, 0.45, 'medium');
  const knee = bone(hip, materials.black, 0.24, 0.08);
  const foot = bone(knee, materials.black, 0.20, 0.08);
  knee.rotation.x = -0.08;
  const pad = ball(foot, materials.black, 0, -0.03, 0.06, 0.20, 0.145, 0.30, 'small');
  for (let toe = -1; toe <= 1; toe++) {
    ball(foot, materials.patch, toe * 0.075, -0.07, 0.22, 0.05, 0.05, 0.06, 'tiny');
  }
  return {
    side,
    front: false,
    shoulder: hip,
    elbow: knee,
    paw: foot,
    pad,
    baseElbow: -0.08,
    baseShoulderZ: -side * 0.03,
    swingScale: 0.9
  };
}

function buildHead(parent, materials) {
  // White neck and chest, then a head pivot at the neck joint so nods and look-arounds swing the whole head.
  ball(parent, materials.white, 0, 1.55, 0.91, 0.46, 0.44, 0.42, 'medium');
  ball(parent, materials.white, 0, 1.40, 0.84, 0.52, 0.36, 0.34, 'medium');
  const headPivot = group(parent, 0, 1.57, 0.87);
  const head = group(headPivot, 0, 0.23, 0.39);
  ball(head, materials.white, 0, 0, 0, 0.535, 0.505, 0.505, 'detail');
  // Cheeks keep the face wide and chubby
  for (const side of [-1, 1]) {
    ball(head, materials.white, side * 0.28, -0.08, 0.22, 0.23, 0.21, 0.21, 'medium');
  }

  // Black ears: flattened discs that jiggle with the gait
  const ears = {};
  for (const side of [-1, 1]) {
    const ear = group(head, side * 0.335, 0.345, 0.01);
    ear.rotation.set(-0.08, side * 0.28, side * 0.22);
    ball(ear, materials.patch, side * 0.055, 0.05, 0, 0.195, 0.195, 0.105, 'small');
    ball(ear, materials.black, side * 0.055, 0.05, 0.045, 0.125, 0.125, 0.055, 'tiny');
    ears[side < 0 ? 'l' : 'r'] = { node: ear, base: ear.rotation.clone() };
  }

  // The classic big slanted eye patches, with glossy eyes and tiny catchlights
  const patches = [];
  for (const side of [-1, 1]) {
    const patch = group(head, side * 0.225, 0.085, 0.398);
    patch.rotation.set(0.04, side * 0.38, side * 0.60);
    ball(patch, materials.patch, 0, 0, 0, 0.148, 0.178, 0.08, 'small');
    ball(patch, materials.eye, 0, 0.005, 0.072, 0.052, 0.058, 0.048, 'tiny');
    ball(patch, materials.glint, side * 0.015, 0.03, 0.10, 0.012, 0.012, 0.009, 'small');
    patches.push(patch);
  }

  // Muzzle group: the nose, smile and bamboo sprig chew up and down together
  const muzzle = group(head, 0, -0.13, 0.14);
  ball(muzzle, materials.white, 0, 0, 0.26, 0.265, 0.178, 0.18, 'medium');
  ball(muzzle, materials.nose, 0, 0.058, 0.415, 0.07, 0.047, 0.045, 'small');
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.009, 6, 14, Math.PI), materials.nose);
  smile.position.set(0, -0.045, 0.425);
  smile.rotation.set(-0.5, 0, Math.PI);
  smile.castShadow = true;
  muzzle.add(smile);

  // A little bamboo sprig at the corner of the mouth: stalk + two leaves, angled clear of the eye patches.
  const bamboo = group(muzzle, 0.14, -0.08, 0.34);
  bamboo.rotation.set(0.25, 0.15, -1.2);
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.017, 0.30, 7), materials.bambooDark);
  stalk.position.y = 0.13;
  stalk.castShadow = true;
  bamboo.add(stalk);
  const leafGeometry = new THREE.SphereGeometry(1, 8, 6);
  for (const [angle, height, reach] of [[0.75, 0.245, 0.045], [1.65, 0.215, 0.05]]) {
    const leaf = new THREE.Mesh(leafGeometry, materials.bamboo);
    leaf.position.set(Math.sin(angle) * reach, height, Math.cos(angle) * reach);
    leaf.rotation.set(0.2, 0, angle + 0.25);
    leaf.scale.set(0.032, 0.115, 0.016);
    leaf.castShadow = true;
    bamboo.add(leaf);
  }

  return { headPivot, head, ears, patches, muzzle, bamboo };
}

function buildScarf(parent, materials) {
  // Lucky red scarf wrapped round the neck, with a knot and two ribbons trailing over the right shoulder
  const scarf = group(parent, 0, 0, 0);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.485, 0.445, 0.20, 20, 1, true), materials.scarfDouble);
  band.position.set(0, 1.625, 0.95);
  band.rotation.x = 0.2;
  band.castShadow = true;
  band.receiveShadow = true;
  scarf.add(band);
  ball(scarf, materials.scarf, 0.44, 1.60, 0.99, 0.08, 0.085, 0.072, 'small');
  ball(scarf, materials.gold, 0.47, 1.597, 1.005, 0.035, 0.035, 0.03, 'tiny');

  const tails = [];
  for (const [index, offset] of [[0, 0.0], [1, 0.07]]) {
    const base = group(scarf, 0.43 + index * 0.02, 1.57 - index * 0.012, 0.95 - index * 0.03);
    base.rotation.set(1.08 + offset, 0.42, 0.32 + offset);
    box(base, materials.scarf, 0, -0.20, 0, 0.10, 0.40, 0.018);
    const tip = group(base, 0, -0.40, 0);
    tip.rotation.x = 0.3;
    box(tip, materials.scarfDark, 0, -0.14, 0, 0.09, 0.28, 0.016);
    box(tip, materials.gold, 0, -0.285, 0, 0.092, 0.02, 0.018);
    tails.push({ node: base, baseX: base.rotation.x, baseZ: base.rotation.z, lag: index * 0.6 });
  }
  return { group: scarf, band, tails };
}

function buildRider(parent, materials) {
  const pivot = group(parent, 0, 1.955, -0.30);
  const baseY = pivot.position.y;

  // Saddle blanket: a curved shell draped over the barrel (gold piping along its front and back edges),
  // with the red seat pad on top
  const blanketGeometry = new THREE.CylinderGeometry(1, 1, 1, 22, 1, true, Math.PI - 0.95, 1.9);
  blanketGeometry.rotateX(Math.PI * 0.5);
  const blanket = new THREE.Mesh(blanketGeometry, materials.saddleDouble);
  blanket.position.set(0, 1.315, -0.28);
  blanket.scale.set(0.78, 0.62, 0.70);
  blanket.castShadow = true;
  blanket.receiveShadow = true;
  parent.add(blanket);
  const pipingGeometry = new THREE.TorusGeometry(1, 0.022, 6, 22, 1.9);
  pipingGeometry.rotateZ(Math.PI - 0.95);
  for (const side of [-1, 1]) {
    const piping = new THREE.Mesh(pipingGeometry, materials.gold);
    piping.position.set(0, 1.315, -0.28 + side * 0.35);
    piping.scale.set(0.78, 0.62, 1);
    piping.castShadow = true;
    parent.add(piping);
  }
  // Soft red seat cushion on the blanket, with a gold rim peeking out beneath it
  ball(parent, materials.gold, 0, 1.925, -0.30, 0.345, 0.048, 0.385, 'small');
  ball(parent, materials.saddle, 0, 1.935, -0.30, 0.315, 0.068, 0.355, 'medium');
  for (const side of [-1, 1]) {
    for (const z of [-0.10, -0.46]) {
      ball(parent, materials.scarf, side * 0.585, 1.705, z, 0.044, 0.044, 0.044, 'tiny');
      const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.033, 0.16, 6), materials.gold);
      tassel.position.set(side * 0.585, 1.615, z);
      tassel.rotation.z = side * 0.10;
      tassel.castShadow = true;
      parent.add(tassel);
    }
  }

  // Rider body: hips, jacket, chest and head
  ball(pivot, materials.pants, 0, 0.075, 0, 0.22, 0.155, 0.195, 'medium');
  const torso = group(pivot, 0, 0.10, 0);
  torso.rotation.x = 0.22;
  ball(torso, materials.jacket, 0, 0.21, 0, 0.235, 0.29, 0.20, 'medium');
  ball(torso, materials.jacket, 0, 0.41, 0.005, 0.225, 0.125, 0.175, 'small');
  box(torso, materials.trim, 0, 0.22, 0.198, 0.035, 0.36, 0.02);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.10, 8), materials.skin);
  neck.position.set(0, 0.49, 0.02);
  neck.castShadow = true;
  torso.add(neck);

  const head = group(torso, 0, 0.60, 0.03);
  ball(head, materials.skin, 0, 0, 0, 0.145, 0.155, 0.15, 'medium');
  ball(head, materials.hair, 0, 0.045, -0.045, 0.148, 0.135, 0.14, 'medium');
  for (const side of [-1, 1]) {
    ball(head, materials.eye, side * 0.055, 0.015, 0.132, 0.014, 0.017, 0.012, 'tiny');
  }
  ball(head, materials.skin, 0, -0.045, 0.14, 0.026, 0.022, 0.025, 'tiny');

  // Bamboo-weave conical hat (成都 style), red band around its base
  const hat = group(head, 0, 0.12, 0);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.325, 0.17, 18, 1, true), materials.straw);
  cone.position.y = 0.075;
  cone.castShadow = true;
  cone.receiveShadow = true;
  hat.add(cone);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.035, 16, 1, true), materials.scarf);
  band.position.y = 0.02;
  band.castShadow = true;
  hat.add(band);
  ball(head, materials.straw, 0, 0.145, 0, 0.035, 0.04, 0.035, 'tiny');

  // Arms: the left hand grips the blanket, the right one is thrown up like a rodeo rider
  const arms = {};
  for (const side of [-1, 1]) {
    const shoulder = group(torso, side * 0.195, 0.415, 0.0);
    const elbow = bone(shoulder, materials.jacket, 0.062, 0.16, 10);
    const hand = bone(elbow, materials.skin, 0.052, 0.13, 10);
    ball(hand, materials.skin, 0, -0.02, 0.02, 0.062, 0.058, 0.07, 'tiny');
    arms[side < 0 ? 'l' : 'r'] = { shoulder, elbow, hand };
  }
  arms.l.shoulder.rotation.set(-0.65, 0, 0.55);
  arms.l.elbow.rotation.set(-0.45, 0, 0.30);
  arms.r.shoulder.rotation.set(-0.35, 0, 2.30);
  arms.r.elbow.rotation.set(-0.55, 0, -0.25);
  const armWaveBase = arms.r.shoulder.rotation.z;

  // Legs straddling the panda's back, feet resting on its flanks
  const legs = {};
  for (const side of [-1, 1]) {
    const hip = group(pivot, side * 0.155, 0.06, 0.02);
    hip.rotation.set(-0.30, 0, side * 1.22);
    const knee = bone(hip, materials.pants, 0.078, 0.16, 10);
    knee.rotation.set(0.30, 0, -side * 0.72);
    const foot = bone(knee, materials.pants, 0.062, 0.17, 10);
    foot.rotation.set(0.15, 0, -side * 0.18);
    ball(foot, materials.straw, 0, -0.02, 0.05, 0.075, 0.06, 0.13, 'tiny');
    legs[side < 0 ? 'l' : 'r'] = { hip, knee, foot };
  }


  return { pivot, baseY, torso, baseTorsoX: torso.rotation.x, head, hat, arms, armWaveBase, legs };
}

export function buildPandaRig() {
  const materials = createMaterials();

  const root = new THREE.Group();
  root.name = 'PandaRig';
  const squash = group(root, 0, 0, 0);
  const bob = group(squash, 0, 0, 0);

  // Barrel body: rump, chest, white belly and the black shoulder cape
  ball(bob, materials.white, 0, 1.30, -0.10, 0.78, 0.60, 1.04, 'detail');
  ball(bob, materials.white, 0, 1.33, -0.72, 0.735, 0.555, 0.54, 'medium');
  ball(bob, materials.cream, 0, 0.87, 0.06, 0.56, 0.20, 0.70, 'medium');
  const cape = ball(bob, materials.black, 0, 1.375, 0.50, 0.795, 0.525, 0.47, 'detail');
  cape.rotation.x = -0.10;

  const head = buildHead(bob, materials);
  const scarf = buildScarf(bob, materials);

  const legs = {
    fl: buildFrontLeg(bob, materials, -1),
    fr: buildFrontLeg(bob, materials, 1),
    hl: buildHindLeg(bob, materials, -1),
    hr: buildHindLeg(bob, materials, 1)
  };

  // Short white tail on a little pivot so it can wag
  const tail = group(bob, 0, 1.50, -1.09);
  ball(tail, materials.white, 0, 0, -0.07, 0.145, 0.125, 0.16, 'small');
  ball(tail, materials.black, 0, -0.07, -0.09, 0.075, 0.075, 0.10, 'tiny');

  const rider = buildRider(bob, materials);

  root.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return {
    root,
    squash,
    bob,
    cape,
    head,
    scarf,
    legs,
    tail,
    rider,
    phase: 0,
    time: 0,
    landSquash: 0,
    wasAirborne: false
  };
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Pose the rig from the controller state: speed (m/s, signed), turn (-1 left .. 1 right for the controller),
// airborne / verticalVel (the hop), and active (false on the other modes: the panda then idles & breathes).
export function posePandaRig(rig, dt, state = {}) {
  if (!rig) return;
  dt = Math.max(0, Math.min(0.08, dt || 0));
  const speed = state.speed || 0;
  const absSpeed = Math.abs(speed);
  const turn = state.turn || 0;
  const airborne = !!state.airborne;
  rig.time += dt;
  rig.phase += speed * 2.05 * dt;
  if (rig.phase > 4096 || rig.phase < -4096) rig.phase %= Math.PI * 2;

  // Landing squash: detected here so every landing (hop, kerb or step) squashes the body.
  if (!airborne && rig.wasAirborne) rig.landSquash = 1;
  rig.wasAirborne = airborne;
  rig.landSquash *= Math.exp(-dt * 7.5);
  const stretch = airborne ? clamp((state.verticalVel || 0) * 0.032, -0.09, 0.15) : 0;
  const squashY = 1 + stretch - rig.landSquash * 0.22;
  const squashXZ = 1 - stretch * 0.45 + rig.landSquash * 0.12;
  rig.squash.scale.set(squashXZ, squashY, squashXZ);

  const gait = Math.min(1, absSpeed / 1.4);
  const fast = Math.min(1, absSpeed / 12);
  const idle = 1 - Math.min(1, absSpeed / 1.1);

  // Lumbering waddle: the body bobs twice per stride and rolls over the planted side; A/D lean into the turn.
  const bob = absSpeed > 0.05
    ? Math.abs(Math.sin(rig.phase)) * 0.055 * gait
    : Math.sin(rig.time * 1.45) * 0.014;
  rig.bob.position.y = bob;
  rig.bob.rotation.z = Math.sin(rig.phase) * 0.075 * gait - turn * Math.min(1, absSpeed / 7) * 0.22;
  rig.bob.rotation.x = (airborne ? -0.05 : 0) + Math.sin(rig.phase * 2) * 0.012 * gait;

  // Head: nod with the gait, look into the turn, and glance around while idle
  const glance = Math.pow(Math.sin(rig.time * 0.23 + 0.6), 5) * 0.55 * idle;
  rig.head.headPivot.rotation.y = glance + turn * 0.30 * Math.min(1, absSpeed / 6);
  rig.head.headPivot.rotation.x = -Math.sin(rig.phase * 2) * 0.03 * gait - idle * 0.02 - (airborne ? 0.10 : 0);
  rig.head.headPivot.rotation.z = -turn * 0.10 * Math.min(1, absSpeed / 6);

  // Chewing: while nearly stopped, the muzzle works the bamboo sprig
  const chew = idle * Math.sin(rig.time * 8.0) * Math.max(0, Math.sin(rig.time * 0.45 + 0.7) - 0.35) * 0.093;
  rig.head.muzzle.rotation.x = -0.01 + chew;
  rig.head.bamboo.rotation.z = -1.35 + chew * 1.6;

  // Ears jiggle with each footfall and flap on landing
  const earJig = Math.sin(rig.phase * 2 + 0.4) * (0.06 + 0.12 * gait) + rig.landSquash * 0.22 + (airborne ? 0.10 : 0);
  for (const [key, sign] of [['l', 1], ['r', -1]]) {
    const ear = rig.head.ears[key];
    ear.node.rotation.z = ear.base.z + earJig * 0.75 * sign;
    ear.node.rotation.x = ear.base.x + Math.sin(rig.time * 2.1 + sign) * 0.02 * (0.4 + gait);
  }

  // Four-leg pacing gait: left front & left hind swing together, then the right pair.
  // Legs tuck under the body during the hop.
  const legs = [rig.legs.fl, rig.legs.hl, rig.legs.fr, rig.legs.hr];
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    // Pacing gait: the left front & left hind swing together, then the right pair.
    const offset = leg.side < 0 ? 0 : Math.PI;
    const a = rig.phase + offset;
    const swing = Math.sin(a);
    const swingUp = Math.max(0, -Math.cos(a)); // leg is off the ground while it travels forward
    leg.shoulder.rotation.x = swing * 0.40 * gait * leg.swingScale + (airborne ? (leg.front ? 0.30 : -0.22) : 0);
    leg.shoulder.rotation.z = leg.baseShoulderZ;
    leg.elbow.rotation.x = leg.baseElbow
      + (leg.front ? 1 : -1) * swingUp * 0.55 * gait
      + (airborne ? (leg.front ? 0.55 : -0.40) : 0);
    leg.paw.rotation.x = (leg.front ? -1 : 1) * swingUp * 0.30 * gait + (airborne ? (leg.front ? -0.25 : 0.35) : 0);
  }

  // Tail wags a little faster while trotting
  rig.tail.rotation.y = Math.sin(rig.time * 2.4 + rig.phase * 0.5) * (0.07 + 0.10 * gait);
  rig.tail.rotation.x = Math.sin(rig.time * 1.7) * 0.06;

  // Scarf tails stream backwards with speed and bounce with the gait and the hop
  const flutter = 0.32 + fast * 1.15;
  for (let i = 0; i < rig.scarf.tails.length; i++) {
    const tail = rig.scarf.tails[i];
    tail.node.rotation.x = tail.baseX - fast * 0.38 + Math.sin(rig.time * (7.5 + i * 2.1) + tail.lag) * 0.10 * flutter
      + (airborne ? -0.28 : 0);
    tail.node.rotation.z = tail.baseZ + Math.cos(rig.time * (6.2 + i * 1.4) + tail.lag) * 0.09 * flutter;
  }

  // Rider: bounces a beat behind the panda, leans forward with speed and waves the free arm
  const rider = rig.rider;
  rider.pivot.position.y = rider.baseY
    + Math.sin(rig.phase * 2 - 0.7) * 0.028 * gait
    + rig.landSquash * 0.035;
  rider.pivot.rotation.z = -turn * 0.08 * Math.min(1, absSpeed / 6) + Math.sin(rig.phase * 2 - 0.3) * 0.02 * gait;
  rider.torso.rotation.x = rider.baseTorsoX + fast * 0.16 + (airborne ? -0.08 : 0);
  rider.head.rotation.y = glance * 0.7 + turn * 0.28 * Math.min(1, absSpeed / 6);
  rider.arms.r.shoulder.rotation.z = rider.armWaveBase
    + Math.sin(rig.time * 5.5) * (0.10 + fast * 0.22)
    + (airborne ? 0.25 : 0);
  rider.arms.r.shoulder.rotation.x = -0.35 + Math.sin(rig.time * 4.1 + 1.0) * 0.09;
  rider.arms.l.shoulder.rotation.x = -0.65 + Math.sin(rig.phase * 2) * 0.02 * gait;
  rider.hat.rotation.z = Math.sin(rig.phase * 2 + 0.35) * 0.045 * gait;
  rider.hat.rotation.x = -Math.sin(rig.phase * 2) * 0.03 * gait;
}

// Fresh pose for a teleport: no leftover squash, mid-stride legs or airborne scarf.
export function resetPandaPose(rig) {
  if (!rig) return;
  rig.phase = 0;
  rig.time = 0;
  rig.landSquash = 0;
  rig.wasAirborne = false;
  rig.squash.scale.set(1, 1, 1);
  rig.bob.position.set(0, 0, 0);
  rig.bob.rotation.set(0, 0, 0);
  rig.head.headPivot.rotation.set(0, 0, 0);
  for (const tail of rig.scarf.tails) tail.node.rotation.set(tail.baseX, 0, tail.baseZ);
}
