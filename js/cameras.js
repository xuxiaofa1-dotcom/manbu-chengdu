import * as THREE from 'three/webgpu';
import { CITY_LANDMARKS } from './city-config.js';

// Chase, action, cockpit, fixed-location and aerial cameras, with mouse/touch orbit and zoom.

const CAMERA_PRESETS = [
  { id: 'chase',       name: '跟随镜头',        category: 'follow', fov: 56 },
  { id: 'action',      name: '低角度特写',      category: 'follow', fov: 60 },
  { id: 'pov',         name: '第一人称 / 车头', category: 'follow', fov: 68 },
  { id: 'tianfu',      name: '天府广场',        category: 'scenic', fov: 52 },
  { id: 'kuanzhai',    name: '宽窄巷子',        category: 'scenic', fov: 50 },
  { id: 'anshun',      name: '安顺廊桥',        category: 'scenic', fov: 50 },
  { id: 'wangjiang',   name: '望江楼',          category: 'scenic', fov: 50 },
  { id: 'ifs',         name: 'IFS 爬墙熊猫',    category: 'scenic', fov: 52 },
  { id: 'taikooli',    name: '远洋太古里',      category: 'scenic', fov: 52 },
  { id: 'drone',       name: '自动航拍',        category: 'scenic', fov: 50 }
];
// Where each scenic camera looks from: the landmarks' real places (city-config.js CITY_LANDMARKS)
const SITE = Object.fromEntries(CITY_LANDMARKS.map((l) => [l.id, l]));

class CameraSystem {
  constructor(domElement, controllerManager) {
    this.domElement = domElement;
    this.controllerManager = controllerManager;

    this.camera = new THREE.PerspectiveCamera(
      56,
      window.innerWidth / window.innerHeight,
      0.35,
      60000 // at 1:1 the boroughs & harbor run out ~20-40 km to the fogged horizon (reversed float depth keeps precision)
    );

    this.activePresetId = 'chase';
    this.orbitYawOffset = 0.0;
    this.orbitPitchOffset = 0.09;
    this.zoomMultiplier = 1.0;
    this.isDragging = false;
    this.userOrbitTimer = 0;

    this.currentPos = new THREE.Vector3(0, 10, 380);
    this.currentLookAt = new THREE.Vector3(0, 8, 440);
    this.initialized = false;

    // Follow cameras (chase / action) are smoothed relative to the followed entity, see update()
    this.followEntity = null;
    this.followOffset = new THREE.Vector3();
    this.followLookOffset = new THREE.Vector3();
    this.followBaseY = 0;
    this.smoothedSpeed = 0;
    this._desiredPos = new THREE.Vector3();
    this._desiredLook = new THREE.Vector3();

    this.bindPointerControls();
  }

