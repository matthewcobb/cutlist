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
  batchMaterial: MeshStandardMaterial;
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

/** Highlight color for hovered/selected parts (Tailwind teal-300). */
const HIGHLIGHT_COLOR = 0x6ee7b7;
/** Alpha for non-highlighted parts when a part is selected/hovered. */
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

  // BatchedMesh tracking (replaces per-mesh Maps)
  let batchedMesh: import('three').BatchedMesh | null = null;
  const instanceToPartNumber: number[] = [];
  const partNumberToInstances = new Map<number, number[]>();
  const originalColors = new Map<number, [number, number, number, number]>();
  let sceneBounds: import('three').Box3 | null = null;

  // Edge lines (single merged draw call)
  let mergedEdgeLines: InstanceType<ThreeModules['LineSegments2']> | null =
    null;

  const ready = ref(false);
  let needsRender = true;
  let rafId = 0;
  let loadGeneration = 0;
  let cameraMoving = false;

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

  // ─── Raycast (throttled to 1 per animation frame) ──────────────

  let lastPointerEvent: PointerEvent | null = null;
  let raycastPending = false;

  function raycastPart(event: {
    clientX: number;
    clientY: number;
  }): number | null {
    if (!state || !batchedMesh) return null;
    const rect = state.renderer.domElement.getBoundingClientRect();
    state.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    state.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    state.raycaster.setFromCamera(state.mouse, state.camera);
    const hits = state.raycaster.intersectObject(batchedMesh, false);
    if (hits.length === 0) return null;
    // Three.js adds batchId to intersections on BatchedMesh (not in base Intersection type)
    const hit = hits[0] as import('three').Intersection & {
      batchId?: number;
    };
    return hit.batchId != null
      ? (instanceToPartNumber[hit.batchId] ?? null)
      : null;
  }

  function onPointerMove(event: PointerEvent) {
    if (cameraMoving) return;
    lastPointerEvent = event;
    if (!raycastPending) {
      raycastPending = true;
      requestAnimationFrame(() => {
        raycastPending = false;
        if (lastPointerEvent && state) {
          const partNum = raycastPart(lastPointerEvent);
          store.hoveredPartNumber.value = partNum;
          state.renderer.domElement.style.cursor =
            partNum != null ? 'pointer' : '';
        }
      });
    }
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
    renderer.shadowMap.type = THREE.PCFShadowMap;
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
    controls.addEventListener('start', () => {
      cameraMoving = true;
    });
    controls.addEventListener('end', () => {
      cameraMoving = false;
      store.hoveredPartNumber.value = null;
    });

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

    const batchMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.35,
      metalness: 0.05,
      envMapIntensity: 0.3,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });

    const edgeMaterial = new modules.LineMaterial({
      color: 0x1a1a2e,
      linewidth: 2,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
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
      batchMaterial,
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
    const { modules, scene } = state;
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

    // Compute world matrices so we can extract them per-mesh
    gltf.scene.updateMatrixWorld(true);

    const nodeColorMap = new Map<number, string>();
    for (const { nodeIndex, colorHex } of nodePartMap) {
      nodeColorMap.set(nodeIndex, colorHex);
    }

    // ── First pass: collect all meshes + metadata ──

    interface MeshEntry {
      geometry: import('three').BufferGeometry;
      matrixWorld: import('three').Matrix4;
      color: [number, number, number]; // sRGB 0–1
      partNumber: number;
    }

    const meshEntries: MeshEntry[] = [];
    let totalVertices = 0;
    let totalIndices = 0;

    for (const { nodeIndex, partNumber } of nodePartMap) {
      const adjustedPartNumber = partNumber + partNumberOffset;
      let node: Object3D;
      try {
        node = (await gltf.parser.getDependency('node', nodeIndex)) as Object3D;
      } catch (err) {
        if (import.meta.dev) {
          console.warn(
            `[useThreeViewer] Failed to load GLTF node ${nodeIndex}, skipping:`,
            err,
          );
        }
        continue;
      }
      if (!node || gen !== loadGeneration || !state) continue;

      const colorHex = nodeColorMap.get(nodeIndex) ?? '#808080';
      const hexVal = parseInt(colorHex.slice(1), 16);
      const sr = ((hexVal >> 16) & 0xff) / 255;
      const sg = ((hexVal >> 8) & 0xff) / 255;
      const sb = (hexVal & 0xff) / 255;

      node.traverse((child) => {
        if (!(child as Mesh).isMesh) return;
        const mesh = child as Mesh;

        totalVertices += mesh.geometry.attributes.position.count;
        totalIndices += mesh.geometry.index ? mesh.geometry.index.count : 0;

        meshEntries.push({
          geometry: mesh.geometry,
          matrixWorld: mesh.matrixWorld.clone(),
          color: [sr, sg, sb],
          partNumber: adjustedPartNumber,
        });
      });
    }

    if (meshEntries.length === 0 || gen !== loadGeneration || !state) return;

    // ── Create BatchedMesh (single draw call for all parts) ──

    const batch = new THREE.BatchedMesh(
      meshEntries.length,
      totalVertices,
      totalIndices > 0 ? totalIndices : undefined,
      state.batchMaterial,
    );
    batch.castShadow = true;
    batch.receiveShadow = true;
    batch.sortObjects = false; // no sorting needed when fully opaque

    const color = new THREE.Color();
    const vec4 = new THREE.Vector4();
    const bounds = new THREE.Box3();
    const meshBox = new THREE.Box3();

    for (const entry of meshEntries) {
      const geometryId = batch.addGeometry(entry.geometry);
      const instanceId = batch.addInstance(geometryId);
      batch.setMatrixAt(instanceId, entry.matrixWorld);

      // Per-instance color (sRGB → linear via Color)
      color.setRGB(
        entry.color[0],
        entry.color[1],
        entry.color[2],
        THREE.SRGBColorSpace,
      );
      vec4.set(color.r, color.g, color.b, 1.0);
      batch.setColorAt(instanceId, vec4);

      // Track batchId → partNumber mappings
      instanceToPartNumber[instanceId] = entry.partNumber;
      const existing = partNumberToInstances.get(entry.partNumber) ?? [];
      existing.push(instanceId);
      partNumberToInstances.set(entry.partNumber, existing);
      originalColors.set(instanceId, [color.r, color.g, color.b, 1.0]);

      // Accumulate scene bounds
      entry.geometry.computeBoundingBox();
      if (entry.geometry.boundingBox) {
        meshBox
          .copy(entry.geometry.boundingBox)
          .applyMatrix4(entry.matrixWorld);
        bounds.union(meshBox);
      }
    }

    sceneBounds = bounds;
    batchedMesh = batch;
    scene.add(batch);

    fitCamera();
    requestRender();

    // Start async edge computation (non-blocking — model renders immediately)
    computeEdgesAsync(meshEntries, gen);

    // Free GPU memory for original GLTF geometries/materials
    // (CPU-side arrays persist for async edge computation)
    gltf.scene.traverse((child) => {
      const m = child as Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) mat?.dispose();
    });
  }

  // ─── Async edge computation ─────────────────────────────────────

  async function computeEdgesAsync(
    entries: {
      geometry: import('three').BufferGeometry;
      matrixWorld: import('three').Matrix4;
    }[],
    gen: number,
  ) {
    if (!state) return;
    const { THREE } = state.modules;

    const allPositions: number[] = [];
    const v = new THREE.Vector3();
    const CHUNK = 50; // meshes per yield

    for (let i = 0; i < entries.length; i += CHUNK) {
      if (gen !== loadGeneration || !state) return;

      const end = Math.min(i + CHUNK, entries.length);
      for (let j = i; j < end; j++) {
        const { geometry, matrixWorld } = entries[j];
        const edges = new THREE.EdgesGeometry(geometry, 15);
        const pos = edges.attributes.position.array as Float32Array;
        for (let k = 0; k < pos.length; k += 3) {
          v.set(pos[k], pos[k + 1], pos[k + 2]).applyMatrix4(matrixWorld);
          allPositions.push(v.x, v.y, v.z);
        }
        edges.dispose();
      }

      // Yield to main thread between chunks
      await new Promise((r) => setTimeout(r, 0));
    }

    if (gen !== loadGeneration || !state || allPositions.length === 0) return;

    const lsg = new state.modules.LineSegmentsGeometry();
    lsg.setPositions(new Float32Array(allPositions));
    const lines = new state.modules.LineSegments2(lsg, state.edgeMaterial);
    lines.computeLineDistances();
    lines.raycast = () => {};
    lines.castShadow = false;

    lines.renderOrder = 1; // always render after batch mesh
    mergedEdgeLines = lines;
    state.scene.add(lines);
    requestRender();
  }

  // ─── Camera ─────────────────────────────────────────────────────

  function fitCamera() {
    if (!state || !sceneBounds || sceneBounds.isEmpty()) return;
    const {
      modules: { THREE },
      scene,
      camera,
      controls,
      shadowLight,
    } = state;

    const box = sceneBounds;
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
          uGridSize: { value: 0.1 },
          uLineWidth: { value: 0.004 },
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

    // Fixed 100mm grid cells (GLTF uses meters, so 0.1 = 100mm)
    const floorMat = state.floorMesh.material as import('three').ShaderMaterial;
    if (floorMat.uniforms) {
      floorMat.uniforms.uGridSize.value = 0.1;
      floorMat.uniforms.uLineWidth.value = 0.004;
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
    if (!state || !batchedMesh) return;
    const { THREE } = state.modules;
    const vec4 = new THREE.Vector4();

    if (partNumber == null) {
      // Restore all to original — fully opaque
      state.batchMaterial.transparent = false;
      state.batchMaterial.needsUpdate = true; // recompile shader with OPAQUE define
      batchedMesh.sortObjects = false;
      for (const [id, rgba] of originalColors) {
        vec4.set(rgba[0], rgba[1], rgba[2], 1.0);
        batchedMesh.setColorAt(id, vec4);
      }
    } else {
      // Ghost non-target parts via per-instance alpha
      state.batchMaterial.transparent = true;
      state.batchMaterial.needsUpdate = true; // recompile shader without OPAQUE define
      batchedMesh.sortObjects = true;

      const targetInstances = new Set(
        partNumberToInstances.get(partNumber) ?? [],
      );
      const highlightColor = new THREE.Color(HIGHLIGHT_COLOR);

      for (const [id, rgba] of originalColors) {
        if (targetInstances.has(id)) {
          vec4.set(highlightColor.r, highlightColor.g, highlightColor.b, 1.0);
        } else {
          vec4.set(rgba[0], rgba[1], rgba[2], GHOST_OPACITY);
        }
        batchedMesh.setColorAt(id, vec4);
      }
    }

    requestRender();
  }

  // ─── Cleanup ────────────────────────────────────────────────────

  function clearModels() {
    if (!state) return;
    loadGeneration++; // cancels async edge computation + in-progress loads

    if (mergedEdgeLines) {
      mergedEdgeLines.geometry.dispose();
      state.scene.remove(mergedEdgeLines);
      mergedEdgeLines = null;
    }

    if (batchedMesh) {
      batchedMesh.geometry.dispose();
      state.scene.remove(batchedMesh);
      batchedMesh = null;
    }

    instanceToPartNumber.length = 0;
    partNumberToInstances.clear();
    originalColors.clear();
    sceneBounds = null;

    requestRender();
  }

  function dispose() {
    if (!state) return;
    cancelAnimationFrame(rafId);
    clearModels();

    state.renderer.domElement.removeEventListener('pointermove', onPointerMove);
    state.renderer.domElement.removeEventListener('click', onClick);

    // Dispose floor mesh geometry + materials (grid shader + shadow child)
    if (state.floorMesh) {
      state.floorMesh.geometry.dispose();
      (state.floorMesh.material as import('three').Material).dispose();
      // Shadow plane is a child of floor mesh
      state.floorMesh.traverse((child) => {
        const m = child as import('three').Mesh;
        if (m !== state!.floorMesh && m.isMesh) {
          m.geometry.dispose();
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          for (const mat of mats) mat?.dispose();
        }
      });
      state.scene.remove(state.floorMesh);
      state.floorMesh = null;
    }

    // Dispose environment map texture (GPU memory)
    if (state.scene.environment) {
      state.scene.environment.dispose();
      state.scene.environment = null;
    }

    // Dispose edge material (shared across all edge lines)
    state.edgeMaterial.dispose();

    state.renderer.dispose();
    state.renderer.domElement.remove();
    state.controls.dispose();
    state.resizeObserver.disconnect();
    state.batchMaterial.dispose();

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
