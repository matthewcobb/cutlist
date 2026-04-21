import type { NodePartMapping } from '~/utils/parseGltf';

// ─── Types ──────────────────────────────────────────────────────────

interface ThreeModules {
  THREE: typeof import('three');
  GLTFLoader: typeof import('three/addons/loaders/GLTFLoader.js').GLTFLoader;
  OrbitControls: typeof import('three/addons/controls/OrbitControls.js').OrbitControls;
  LineSegmentsGeometry: typeof import('three/addons/lines/LineSegmentsGeometry.js').LineSegmentsGeometry;
  LineSegments2: typeof import('three/addons/lines/LineSegments2.js').LineSegments2;
  LineMaterial: typeof import('three/addons/lines/LineMaterial.js').LineMaterial;
  RoomEnvironment: typeof import('three/addons/environments/RoomEnvironment.js').RoomEnvironment;
}

type Mesh = import('three').Mesh;
type Material = import('three').Material;
type Object3D = import('three').Object3D;
type MeshStandardMaterial = import('three').MeshStandardMaterial;

/** All state created by init(). One null-check gates everything. */
interface ViewerState {
  modules: ThreeModules;
  renderer: import('three').WebGLRenderer;
  camera: import('three').PerspectiveCamera;
  scene: import('three').Scene;
  controls: InstanceType<ThreeModules['OrbitControls']>;
  raycaster: import('three').Raycaster;
  mouse: import('three').Vector2;
  highlightMaterial: MeshStandardMaterial;
  edgeMaterial: InstanceType<ThreeModules['LineMaterial']>;
  shadowLight: import('three').DirectionalLight;
  resizeObserver: ResizeObserver;
  floorMesh: Mesh | null;
}

// ─── Module cache (shared across instances) ─────────────────────────

let _modules: ThreeModules | null = null;

async function loadThree(): Promise<ThreeModules> {
  if (_modules) return _modules;
  const [
    THREE,
    { GLTFLoader },
    { OrbitControls },
    { LineSegmentsGeometry },
    { LineSegments2 },
    { LineMaterial },
    { RoomEnvironment },
  ] = await Promise.all([
    import('three'),
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/controls/OrbitControls.js'),
    import('three/addons/lines/LineSegmentsGeometry.js'),
    import('three/addons/lines/LineSegments2.js'),
    import('three/addons/lines/LineMaterial.js'),
    import('three/addons/environments/RoomEnvironment.js'),
  ]);
  _modules = {
    THREE,
    GLTFLoader,
    OrbitControls,
    LineSegmentsGeometry,
    LineSegments2,
    LineMaterial,
    RoomEnvironment,
  };
  return _modules;
}

// ─── Constants ──────────────────────────────────────────────────────

const HIGHLIGHT_COLOR = 0x6ee7b7; // teal-300
const GHOST_OPACITY = 0.15;

const GRID_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec2 vWorldPos;
  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GRID_FRAGMENT_SHADER = `
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uGridSize;
  uniform float uLineWidth;
  varying vec2 vUv;
  varying vec2 vWorldPos;

  void main() {
    float distUV = length(vUv - 0.5) * 2.0;

    vec2 grid = abs(fract(vWorldPos / uGridSize - 0.5) - 0.5);
    float line = min(grid.x, grid.y);
    float gridMask = 1.0 - smoothstep(0.0, uLineWidth / uGridSize, line);

    float gridFade = 1.0 - smoothstep(0.15, 0.85, distUV);
    gridFade *= gridFade;

    float spotAlpha = 1.0 - smoothstep(0.0, 1.0, distUV);
    spotAlpha *= spotAlpha;
    float spotGlow = spotAlpha * 0.15;

    float gridAlpha = gridMask * gridFade * 0.45;

    vec3 color = mix(uColor2, uColor1, gridMask * gridFade);
    float alpha = max(spotGlow, gridAlpha);

    gl_FragColor = vec4(color, alpha);
  }
`;

// ─── Composable ─────────────────────────────────────────────────────

