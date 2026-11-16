// Meshy로 만든 금동 불상 GLB를 불러와 법당 불단 자리에 모시기
// - 모델 크기를 '높이 1, 바닥 y=0, 가운데 x·z=0'으로 맞춰 두고, 자리마다 크기만 바꿔 복제
// - 금빛이 살도록 불상에만 은은한 반사 환경(RoomEnvironment)을 입힘
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export async function loadStatue(url, renderer) {
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url);
  const src = gltf.scene;
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose();
  src.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    ms.forEach(m => {
      if (!m.isMeshStandardMaterial) return;
      m.metalness = .55; m.roughness = .38; m.envMap = env; m.envMapIntensity = .9;
      if (m.map) { m.emissive = new THREE.Color(1, .85, .6); m.emissiveMap = m.map; m.emissiveIntensity = .18; }
      m.needsUpdate = true;
    });
  });
  const box = new THREE.Box3().setFromObject(src), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  src.position.set(-c.x, -box.min.y, -c.z);
  const unit = new THREE.Group(); unit.add(src); unit.scale.setScalar(1 / size.y);
  const ratio = { w: size.x / size.y, d: size.z / size.y };
  return {
    ratio,
    // 높이 h(m)짜리 불상 하나 만들기
    make(h) { const g = new THREE.Group(), u = unit.clone(); u.scale.setScalar(h / size.y); g.add(u); g.userData.depth = ratio.d * h; g.userData.width = ratio.w * h; return g; },
  };
}
