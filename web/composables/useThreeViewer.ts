import type { NodePartMapping } from '~/utils/parseGltf';

interface ThreeModules {
  THREE: typeof import('three');
  GLTFLoader: typeof import('three/addons/loaders/GLTFLoader.js').GLTFLoader;
  OrbitControls: typeof import('three/addons/controls/OrbitControls.js').OrbitControls;
  LineSegmentsGeometry: typeof import('three/addons/lines/LineSegmentsGeometry.js').LineSegmentsGeometry;
  LineSegments2: typeof import('three/addons/lines/LineSegments2.js').LineSegments2;
  LineMaterial: typeof import('three/addons/lines/LineMaterial.js').LineMaterial;
}

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
  ] = await Promise.all([
    import('three'),
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/controls/OrbitControls.js'),
    import('three/addons/lines/LineSegmentsGeometry.js'),
    import('three/addons/lines/LineSegments2.js'),
    import('three/addons/lines/LineMaterial.js'),
  ]);
  _modules = {
    THREE,
    GLTFLoader,
    OrbitControls,
    LineSegmentsGeometry,
    LineSegments2,
    LineMaterial,
  };
  return _modules;
}

const HIGHLIGHT_COLOR = 0x6ee7b7; // teal-300
const GHOST_OPACITY = 0.15;