export default function useThreeViewer(
  container: Ref<HTMLElement | undefined>,
) {
  const store = useModelViewerStore();

  let state: ViewerState | null = null;

  // Part tracking
  const partMeshes = new Map<number, Mesh[]>();
  const meshToPart = new Map<Mesh, number>();
  const originalMaterials = new Map<Mesh, Material | Material[]>();
  const edgeLines = new Map<Mesh, Object3D>();
  const modelRoots = new Set<Object3D>();
  let ghostMaterials = new WeakMap<Material, Material>();
  let raycastTargets: Mesh[] | null = null;

  const ready = ref(false);
  let needsRender = true;
  let rafId = 0;
  let loadGeneration = 0;

  // ─── Render scheduling ──────────────────────────────────────────

  function requestRender() {
    needsRender = true;
  }

  function animationLoop() {
    if (!state) return;
    rafId = requestAnimationFrame(animationLoop);
    state.controls.update();
    if (needsRender) {
      state.renderer.render(state.scene, state.camera);
      needsRender = false;
    }
  }

  // ─── Raycast ────────────────────────────────────────────────────

  function getRaycastTargets(): Mesh[] {
    if (!raycastTargets) raycastTargets = [...meshToPart.keys()];
    return raycastTargets;
  }

  function raycastPart(event: {
    clientX: number;
    clientY: number;
  }): number | null {
    if (!state) return null;
    const rect = state.renderer.domElement.getBoundingClientRect();
    state.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    state.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    state.raycaster.setFromCamera(state.mouse, state.camera);
    const hit = state.raycaster.intersectObjects(getRaycastTargets(), false)[0];
    return hit ? meshToPart.get(hit.object as Mesh) ?? null : null;
  }

  function onPointerMove(event: PointerEvent) {
    const partNum = raycastPart(event);
    store.hoveredPartNumber.value = partNum;
    if (state)
      state.renderer.domElement.style.cursor = partNum != null ? 'pointer' : '';
  }

  function onClick(event: MouseEvent) {
    const partNum = raycastPart(event);
    store.selectedPartNumber.value =
      store.selectedPartNumber.value === partNum ? null : partNum;
  }

  // ─── Init ───────────────────────────────────────────────────────

  async function init(el: HTMLElement) {
    const modules = await loadThree();
    const { THREE } = modules;

    const scene = new THREE.Scene();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0c0c0f);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const rect = el.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height);
    el.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(
      50,
      rect.width / rect.height,
      0.001,
      1000,
    );
    camera.position.set(2, 1.5, 2);

    const controls = new modules.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.addEventListener('change', requestRender);

    // Hemisphere light — cool sky + warm earth gradient fill
    scene.add(new THREE.HemisphereLight(0xc8d8f0, 0x3a2820, 0.4));

    // Key light — warm white, casts shadows
    const shadowLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
    shadowLight.castShadow = true;
    shadowLight.shadow.mapSize.setScalar(2048);
    shadowLight.shadow.radius = 4;
    shadowLight.shadow.bias = -0.0005;
    scene.add(shadowLight, shadowLight.target);

    // Cool fill — lifts shadow faces with complementary tone
    const fill = new THREE.DirectionalLight(0xd0e0f8, 0.3);
    fill.position.set(-2, 4, -2);
    scene.add(fill);

    // Rim light — back-edge definition
    const rim = new THREE.DirectionalLight(0xffffff, 0.4);
    rim.position.set(-1, 3, -3);
    scene.add(rim);

    // Environment map — subtle PBR reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envMap = pmremGenerator.fromScene(
      new modules.RoomEnvironment(),
      0.04,
    ).texture;
    pmremGenerator.dispose();
    scene.environment = envMap;
    scene.environmentIntensity = 0.15;

    const highlightMaterial = new THREE.MeshStandardMaterial({
      color: HIGHLIGHT_COLOR,
      emissive: HIGHLIGHT_COLOR,
      emissiveIntensity: 0.25,
      roughness: 0.35,
      metalness: 0.1,
      envMapIntensity: 0.4,
    });

    const edgeMaterial = new modules.LineMaterial({
      color: 0x1a1a2e,
      linewidth: 2.5,
      transparent: true,
      opacity: 0.65,
      resolution: new THREE.Vector2(rect.width, rect.height),
    });

    // Events
    renderer.domElement.addEventListener('pointermove', onPointerMove, {
      passive: true,
    });
    renderer.domElement.addEventListener('click', onClick);

    const resizeObserver = new ResizeObserver(() => {
      if (!state) return;
      const r = el.getBoundingClientRect();
      state.renderer.setSize(r.width, r.height);
      state.camera.aspect = r.width / r.height;
      state.camera.updateProjectionMatrix();
      state.edgeMaterial.resolution.set(r.width, r.height);
      requestRender();
    });
    resizeObserver.observe(el);

    state = {
      modules,
      renderer,
      camera,
      scene,
      controls,
      raycaster: new THREE.Raycaster(),
      mouse: new THREE.Vector2(),
      highlightMaterial,
      edgeMaterial,
      shadowLight,
      resizeObserver,
      floorMesh: null,
    };

    ready.value = true;
    animationLoop();
  }

  // ─── Model loading ──────────────────────────────────────────────

  async function loadModel(
    gltfJson: object,
    nodePartMap: NodePartMapping[],
    partNumberOffset: number = 0,
  ) {
    if (!state) return;
    const { modules, scene, edgeMaterial } = state;
    const { THREE } = modules;

    const gen = ++loadGeneration;

    // Parse directly from JSON string — no Blob URL round-trip
    const loader = new modules.GLTFLoader();
    const gltf = await new Promise<
      import('three/addons/loaders/GLTFLoader.js').GLTF
    >((resolve, reject) =>
      loader.parse(JSON.stringify(gltfJson), '', resolve, reject),
    );
    if (gen !== loadGeneration || !state) return;

    const nodeColorMap = new Map<number, string>();
    for (const { nodeIndex, colorHex } of nodePartMap) {
      nodeColorMap.set(nodeIndex, colorHex);
    }

    for (const { nodeIndex, partNumber } of nodePartMap) {
      const adjustedPartNumber = partNumber + partNumberOffset;
      let node: Object3D;
      try {
        node = (await gltf.parser.getDependency('node', nodeIndex)) as Object3D;
      } catch {
        continue;
      }
      if (!node || gen !== loadGeneration || !state) continue;

      node.traverse((child) => {
        if (!(child as Mesh).isMesh) return;
        const mesh = child as Mesh;

        const existing = partMeshes.get(adjustedPartNumber) ?? [];
        existing.push(mesh);
        partMeshes.set(adjustedPartNumber, existing);
        meshToPart.set(mesh, adjustedPartNumber);
        originalMaterials.set(mesh, mesh.material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Apply the normalized color resolved at import time.
        // setRGB with SRGBColorSpace so Three.js converts sRGB→linear internally
        const colorHex = nodeColorMap.get(nodeIndex);
        if (colorHex) {
          const hexVal = parseInt(colorHex.slice(1), 16);
          const sr = ((hexVal >> 16) & 0xff) / 255;
          const sg = ((hexVal >> 8) & 0xff) / 255;
          const sb = (hexVal & 0xff) / 255;
          const mats = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          for (const m of mats) {
            const std = m as MeshStandardMaterial;
            if (!std.isMeshStandardMaterial) continue;
            std.color.setRGB(sr, sg, sb, THREE.SRGBColorSpace);
            std.roughness = 0.35;
            std.metalness = 0.05;
            std.envMapIntensity = 0.3;
          }
        }

        // Edge lines: EdgesGeometry → Line2 for GPU-based line width
        // Must be a sibling (not child) — Box3.expandByObject traverses children
        // and LineSegments2.updateWorldMatrix causes infinite recursion.
        if (mesh.parent) {
          const edges = new THREE.EdgesGeometry(mesh.geometry, 15);
          const positions = edges.attributes.position.array as Float32Array;
          edges.dispose();

          const lsg = new modules.LineSegmentsGeometry();
          lsg.setPositions(positions);
          const lines = new modules.LineSegments2(lsg, edgeMaterial);
          lines.computeLineDistances();
          lines.raycast = () => {};
          lines.position.copy(mesh.position);
          lines.rotation.copy(mesh.rotation);
          lines.scale.copy(mesh.scale);
          mesh.parent.add(lines);
          edgeLines.set(mesh, lines);
        }
      });
    }

    scene.add(gltf.scene);
    modelRoots.add(gltf.scene);
    raycastTargets = null;
    fitCamera();
    requestRender();
  }

  // ─── Camera ─────────────────────────────────────────────────────

  function fitCamera() {
    if (!state) return;
    const {
      modules: { THREE },
      scene,
      camera,
      controls,
      shadowLight,
    } = state;

    const box = new THREE.Box3();
    for (const meshes of partMeshes.values()) {
      for (const mesh of meshes) {
        mesh.updateWorldMatrix(true, false);
        box.expandByObject(mesh);
      }
    }
    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    const dist = (maxDim / (2 * Math.tan(fov / 2))) * 1.5;

    camera.position.copy(center);
    camera.position.x += dist * 0.7;
    camera.position.y += dist * 0.5;
    camera.position.z += dist * 0.7;

    controls.target.copy(center);
    camera.near = maxDim * 0.001;
    camera.far = maxDim * 100;
    camera.updateProjectionMatrix();

    // Floor grid + shadow plane
    const floorY = box.min.y - maxDim * 0.001;
    const floorSize = maxDim * 5;

    if (!state.floorMesh) {
      const gridMat = new THREE.ShaderMaterial({
        uniforms: {
          uColor1: { value: new THREE.Color(0x2dd4bf) },
          uColor2: { value: new THREE.Color(0x14b8a6) },
          uGridSize: { value: 0.05 },
          uLineWidth: { value: 0.002 },
        },
        vertexShader: GRID_VERTEX_SHADER,
        fragmentShader: GRID_FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
      });

      state.floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), gridMat);
      state.floorMesh.rotation.x = -Math.PI / 2;
      scene.add(state.floorMesh);

      // Shadow overlay (child — inherits position/scale)
      const shadowPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.ShadowMaterial({ opacity: 0.5 }),
      );
      shadowPlane.receiveShadow = true;
      shadowPlane.renderOrder = 1;
      state.floorMesh.add(shadowPlane);
    }

    state.floorMesh.position.set(center.x, floorY, center.z);
    state.floorMesh.scale.set(floorSize, floorSize, 1);

    // Scale grid to model size (~20 cells across)
    const floorMat = state.floorMesh.material as import('three').ShaderMaterial;
    if (floorMat.uniforms) {
      floorMat.uniforms.uGridSize.value = maxDim / 20;
      floorMat.uniforms.uLineWidth.value = maxDim / 800;
    }

    // Shadow camera sized to model
    const pad = maxDim * 1.2;
    shadowLight.position.set(
      center.x + maxDim * 1.5,
      center.y + maxDim * 3,
      center.z + maxDim * 1.5,
    );
    shadowLight.target.position.copy(center);
    shadowLight.target.updateWorldMatrix(false, false);
    const sc = shadowLight.shadow.camera as import('three').OrthographicCamera;
    sc.left = -pad;
    sc.right = pad;
    sc.top = pad;
    sc.bottom = -pad;
    sc.near = maxDim * 0.1;
    sc.far = maxDim * 8;
    sc.updateProjectionMatrix();

    controls.update();
    requestRender();
  }

  // ─── Highlight ──────────────────────────────────────────────────

  function highlightPart(partNumber: number | null) {
    if (!state) return;

    // Restore all to original
    for (const [mesh, original] of originalMaterials) {
      mesh.material = original;
      const lines = edgeLines.get(mesh);
      if (lines) lines.visible = true;
    }

    const targetMeshes =
      partNumber != null ? partMeshes.get(partNumber) : undefined;
    if (targetMeshes) {
      const targetSet = new Set(targetMeshes);
      for (const [mesh, original] of originalMaterials) {
        if (targetSet.has(mesh)) {
          mesh.material = state.highlightMaterial;
        } else {
          mesh.material = getGhostMaterial(original);
          const lines = edgeLines.get(mesh);
          if (lines) lines.visible = false;
        }
      }
    }

    requestRender();
  }

  function getGhostMaterial(
    original: Material | Material[],
  ): Material | Material[] {
    if (Array.isArray(original)) {
      return original.map((m) => getGhostMaterial(m) as Material);
    }
    let ghost = ghostMaterials.get(original);
    if (!ghost) {
      ghost = original.clone();
      ghost.transparent = true;
      ghost.opacity = GHOST_OPACITY;
      ghost.depthWrite = false;
      ghostMaterials.set(original, ghost);
    }
    return ghost;
  }

  // ─── Cleanup ────────────────────────────────────────────────────

  function disposeSceneGraph(obj: Object3D) {
    obj.traverse((child) => {
      const mesh = child as Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const mat of mats) mat?.dispose();
      }
    });
  }

  function clearModels() {
    if (!state) return;
    loadGeneration++;

    for (const lines of edgeLines.values()) {
      (lines as import('three').LineSegments).geometry?.dispose();
      lines.removeFromParent();
    }
    edgeLines.clear();

    for (const root of modelRoots) {
      disposeSceneGraph(root);
      state.scene.remove(root);
    }
    modelRoots.clear();

    partMeshes.clear();
    meshToPart.clear();
    originalMaterials.clear();
    ghostMaterials = new WeakMap();
    raycastTargets = null;
    requestRender();
  }

  function dispose() {
    if (!state) return;
    cancelAnimationFrame(rafId);
    clearModels();

    state.renderer.domElement.removeEventListener('pointermove', onPointerMove);
    state.renderer.domElement.removeEventListener('click', onClick);
    state.renderer.dispose();
    state.renderer.domElement.remove();
    state.controls.dispose();
    state.resizeObserver.disconnect();

    state = null;
    ready.value = false;
  }

  // ─── Watchers ───────────────────────────────────────────────────

  watch(
    () => store.hoveredPartNumber.value ?? store.selectedPartNumber.value,
    (partNumber) => highlightPart(partNumber),
  );

  watch(
    container,
    async (el) => {
      if (el && !state) await init(el);
    },
    { immediate: true },
  );

  onUnmounted(dispose);

  return {
    ready,
    loadModel,
    clearModels,
    fitCamera,
    dispose,
  };
}