  bindPointerControls() {
    const canvas = this.domElement;
    const pointers = new Map();
    canvas.style.touchAction = 'none';

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || pointers.size >= 2) return;
      // Only two touch pointers may share a gesture; mouse and pen drags stay independent.
      if (pointers.size && (e.pointerType !== 'touch' || pointers.values().next().value.type !== 'touch')) return;
      e.preventDefault();
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
      canvas.setPointerCapture(e.pointerId);
      this.isDragging = true;
      this.userOrbitTimer = 4.0;
    });

    canvas.addEventListener('pointermove', (e) => {
      const pointer = pointers.get(e.pointerId);
      if (!pointer) return;
      e.preventDefault();
      const dx = e.clientX - pointer.x;
      const dy = e.clientY - pointer.y;
      const pair = pointers.size === 2 ? [...pointers.values()] : null;
      const previousDistance = pair ? Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y) : 0;
      pointer.x = e.clientX;
      pointer.y = e.clientY;

      if (pair) {
        const distance = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
        if (previousDistance > 1 && distance > 1) {
          this.zoomMultiplier = Math.max(0.45, Math.min(2.4, this.zoomMultiplier * previousDistance / distance));
        }
      } else {
        this.orbitYawOffset -= dx * 0.0065;
        this.orbitPitchOffset = Math.max(-0.32, Math.min(0.68, this.orbitPitchOffset + dy * 0.005));
      }
      this.userOrbitTimer = 4.0;
    });

    const releasePointer = (id) => {
      if (!pointers.delete(id)) return;
      this.isDragging = pointers.size > 0;
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      canvas.addEventListener(type, (e) => releasePointer(e.pointerId));
    }
    const clearPointers = () => {
      for (const id of pointers.keys()) releasePointer(id);
    };
    this._clearPointers = clearPointers;
    window.addEventListener('blur', clearPointers);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearPointers();
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomMultiplier = Math.max(0.45, Math.min(2.4, this.zoomMultiplier + e.deltaY * 0.001));
    }, { passive: false });
  }

  setCameraPreset(presetId, snapImmediately = false) {
    // ('fixed' is the ?debug still camera: not in the cycle or the menus)
    const preset = presetId === 'fixed' ? { id: 'fixed', fov: 50 } : CAMERA_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    this.activePresetId = preset.id;
    this.camera.fov = preset.fov;
    this.camera.updateProjectionMatrix();
    if (snapImmediately) {
      this.initialized = false;
    }
  }

  applyGamepadInput(lookX, lookY, zoom, dt) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    if (this.activePresetId !== 'chase' && this.activePresetId !== 'pov') return;
    // POV uses the orbit angles, but only chase renders a zoomed camera distance.
    if (this.activePresetId !== 'chase') zoom = 0;
    if (!lookX && !lookY && !zoom) return;
    this.orbitYawOffset -= lookX * 2.0 * dt;
    this.orbitPitchOffset = Math.max(-0.32, Math.min(0.68, this.orbitPitchOffset + lookY * 1.25 * dt));
    this.zoomMultiplier = Math.max(0.45, Math.min(2.4, this.zoomMultiplier + zoom * 0.9 * dt));
    this.userOrbitTimer = 4.0;
  }

  resetOrbit() {
    this.orbitYawOffset = 0;
    this.orbitPitchOffset = 0.09;
    this.zoomMultiplier = 1;
    this.userOrbitTimer = 0;
  }

  resetForTeleport() {
    // Arrive with a fresh chase view, without carrying a previous drive or gesture into the destination.
    this._clearPointers();
    this.isDragging = false;
    this.resetOrbit();
    this.smoothedSpeed = 0;
    this.followEntity = null;
    this.followOffset.set(0, 0, 0);
    this.followLookOffset.set(0, 0, 0);
    this.followBaseY = 0;
    this.setCameraPreset('chase', true);
  }

  getActivePreset() {
    return CAMERA_PRESETS.find((p) => p.id === this.activePresetId) || CAMERA_PRESETS[0];
  }

  onResize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update(dt, elapsed) {
    const entity = this.controllerManager.getActiveEntity();
    const desiredPos = this._desiredPos;
    const desiredLook = this._desiredLook;

    if (this.userOrbitTimer > 0 && !this.isDragging) {
      this.userOrbitTimer = Math.max(0, this.userOrbitTimer - dt);
    }

    if (!this.isDragging && this.userOrbitTimer <= 0 && Math.abs(entity.speed) > 0.5) {
      this.orbitYawOffset -= Math.round(this.orbitYawOffset / (Math.PI * 2)) * (Math.PI * 2);
      this.orbitYawOffset += (0.0 - this.orbitYawOffset) * (1 - Math.exp(-dt * 2.2));
    }

    // The follow cameras pull back with speed, eased so that they drift back as the entity speeds up (and in as it
    // slows down); speedLag is about how far their former world-space smoothing left them trailing at 60 FPS
    this.smoothedSpeed += (Math.abs(entity.speed) - this.smoothedSpeed) * (1 - Math.exp(-dt * 3.0));
    const speedLag = this.smoothedSpeed * 0.1;

    const totalYaw = entity.heading + this.orbitYawOffset;

    switch (this.activePresetId) {
      case 'chase': {
        const dist = entity.chaseDistance * this.zoomMultiplier * (1 + Math.min(0.25, this.smoothedSpeed * 0.01));
        const height = entity.chaseHeight * this.zoomMultiplier + Math.sin(this.orbitPitchOffset) * dist * 0.85;
        const horizDist = Math.cos(this.orbitPitchOffset) * dist + speedLag;

        // The panda is 3.2 m long, so its rider hides the head from a dead-centre view: offset the chase
        // camera 1.2 m over the shoulder to keep both the rider and the panda's face in shot.
        const sideOffset = entity.type === 'panda' ? 1.2 : 0;
        desiredPos.set(
          entity.position.x - Math.sin(totalYaw) * horizDist + Math.cos(totalYaw) * sideOffset,
          Math.max(0.65, entity.position.y + height),
          entity.position.z - Math.cos(totalYaw) * horizDist - Math.sin(totalYaw) * sideOffset
        );

        // The panda is a tall, wide subject: bias the look up between the car's and the person's, so the
        // head, rider and red scarf stay in frame instead of hiding under the camera.
        const lookUpBias = entity.type === 'helicopter' ? 0.2
          : entity.type === 'car' ? 0.52
          : entity.type === 'panda' ? 1.2
          : 1.55;
        // The panda is long: a shorter look-ahead keeps its body centred instead of aiming at the
        // road ahead and leaving the animal low in the frame.
        const lookAhead = entity.type === 'panda' ? 3.4 : 5.2;
        desiredLook.set(
          entity.position.x + Math.sin(entity.heading) * lookAhead,
          entity.position.y + entity.cameraTargetOffset.y + lookUpBias,
          entity.position.z + Math.cos(entity.heading) * lookAhead
        );
        break;
      }

      case 'action': {
        // The panda is 3.2 m long: a rear three-quarter view hides its head behind the rider, so the
        // action camera sits low beside its flank (5 m to the side, 1.4 m back) for a profile close-up.
        const sideOffset = entity.type === 'car' ? 2.65 : (entity.type === 'helicopter' ? 4.2 : entity.type === 'panda' ? 4.4 : 0.95);
        const backDist = (entity.type === 'car' ? 3.6 : (entity.type === 'helicopter' ? 8.5 : entity.type === 'panda' ? 2.6 : 2.8)) + speedLag;
        const lowY = entity.type === 'helicopter' ? entity.position.y + 1.2 : entity.position.y + (entity.type === 'panda' ? 1.85 : 0.92);

        desiredPos.set(
          entity.position.x - Math.sin(entity.heading) * backDist + Math.cos(entity.heading) * sideOffset,
          Math.max(0.55, lowY),
          entity.position.z - Math.cos(entity.heading) * backDist - Math.sin(entity.heading) * sideOffset
        );
        desiredLook.set(
          entity.position.x + Math.sin(entity.heading) * (entity.type === 'panda' ? 1.2 : 3.2),
          entity.position.y + (entity.type === 'panda' ? 1.65 : 1.05),
          entity.position.z + Math.cos(entity.heading) * (entity.type === 'panda' ? 1.2 : 3.2)
        );
        break;
      }

      case 'pov': {
        let fwdOffset = 0.35;
        let eyeY = 1.68;
        if (entity.type === 'car') {
          fwdOffset = 0.55;
          eyeY = 1.52;
        } else if (entity.type === 'cyclist') {
          fwdOffset = 0.35;
          eyeY = 1.55;
        } else if (entity.type === 'scooter') {
          fwdOffset = 0.2;
          eyeY = 1.78;
        } else if (entity.type === 'panda') {
          // Over the panda's ears from the rider's hat
          fwdOffset = 0.45;
          eyeY = 2.85;
        } else if (entity.type === 'helicopter') {
          fwdOffset = 1.65;
          eyeY = 1.65;
        }

        desiredPos.set(
          entity.position.x + Math.sin(entity.heading) * fwdOffset,
          entity.position.y + eyeY,
          entity.position.z + Math.cos(entity.heading) * fwdOffset
        );
        desiredLook.set(
          entity.position.x + Math.sin(totalYaw) * 40.0,
          entity.position.y + eyeY + Math.sin(-this.orbitPitchOffset) * 18.0 + 1.5,
          entity.position.z + Math.cos(totalYaw) * 40.0
        );
        break;
      }

      // Chengdu's vantage cameras: a slow orbit around each sight, at the height that shows it off
      case 'tianfu':
      case 'kuanzhai':
      case 'anshun':
      case 'wangjiang':
      case 'ifs':
      case 'taikooli': {
        const c = SITE[this.activePresetId] || SITE.tianfu;
        // [orbit radius m, camera altitude m, look-at height m, angular speed rad/s]
        const SHOT = {
          tianfu: [430, 200, 6, 0.02], kuanzhai: [300, 80, 5, 0.03], anshun: [150, 38, 7, 0.045],
          wangjiang: [220, 70, 26, 0.035], ifs: [300, 150, 105, 0.028], taikooli: [300, 95, 8, 0.03]
        };
        const [R, alt, lookH, speed] = SHOT[this.activePresetId] || [180, 40, 10, 0.04];
        const a = elapsed * speed + 1.1;
        const drift = Math.sin(elapsed * 0.11) * 0.12;
        desiredPos.set(c.x + Math.cos(a + drift) * R, alt, c.z + Math.sin(a + drift) * R);
        desiredLook.set(c.x, lookH, c.z);
        break;
      }

      case 'drone': {
        const angle = elapsed * 0.045 + 0.65;
        const radius = 900.0 + Math.sin(elapsed * 0.13) * 160.0;
        const alt = 380.0 + Math.cos(elapsed * 0.11) * 90.0;
        // circling over the old town & 锦江 between 天府广场 and 九眼桥
        const c = SITE.tianfu;
        desiredPos.set(Math.cos(angle) * radius + c.x, alt, Math.sin(angle) * radius + c.z + 320.0);
        desiredLook.set(c.x, 40.0, c.z + 320.0);
        break;
      }

      case 'fixed': {
        // debugging & reference renders (main.js exposes it with ?debug): a still camera at fixedPos looking at fixedLook
        desiredPos.copy(this.fixedPos || desiredPos);
        desiredLook.copy(this.fixedLook || desiredLook);
        break;
      }
    }

    if (!this.initialized || this.activePresetId === 'pov') {
      this.currentPos.copy(desiredPos);
      this.currentLookAt.copy(desiredLook);
      this.initialized = true;
      this.followEntity = null; // the follow cameras re-anchor from here
    } else if (this.activePresetId === 'chase' || this.activePresetId === 'action') {
      // Smoothed in the followed entity's frame rather than in world space. A world-space follower trails a moving
      // target by a distance that depends on the frame time (about speed x dt), so with uneven frame times the camera
      // surged back and forth behind an accelerating or fast car. Relative to the entity a steady drive keeps the
      // camera steady, while turns, orbit drags, zoom & the speed pull-back are still eased. The entity's height is
      // eased in world space (curbs, park lawns, jumps, the helicopter climbing).
      if (this.followEntity !== entity) {
        // preset or mode switch: start from where the camera is and glide over to the new framing
        this.followEntity = entity;
        this.followBaseY = entity.position.y;
        this.followOffset.subVectors(this.currentPos, entity.position);
        this.followLookOffset.subVectors(this.currentLookAt, entity.position);
      }
      const k = 1 - Math.exp(-dt * 8.5);
      this.followBaseY += (entity.position.y - this.followBaseY) * k;
      this.followOffset.lerp(desiredPos.sub(entity.position), k);
      this.followLookOffset.lerp(desiredLook.sub(entity.position), k);
      this.currentPos.set(entity.position.x, this.followBaseY, entity.position.z).add(this.followOffset);
      this.currentLookAt.set(entity.position.x, this.followBaseY, entity.position.z).add(this.followLookOffset);
      this.currentPos.y = Math.max(0.55, this.currentPos.y);
    } else {
      this.followEntity = null;
      const k = 1 - Math.exp(-dt * 8.5);
      this.currentPos.lerp(desiredPos, k);
      this.currentLookAt.lerp(desiredLook, k);
    }

    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLookAt);
  }
}

export { CAMERA_PRESETS, CameraSystem };
