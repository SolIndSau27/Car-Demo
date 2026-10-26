import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Escena de estudio: piso, sombras suaves, luz de estudio y cámara orbital con límites. */
export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9ecef);
  scene.fog = new THREE.Fog(0xe9ecef, 14, 34);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
  camera.position.set(5.6, 2.4, 5.2);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xb0b4b8, 0.6);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(4, 8, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -5;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 20;
  key.shadow.radius = 6;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xdfe8ff, 0.5);
  rim.position.set(-6, 4, -5);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(30, 64),
    new THREE.MeshStandardMaterial({ color: 0xdfe2e6, roughness: 0.95, metalness: 0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(20, 40, 0xc4c9cf, 0xd3d7dc);
  grid.position.y = 0.001;
  grid.material.transparent = true;
  grid.material.opacity = 0.5;
  scene.add(grid);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0.2, 0.6, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.6;
  controls.maxDistance = 14;
  controls.maxPolarAngle = Math.PI / 2 - 0.04; // no meterse bajo el piso
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.addEventListener('change', () => {
    // El objetivo y la cámara nunca bajan del piso.
    if (controls.target.y < 0.05) controls.target.y = 0.05;
    if (camera.position.y < 0.08) camera.position.y = 0.08;
  });

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  const tickers = new Set();
  const frame = () => {
    controls.update();
    tickers.forEach((fn) => fn());
    renderer.render(scene, camera);
  };
  renderer.setAnimationLoop(frame);

  return {
    renderer,
    scene,
    camera,
    controls,
    onTick: (fn) => tickers.add(fn),
    /** Detiene/reanuda el loop (útil para capturas y pruebas automáticas). */
    setPaused(paused) {
      renderer.setAnimationLoop(paused ? null : frame);
      if (paused) frame();
    },
  };
}