export default function useThreeViewer(
  container: Ref<HTMLElement | undefined>,
) {
  const store = useModelViewerStore();

  // Three.js state (set after init)
  let renderer: import('three').WebGLRenderer | null = null;
  let camera: import('three').PerspectiveCamera | null = null;
  let scene: import('three').Scene | null = null;
  let controls: InstanceType<ThreeModules['OrbitControls']> | null = null;
  let raycaster: import('three').Raycaster | null = null;
  let mouse: import('three').Vector2 | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let THREE: ThreeModules['THREE'] | null = null;

  // Part tracking
  const partMeshes = new Map<number, import('three').Mesh[]>();
  const meshToPart = new Map<import('three').Mesh, number>();
  const originalMaterials = new Map<
    import('three').Mesh,
    import('three').Material | import('three').Material[]
  >();
  const edgeLines = new Map<import('three').Mesh, import('three').Object3D>(); // source → edge lines
  let highlightMaterial: import('three').MeshStandardMaterial | null = null;
  let edgeMaterial: InstanceType<ThreeModules['LineMaterial']> | null = null;
  let ghostMaterials = new WeakMap<
    import('three').Material,
    import('three').Material
  >();
  let floorMesh: import('three').Mesh | null = null;
  let shadowLight: import('three').DirectionalLight | null = null;

  const ready = ref(false);
  let needsRender = true;
  let disposed = false;
  let loadGeneration = 0;

  function requestRender() {
    needsRender = true;
  }

  function animationLoop() {
    if (disposed) return;
    requestAnimationFrame(animationLoop);
    if (controls?.enableDamping) controls.update();
    if (needsRender && renderer && scene && camera) {
      renderer.render(scene, camera);
      needsRender = false;
    }
  }

  async function init(el: HTMLElement) {
    const modules = await loadThree();
    THREE = modules.THREE;

    scene = new THREE.Scene();

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const rect = el.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height);
    el.appendChild(renderer.domElement);

    camera = new THREE.PerspectiveCamera(
      50,
      rect.width / rect.height,
      0.001,
      1000,
    );
    camera.position.set(2, 1.5, 2);

    controls = new modules.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.addEventListener('change', requestRender);

    // NoToneMapping = faithful sRGB output.
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);
    shadowLight = new THREE.DirectionalLight(0xffffff, 1.0);
    shadowLight.castShadow = true;
    shadowLight.shadow.mapSize.width = 2048;
    shadowLight.shadow.mapSize.height = 2048;
    shadowLight.shadow.radius = 4;
    shadowLight.shadow.bias = -0.0005;
    scene.add(shadowLight);
    scene.add(shadowLight.target);
    // Soft fill from lower-left — lifts shadow faces without killing contrast
    const fill = new THREE.DirectionalLight(0xffffff, 0.25);
    fill.position.set(-2, 4, -2);
    scene.add(fill);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    highlightMaterial = new THREE.MeshStandardMaterial({
      color: HIGHLIGHT_COLOR,
      emissive: HIGHLIGHT_COLOR,
      emissiveIntensity: 0.3,
      roughness: 0.4,
      metalness: 0.1,
    });

    edgeMaterial = new modules.LineMaterial({
      color: 0x000000,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.4,
      resolution: new THREE.Vector2(rect.width, rect.height),
    });

    // Events
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('click', onClick);

    resizeObserver = new ResizeObserver(() => {
      if (!renderer || !camera) return;
      const r = el.getBoundingClientRect();
      renderer.setSize(r.width, r.height);
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
      if (edgeMaterial) edgeMaterial.resolution.set(r.width, r.height);
      requestRender();
    });
    resizeObserver.observe(el);

    ready.value = true;
    animationLoop();
  }

  function raycastPart(event: {
    clientX: number;
    clientY: number;
  }): number | null {
    if (!raycaster || !camera || !mouse || !renderer) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObjects([...meshToPart.keys()], false)[0];
    return hit
      ? meshToPart.get(hit.object as import('three').Mesh) ?? null
      : null;
  }

  function onPointerMove(event: PointerEvent) {
    const partNum = raycastPart(event);
    store.hoveredPartNumber.value = partNum;
    if (renderer)
      renderer.domElement.style.cursor = partNum != null ? 'pointer' : '';
  }

  function onClick(event: MouseEvent) {
    const partNum = raycastPart(event);
    store.selectedPartNumber.value =
      store.selectedPartNumber.value === partNum ? null : partNum;
  }

  function loadModel(
    gltfJson: object,
    nodePartMap: NodePartMapping[],
    partNumberOffset: number = 0,
  ) {
    if (!THREE || !scene) return;

    const gen = ++loadGeneration;
    const loader = new _modules!.GLTFLoader();
    const blob = new Blob([JSON.stringify(gltfJson)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);

    loader.load(
      url,
      async (gltf) => {
        URL.revokeObjectURL(url);
        if (!scene || !THREE || gen !== loadGeneration) return;
        const T = THREE; // local alias — TS loses narrowing inside traverse callbacks

        const nodeColorMap = new Map<number, string>();
        for (const { nodeIndex, colorHex } of nodePartMap) {
          nodeColorMap.set(nodeIndex, colorHex);
        }

        for (const { nodeIndex, partNumber } of nodePartMap) {
          const adjustedPartNumber = partNumber + partNumberOffset;
          try {
            const node = (await gltf.parser.getDependency(
              'node',
              nodeIndex,
            )) as import('three').Object3D;
            if (!node) continue;

            // The node might be a Mesh directly, or a Group containing child Meshes
            node.traverse((child) => {
              if (!(child as import('three').Mesh).isMesh) return;
              const mesh = child as import('three').Mesh;

              const existing = partMeshes.get(adjustedPartNumber) ?? [];
              existing.push(mesh);
              partMeshes.set(adjustedPartNumber, existing);
              meshToPart.set(mesh, adjustedPartNumber);
              originalMaterials.set(mesh, mesh.material);
              mesh.castShadow = true;
              mesh.receiveShadow = true;

              // Apply the normalized color resolved at import time.
              // Must use setRGB with SRGBColorSpace so Three.js converts sRGB→linear
              // internally; Color.set(hex) skips that conversion → washed-out output.
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
                  const std = m as import('three').MeshStandardMaterial;
                  if (!std.isMeshStandardMaterial) continue;
                  std.color.setRGB(sr, sg, sb, T.SRGBColorSpace);
                  std.roughness = 0.35;
                  std.metalness = 0.0;
                }
              }

              // Edge lines: EdgesGeometry extracts sharp edges like CAD software
              // Uses Line2 addons for GPU-based line width (WebGL LineBasicMaterial is always 1px)
              // Must NOT be a child of mesh — Box3.expandByObject traverses children and
              // LineSegments2.updateWorldMatrix causes infinite recursion.
              if (edgeMaterial && THREE && _modules && mesh.parent) {
                const threeEdges = new THREE.EdgesGeometry(mesh.geometry, 15);
                const positions = threeEdges.attributes.position
                  .array as Float32Array;
                const lsg = new _modules.LineSegmentsGeometry();
                lsg.setPositions(positions);
                const lines = new _modules.LineSegments2(lsg, edgeMaterial);
                lines.computeLineDistances();
                lines.raycast = () => {};
                // Copy transform so lines align with mesh, add as sibling
                lines.position.copy(mesh.position);
                lines.rotation.copy(mesh.rotation);
                lines.scale.copy(mesh.scale);
                mesh.parent.add(lines);
                edgeLines.set(mesh, lines);
              }
            });
          } catch {
            // Node index not found in this GLTF — skip
          }
        }

        scene.add(gltf.scene);
        fitCamera();
        requestRender();
      },
      undefined,
      () => URL.revokeObjectURL(url),
    );
  }

  function fitCamera() {
    if (!THREE || !scene || !camera || !controls) return;
    // Compute bounding box from tracked meshes only (skip edge lines)
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

    // Floor — radial gradient spotlight glow + shadow layer on top
    const floorY = box.min.y - maxDim * 0.001;
    const floorSize = maxDim * 5;
    if (!floorMesh) {
      // Gradient spotlight texture painted on a canvas
      const texSize = 512;
      const canvas = document.createElement('canvas');
      canvas.width = texSize;
      canvas.height = texSize;
      const ctx = canvas.getContext('2d')!;
      const grad = ctx.createRadialGradient(
        texSize / 2,
        texSize / 2,
        0,
        texSize / 2,
        texSize / 2,
        texSize / 2,
      );
      grad.addColorStop(0, 'rgba(200, 210, 225, 0.20)');
      grad.addColorStop(0.3, 'rgba(150, 165, 185, 0.10)');
      grad.addColorStop(0.7, 'rgba(80,  95,  115, 0.03)');
      grad.addColorStop(1, 'rgba(0,   0,   0,   0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, texSize, texSize);
      const texture = new THREE.CanvasTexture(canvas);

      // Glow plane (behind)
      const geo = new THREE.PlaneGeometry(1, 1);
      const mat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      });
      floorMesh = new THREE.Mesh(geo, mat);
      floorMesh.rotation.x = -Math.PI / 2;
      scene!.add(floorMesh);

      // Shadow plane (in front, very thin ShadowMaterial overlay)
      const shadowGeo = new THREE.PlaneGeometry(1, 1);
      const shadowMat = new THREE.ShadowMaterial({ opacity: 0.45 });
      const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
      shadowPlane.receiveShadow = true;
      shadowPlane.renderOrder = 1;
      floorMesh.add(shadowPlane); // child — inherits position/scale
    }
    floorMesh.position.set(center.x, floorY, center.z);
    floorMesh.scale.set(floorSize, floorSize, 1);

    // Size + position shadow camera to fit model
    if (shadowLight) {
      const pad = maxDim * 1.2;
      shadowLight.position.set(
        center.x + maxDim * 1.5,
        center.y + maxDim * 3,
        center.z + maxDim * 1.5,
      );
      shadowLight.target.position.copy(center);
      shadowLight.target.updateWorldMatrix(false, false);
      const sc = shadowLight.shadow
        .camera as import('three').OrthographicCamera;
      sc.left = -pad;
      sc.right = pad;
      sc.top = pad;
      sc.bottom = -pad;
      sc.near = maxDim * 0.1;
      sc.far = maxDim * 8;
      sc.updateProjectionMatrix();
    }

    controls.update();
    requestRender();
  }

  function highlightPart(partNumber: number | null) {
    if (!THREE) return;

    // Restore all originals first
    for (const [mesh, original] of originalMaterials) {
      mesh.material = original;
      const lines = edgeLines.get(mesh);
      if (lines) lines.visible = true;
    }

    if (partNumber == null) {
      requestRender();
      return;
    }

    const targetMeshes = partMeshes.get(partNumber);
    if (!targetMeshes) {
      requestRender();
      return;
    }

    const targetSet = new Set(targetMeshes);
    for (const [mesh, original] of originalMaterials) {
      if (targetSet.has(mesh)) {
        mesh.material = highlightMaterial!;
      } else {
        mesh.material = getGhostMaterial(original);
        const lines = edgeLines.get(mesh);
        if (lines) lines.visible = false;
      }
    }

    requestRender();
  }

  function getGhostMaterial(
    original: import('three').Material | import('three').Material[],
  ): import('three').Material | import('three').Material[] {
    if (!THREE) return original;

    if (Array.isArray(original)) {
      return original.map(
        (m) => getGhostMaterial(m) as import('three').Material,
      );
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

  function disposeSceneGraph(obj: import('three').Object3D) {
    obj.traverse((child) => {
      const mesh = child as import('three').Mesh;
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
    if (!scene) return;
    loadGeneration++;

    for (const lines of edgeLines.values()) {
      (lines as import('three').LineSegments).geometry?.dispose();
      lines.removeFromParent();
    }
    edgeLines.clear();

    // Remove model scene graphs (keep lights and floor)
    for (const child of [...scene.children]) {
      if ((child as import('three').Light).isLight) continue;
      if (child === floorMesh) continue;
      disposeSceneGraph(child);
      scene.remove(child);
    }

    partMeshes.clear();
    meshToPart.clear();
    originalMaterials.clear();
    ghostMaterials = new WeakMap();
    requestRender();
  }

  function dispose() {
    disposed = true;
    clearModels();

    if (renderer) {
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.dispose();
      renderer.domElement.remove();
    }
    if (controls) controls.dispose();
    if (resizeObserver) resizeObserver.disconnect();

    renderer = null;
    camera = null;
    scene = null;
    controls = null;
    floorMesh = null;
    shadowLight = null;
    ready.value = false;
  }

  // Watch for highlight changes
  watch(
    () => store.hoveredPartNumber.value ?? store.selectedPartNumber.value,
    (partNumber) => highlightPart(partNumber),
  );

  // Initialize when container is available
  watch(
    container,
    async (el) => {
      if (el && !renderer) {
        await init(el);
      }
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
