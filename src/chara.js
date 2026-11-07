// VRM の人物を読み込み、立ち姿・まばたき・呼吸・口の動き・表情・視線を付ける。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));

const FACES = ['happy', 'sad', 'angry', 'relaxed', 'surprised'];

export class Chara {
  static async load(url, onProgress) {
    const gltf = await loader.loadAsync(url, onProgress);
    const vrm = gltf.userData.vrm;
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    VRMUtils.rotateVRM0(vrm);
    vrm.scene.traverse((o) => { o.frustumCulled = false; });
    return new Chara(vrm);
  }

  constructor(vrm) {
    this.vrm = vrm;
    this.root = new THREE.Group();
    this.root.add(vrm.scene);
    this.t = Math.random() * 10;
    this.blinkAt = 1 + Math.random() * 3;
    this.blink = 0;
    this.talking = false;
    this.face = 'neutral';
    this.faceW = {};
    FACES.forEach((f) => (this.faceW[f] = 0));
    this.targetYaw = 0;
    this.lookTarget = new THREE.Object3D();
    this.looking = false;
    // VRM 0.x と 1.0 で、腕を下ろす回転の向きが逆になる
    this.armSign = vrm.meta && vrm.meta.metaVersion === '0' ? 1 : -1;
    this.restPose();
  }

  bone(name) { return this.vrm.humanoid.getNormalizedBoneNode(name); }

  restPose() {
    const L = this.bone('leftUpperArm'), R = this.bone('rightUpperArm');
    const k = this.armSign;
    if (L) L.rotation.z = 1.22 * k;
    if (R) R.rotation.z = -1.22 * k;
    const LL = this.bone('leftLowerArm'), RL = this.bone('rightLowerArm');
    if (LL) LL.rotation.y = 0.25 * k;
    if (RL) RL.rotation.y = -0.25 * k;
    const LH = this.bone('leftHand'), RH = this.bone('rightHand');
    if (LH) LH.rotation.z = 0.15 * k;
    if (RH) RH.rotation.z = -0.15 * k;
  }

  place(x, z, yaw) {
    this.root.position.set(x, 0, z);
    this.root.rotation.y = yaw;
    this.targetYaw = yaw;
    this.settle();
  }

  // 置き直したあと、髪やスカートの揺れ（スプリングボーン）を今の位置で止まった状態に戻す。
  // これをしないと、前の場所から引っぱられてスカートなどが大きくめくれる。
  settle() {
    this.vrm.humanoid.update();
    this.root.updateMatrixWorld(true);
    if (this.vrm.springBoneManager) this.vrm.springBoneManager.reset();
  }

  faceToward(x, z) {
    const p = this.root.position;
    this.targetYaw = Math.atan2(x - p.x, z - p.z);
  }

  setFace(f) { this.face = f || 'neutral'; }

  lookAt(obj) {
    this.looking = !!obj;
    if (this.vrm.lookAt) this.vrm.lookAt.target = obj || null;
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    // 向きをなめらかに変える
    let d = this.targetYaw - this.root.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.root.rotation.y += d * Math.min(1, dt * 5);

    // 呼吸と、体の小さなゆれ
    const spine = this.bone('spine'), chest = this.bone('chest') || this.bone('upperChest');
    if (spine) { spine.rotation.z = Math.sin(t * 0.7) * 0.015; spine.rotation.x = Math.sin(t * 1.6) * 0.01; }
    if (chest) chest.rotation.x = Math.sin(t * 1.6 + 0.4) * 0.018;
    const L = this.bone('leftUpperArm'), R = this.bone('rightUpperArm');
    const k = this.armSign;
    if (L) L.rotation.z = (1.22 - Math.sin(t * 1.6) * 0.015) * k;
    if (R) R.rotation.z = (-1.22 + Math.sin(t * 1.6) * 0.015) * k;
    const neck = this.bone('neck');
    if (neck && !this.looking) neck.rotation.y = Math.sin(t * 0.33) * 0.06;
    else if (neck) neck.rotation.y *= 0.9;

    // まばたき
    this.blinkAt -= dt;
    if (this.blinkAt < 0) { this.blink = 0.16; this.blinkAt = 2 + Math.random() * 3.5; }
    let bv = 0;
    if (this.blink > 0) { this.blink -= dt; bv = Math.sin(Math.max(0, this.blink) / 0.16 * Math.PI); }

    const em = this.vrm.expressionManager;
    if (em) {
      for (const f of FACES) {
        const goal = this.face === f ? (f === 'surprised' ? 0.7 : 0.85) : 0;
        this.faceW[f] += (goal - this.faceW[f]) * Math.min(1, dt * 8);
        em.setValue(f, this.faceW[f]);
      }
      // 笑顔やおどろきの顔は目の形が変わるので、まばたきを弱める
      const eyeBusy = Math.max(this.faceW.happy, this.faceW.relaxed);
      em.setValue('blink', bv * (1 - eyeBusy));
      const mouth = this.talking ? Math.max(0, Math.sin(t * 17)) * 0.55 + Math.max(0, Math.sin(t * 9.3)) * 0.25 : 0;
      em.setValue('aa', mouth);
    }
    this.vrm.update(dt);
  }
}
