import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  CHEMICAL_CATALOG,
  CPK_COLORS,
  type ChemicalSubstance,
  type LabReactionPreset,
} from '../data/chemicalsAndReactions';
import {
  buildReactionMechanism,
  evaluateMechanismAtomPos,
  evaluateMechanismBonds,
  getMechanismStageLabel,
  type ReactionMechanismSpec,
} from '../utils/molecularMechanism';
import {
  Atom,
  Beaker,
  ChevronDown,
  ChevronUp,
  GitMerge,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Tag,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

export type ViewportMode = 'lab' | 'molecule' | 'mechanism';
type CameraPreset = 'overview' | 'closeup' | 'top';

export interface Lab3DViewportProps {
  mode: ViewportMode;
  substanceA: ChemicalSubstance;
  substanceB: ChemicalSubstance;
  activeReaction: LabReactionPreset | null;
  isReacted: boolean;
  reactionTriggerSeq: number;
  selectedMoleculeId: string;
  heated: boolean;
  onModeChange?: (mode: ViewportMode) => void;
  onTriggerReaction?: () => void;
  onResetLab?: () => void;
}

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3Mid = new THREE.Vector3();
const _vec3Dir = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _perpRef = new THREE.Vector3(0, 0, 1);
const _ortho = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _colorA = new THREE.Color();
const _colorB = new THREE.Color();
const _dummy = new THREE.Object3D();

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createLabBenchTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 512; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

function createGraduationTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.72)';
  ctx.fillStyle = 'rgba(248, 250, 252, 0.82)';
  ctx.font = '600 14px monospace';
  const marks = [
    { y: 210, label: '50 mL' },
    { y: 165, label: '100' },
    { y: 120, label: '150' },
    { y: 75, label: '200' },
  ];
  marks.forEach((m) => {
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(95, m.y);
    ctx.lineTo(135, m.y);
    ctx.stroke();
    ctx.fillText(m.label, 142, m.y + 5);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createAtomLabelTexture(label: string, accentHex: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 64);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(18, 14, 92, 36, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 64, 32);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildFlaskGeometry(): THREE.LatheGeometry {
  const points = [
    new THREE.Vector2(0.01, 0.0),
    new THREE.Vector2(1.05, 0.0),
    new THREE.Vector2(1.12, 0.18),
    new THREE.Vector2(0.88, 1.35),
    new THREE.Vector2(0.42, 1.95),
    new THREE.Vector2(0.42, 2.55),
    new THREE.Vector2(0.5, 2.68),
  ];
  return new THREE.LatheGeometry(points, 32);
}

function buildBeakerGeometry(): THREE.LatheGeometry {
  const points = [
    new THREE.Vector2(0.01, 0.0),
    new THREE.Vector2(0.65, 0.0),
    new THREE.Vector2(0.68, 0.12),
    new THREE.Vector2(0.68, 1.45),
    new THREE.Vector2(0.75, 1.54),
  ];
  return new THREE.LatheGeometry(points, 28);
}

function buildMoleculeGroup(substance: ChemicalSubstance): THREE.Group {
  const group = new THREE.Group();
  const sphereGeo = new THREE.SphereGeometry(1, 24, 18);
  const bondGeo = new THREE.CylinderGeometry(0.075, 0.075, 1, 12);

  substance.atoms3D.forEach((atom) => {
    const spec = CPK_COLORS[atom.element] ?? { color: '#64748B', radius: 0.36 };
    const mat = new THREE.MeshPhysicalMaterial({
      color: spec.color,
      roughness: 0.22,
      metalness: atom.element === 'Cu' || atom.element === 'Fe' || atom.element === 'Ag' ? 0.65 : 0.1,
      clearcoat: 0.6,
      clearcoatRoughness: 0.15,
    });
    const mesh = new THREE.Mesh(sphereGeo, mat);
    mesh.scale.setScalar(spec.radius);
    mesh.position.set(atom.x, atom.y, atom.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });

  const bondMat = new THREE.MeshStandardMaterial({
    color: '#CBD5E1',
    roughness: 0.35,
    metalness: 0.4,
  });

  substance.bonds3D.forEach((bond) => {
    const a = substance.atoms3D[bond.from];
    const b = substance.atoms3D[bond.to];
    if (!a || !b) return;
    _vec3A.set(a.x, a.y, a.z);
    _vec3B.set(b.x, b.y, b.z);
    const dist = _vec3A.distanceTo(_vec3B);
    if (dist < 0.01) return;

    const mid = _vec3A.clone().add(_vec3B).multiplyScalar(0.5);
    const dir = _vec3B.clone().sub(_vec3A).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

    const offsets = bond.order === 1 ? [0] : bond.order === 2 ? [-0.085, 0.085] : [-0.12, 0, 0.12];
    const perp = new THREE.Vector3(0, 0, 1);
    if (Math.abs(dir.dot(perp)) > 0.9) perp.set(1, 0, 0);
    const ortho = new THREE.Vector3().crossVectors(dir, perp).normalize();

    offsets.forEach((offset) => {
      const cyl = new THREE.Mesh(bondGeo, bondMat);
      cyl.position.copy(mid).addScaledVector(ortho, offset);
      cyl.quaternion.copy(quat);
      cyl.scale.set(bond.order > 1 ? 0.68 : 1, dist, bond.order > 1 ? 0.68 : 1);
      group.add(cyl);
    });
  });

  return group;
}

interface MechanismRig {
  group: THREE.Group;
  atomMeshes: THREE.Mesh[];
  atomSprites: THREE.Sprite[];
  bondEntries: {
    bondIndex: number;
    cylinders: THREE.Mesh[];
    material: THREE.MeshStandardMaterial;
    order: 1 | 2 | 3;
  }[];
  breakingHalo: THREE.Mesh;
  formingHalo: THREE.Mesh;
}

export const Lab3DViewport: React.FC<Lab3DViewportProps> = ({
  mode,
  substanceA,
  substanceB,
  activeReaction,
  isReacted,
  reactionTriggerSeq,
  selectedMoleculeId,
  heated,
  onModeChange,
  onTriggerReaction,
  onResetLab,
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview');
  const [webglError, setWebglError] = useState<string | null>(null);

  // Mechanism playback UI state (synced at throttled rate from ref)
  const [mechPlaying, setMechPlaying] = useState(true);
  const [mechSpeed, setMechSpeed] = useState<0.5 | 1 | 1.5>(1);
  const [mechProgressUi, setMechProgressUi] = useState(0);
  const [showAtomLabels, setShowAtomLabels] = useState(true);

  const mechanismSpec: ReactionMechanismSpec = useMemo(
    () => buildReactionMechanism(activeReaction, substanceA, substanceB),
    [activeReaction, substanceA, substanceB],
  );

  const mechProgressRef = useRef(0);
  const lastUiSyncRef = useRef(0);

  const propsRef = useRef({
    mode,
    substanceA,
    substanceB,
    activeReaction,
    isReacted,
    reactionTriggerSeq,
    selectedMoleculeId,
    heated,
    autoRotate,
    cameraPreset,
    mechanismSpec,
    mechPlaying,
    mechSpeed,
    showAtomLabels,
  });
  propsRef.current = {
    mode,
    substanceA,
    substanceB,
    activeReaction,
    isReacted,
    reactionTriggerSeq,
    selectedMoleculeId,
    heated,
    autoRotate,
    cameraPreset,
    mechanismSpec,
    mechPlaying,
    mechSpeed,
    showAtomLabels,
  };

  const sceneActionsRef = useRef<{
    rebuildSceneState: () => void;
    applyCameraPreset: (preset: CameraPreset) => void;
    zoomBy: (factor: number) => void;
    requestRender: () => void;
  } | null>(null);

  useEffect(() => {
    if (!isExpanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsExpanded(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isExpanded]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('Trình duyệt không hỗ trợ WebGL để hiển thị mô hình 3D.');
      return;
    }

    const width = container.clientWidth || 720;
    const height = container.clientHeight || 480;
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('Ngữ cảnh đồ họa 3D tạm thời bị gián đoạn.');
    };
    const handleContextRestored = () => {
      setWebglError(null);
      requestRender();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0B1120');
    scene.fog = new THREE.Fog('#0B1120', 16, 38);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 80);
    camera.position.set(0, 3.8, 7.6);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 1.35, 0);
    controls.minDistance = 2.0;
    controls.maxDistance = 26;
    controls.maxPolarAngle = Math.PI * 0.54;

    // 3-Point Warm/Cool Lighting Rig
    const hemiLight = new THREE.HemisphereLight('#DBEAFE', '#1E293B', 0.8);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#FFF7ED', 2.0);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -6;
    keyLight.shadow.camera.right = 6;
    keyLight.shadow.camera.top = 6;
    keyLight.shadow.camera.bottom = -6;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#60A5FA', 0.95);
    rimLight.position.set(-5, 4, -5);
    scene.add(rimLight);

    // Lab Bench Group
    const labGroup = new THREE.Group();
    scene.add(labGroup);

    const benchTex = createLabBenchTexture();
    benchTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const benchMat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      map: benchTex,
      roughness: 0.72,
      metalness: 0.12,
    });
    const benchGeo = new THREE.CylinderGeometry(8.5, 8.5, 0.25, 48);
    const benchMesh = new THREE.Mesh(benchGeo, benchMat);
    benchMesh.position.y = -0.125;
    benchMesh.receiveShadow = true;
    labGroup.add(benchMesh);

    const shadowMat = new THREE.MeshBasicMaterial({
      color: '#020617',
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const centerShadow = new THREE.Mesh(new THREE.CircleGeometry(1.3, 32), shadowMat);
    centerShadow.rotation.x = -Math.PI / 2;
    centerShadow.position.y = 0.015;
    labGroup.add(centerShadow);

    const leftShadow = new THREE.Mesh(new THREE.CircleGeometry(0.82, 24), shadowMat);
    leftShadow.rotation.x = -Math.PI / 2;
    leftShadow.position.set(-2.55, 0.015, 0.2);
    labGroup.add(leftShadow);

    const rightShadow = new THREE.Mesh(new THREE.CircleGeometry(0.82, 24), shadowMat);
    rightShadow.rotation.x = -Math.PI / 2;
    rightShadow.position.set(2.55, 0.015, 0.2);
    labGroup.add(rightShadow);

    // Composite Metallic Retort Stand
    const standGroup = new THREE.Group();
    const standDarkMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.65, metalness: 0.55 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: '#CBD5E1', roughness: 0.2, metalness: 0.9 });

    const standBase = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.1, 1.3), standDarkMat);
    standBase.position.set(-1.18, 0.05, -1.05);
    standBase.castShadow = true;
    standGroup.add(standBase);

    const standRod = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.8, 16), chromeMat);
    standRod.position.set(-1.45, 1.9, -1.35);
    standRod.castShadow = true;
    standGroup.add(standRod);

    const bosshead = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), standDarkMat);
    bosshead.position.set(-1.45, 2.25, -1.35);
    standGroup.add(bosshead);

    const armLength = Math.hypot(1.45, 1.35) - 0.42;
    const clampArm = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, armLength, 12), chromeMat);
    clampArm.position.set(-0.88, 2.25, -0.82);
    clampArm.rotation.z = Math.PI / 2;
    clampArm.rotation.y = -Math.atan2(1.35, 1.45);
    standGroup.add(clampArm);

    const clampRing = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.035, 12, 28), standDarkMat);
    clampRing.rotation.x = Math.PI / 2;
    clampRing.position.set(0, 2.25, 0);
    standGroup.add(clampRing);
    labGroup.add(standGroup);

    // Bunsen Burner
    const burnerGroup = new THREE.Group();
    const burnerBase = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.12, 24), standDarkMat);
    burnerBase.position.y = 0.06;
    burnerGroup.add(burnerBase);
    const burnerNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.3, 16), chromeMat);
    burnerNozzle.position.y = 0.24;
    burnerGroup.add(burnerNozzle);
    const flameMat = new THREE.MeshBasicMaterial({
      color: '#38BDF8',
      transparent: true,
      opacity: 0.85,
    });
    const flameCone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.48, 16), flameMat);
    flameCone.position.y = 0.56;
    burnerGroup.add(flameCone);
    burnerGroup.visible = false;
    labGroup.add(burnerGroup);

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: '#BAE6FD',
      roughness: 0.08,
      metalness: 0.04,
      transmission: isSoftwareGl ? 0 : 0.9,
      transparent: true,
      opacity: isSoftwareGl ? 0.2 : 0.88,
      ior: 1.5,
      thickness: 0.2,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const flaskGroup = new THREE.Group();
    const flaskGeo = buildFlaskGeometry();
    const flaskMesh = new THREE.Mesh(flaskGeo, glassMat);
    flaskMesh.renderOrder = 3;
    flaskGroup.add(flaskMesh);

    const gradTex = createGraduationTexture();
    gradTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const gradDecal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 1.02, 1.1, 24, 1, true, -0.55, 1.1),
      new THREE.MeshBasicMaterial({ map: gradTex, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    );
    gradDecal.position.y = 0.72;
    gradDecal.renderOrder = 4;
    flaskGroup.add(gradDecal);

    const centralLiquidMat = new THREE.MeshPhysicalMaterial({
      color: '#0284C7',
      emissive: '#0284C7',
      emissiveIntensity: 0.28,
      roughness: 0.12,
      metalness: 0.02,
      transparent: true,
      opacity: 0.88,
    });
    const centralLiquidGeo = new THREE.CylinderGeometry(0.76, 1.02, 1.0, 28);
    const centralLiquidMesh = new THREE.Mesh(centralLiquidGeo, centralLiquidMat);
    centralLiquidMesh.position.y = 0.54;
    centralLiquidMesh.renderOrder = 1;
    flaskGroup.add(centralLiquidMesh);

    const solidReagentMat = new THREE.MeshStandardMaterial({
      color: '#94A3B8',
      roughness: 0.35,
      metalness: 0.65,
    });
    const solidReagentMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 1), solidReagentMat);
    solidReagentMesh.position.set(0, 0.24, 0);
    solidReagentMesh.visible = false;
    solidReagentMesh.renderOrder = 2;
    flaskGroup.add(solidReagentMesh);

    const precipCount = 64;
    const precipGeo = new THREE.DodecahedronGeometry(0.072, 0);
    const precipMat = new THREE.MeshStandardMaterial({
      color: '#1D4ED8',
      emissive: '#1D4ED8',
      emissiveIntensity: 0.22,
      roughness: 0.6,
    });
    const precipInstanced = new THREE.InstancedMesh(precipGeo, precipMat, precipCount);
    precipInstanced.frustumCulled = false;
    precipInstanced.visible = false;
    precipInstanced.renderOrder = 2;
    const precipSeeds = Array.from({ length: precipCount }, (_, i) => ({
      angle: (i * 2.39996) % (Math.PI * 2),
      radius: 0.1 + ((i * 17) % 100) / 132,
      yStart: 0.42 + ((i * 31) % 100) / 135,
      speed: 0.35 + ((i * 13) % 10) * 0.04,
      scale: 0.8 + ((i * 7) % 10) * 0.055,
    }));
    flaskGroup.add(precipInstanced);

    const bubbleCount = 44;
    const bubbleGeo = new THREE.SphereGeometry(0.046, 10, 8);
    const bubbleMat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      emissive: '#FFFFFF',
      emissiveIntensity: 0.25,
      roughness: 0.1,
      transparent: true,
      opacity: 0.86,
    });
    const bubbleInstanced = new THREE.InstancedMesh(bubbleGeo, bubbleMat, bubbleCount);
    bubbleInstanced.frustumCulled = false;
    bubbleInstanced.visible = false;
    bubbleInstanced.renderOrder = 2;
    const bubbleSeeds = Array.from({ length: bubbleCount }, (_, i) => ({
      x: Math.cos(i * 1.9) * (0.14 + ((i * 19) % 58) / 100),
      z: Math.sin(i * 1.9) * (0.14 + ((i * 23) % 58) / 100),
      phase: (i / bubbleCount) * 2.2,
      speed: 0.72 + ((i * 11) % 10) * 0.08,
    }));
    flaskGroup.add(bubbleInstanced);

    const vaporMat = new THREE.MeshStandardMaterial({
      color: '#B45309',
      emissive: '#B45309',
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const vaporPlume = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.72, 1.45, 20), vaporMat);
    vaporPlume.position.y = 1.95;
    vaporPlume.visible = false;
    vaporPlume.renderOrder = 2;
    flaskGroup.add(vaporPlume);

    labGroup.add(flaskGroup);

    const beakerGeo = buildBeakerGeometry();
    const beakerAMeshGroup = new THREE.Group();
    beakerAMeshGroup.position.set(-2.55, 0, 0.2);
    const beakerAGlass = new THREE.Mesh(beakerGeo, glassMat);
    beakerAGlass.renderOrder = 3;
    const beakerALiquidMat = new THREE.MeshPhysicalMaterial({
      color: '#0284C7',
      emissive: '#0284C7',
      emissiveIntensity: 0.26,
      roughness: 0.14,
      transparent: true,
      opacity: 0.88,
    });
    const beakerALiquid = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.62, 0.88, 24), beakerALiquidMat);
    beakerALiquid.position.y = 0.48;
    beakerALiquid.renderOrder = 1;
    const beakerASolidMat = new THREE.MeshStandardMaterial({ color: '#94A3B8', roughness: 0.35, metalness: 0.65 });
    const beakerASolid = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 1), beakerASolidMat);
    beakerASolid.position.y = 0.32;
    beakerASolid.visible = false;
    beakerAMeshGroup.add(beakerALiquid, beakerASolid, beakerAGlass);
    labGroup.add(beakerAMeshGroup);

    const beakerBMeshGroup = new THREE.Group();
    beakerBMeshGroup.position.set(2.55, 0, 0.2);
    const beakerBGlass = new THREE.Mesh(beakerGeo, glassMat);
    beakerBGlass.renderOrder = 3;
    const beakerBLiquidMat = new THREE.MeshPhysicalMaterial({
      color: '#60A5FA',
      emissive: '#60A5FA',
      emissiveIntensity: 0.22,
      roughness: 0.14,
      transparent: true,
      opacity: 0.72,
    });
    const beakerBLiquid = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.62, 0.88, 24), beakerBLiquidMat);
    beakerBLiquid.position.y = 0.48;
    beakerBLiquid.renderOrder = 1;
    const beakerBSolidMat = new THREE.MeshStandardMaterial({ color: '#94A3B8', roughness: 0.35, metalness: 0.65 });
    const beakerBSolid = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 1), beakerBSolidMat);
    beakerBSolid.position.y = 0.32;
    beakerBSolid.visible = false;
    beakerBMeshGroup.add(beakerBLiquid, beakerBSolid, beakerBGlass);
    labGroup.add(beakerBMeshGroup);

    const pourStreamMatA = new THREE.MeshPhysicalMaterial({
      color: '#0284C7',
      emissive: '#0284C7',
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.88,
    });
    const pourStreamA = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.5, 10), pourStreamMatA);
    pourStreamA.visible = false;
    labGroup.add(pourStreamA);

    const pourStreamMatB = new THREE.MeshPhysicalMaterial({
      color: '#60A5FA',
      emissive: '#60A5FA',
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.78,
    });
    const pourStreamB = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.5, 10), pourStreamMatB);
    pourStreamB.visible = false;
    labGroup.add(pourStreamB);

    // Molecule Showcase Group
    const moleculeStageGroup = new THREE.Group();
    scene.add(moleculeStageGroup);
    let currentMoleculeMesh: THREE.Group | null = null;

    // Molecular Reaction Mechanism Stage Group (bond-breaking & bond-forming)
    const mechanismStageGroup = new THREE.Group();
    scene.add(mechanismStageGroup);

    // Subtle dark pedestal ring under mechanism stage so spatial depth is crystal clear
    const stagePedestalMat = new THREE.MeshStandardMaterial({
      color: '#0F172A',
      roughness: 0.5,
      metalness: 0.4,
    });
    const stagePedestal = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.7, 0.14, 48), stagePedestalMat);
    stagePedestal.position.set(0, -0.35, 0);
    stagePedestal.receiveShadow = true;
    mechanismStageGroup.add(stagePedestal);

    const stageRing = new THREE.Mesh(
      new THREE.TorusGeometry(4.95, 0.025, 12, 64),
      new THREE.MeshBasicMaterial({ color: '#38BDF8', transparent: true, opacity: 0.32 }),
    );
    stageRing.rotation.x = Math.PI / 2;
    stageRing.position.set(0, -0.26, 0);
    mechanismStageGroup.add(stageRing);

    const sharedAtomGeo = new THREE.SphereGeometry(1, 22, 16);
    const sharedBondGeo = new THREE.CylinderGeometry(0.045, 0.045, 1, 12);
    const labelTextureCache = new Map<string, THREE.CanvasTexture>();
    let currentMechRig: MechanismRig | null = null;
    let builtMechReactionId = '';

    const getCachedLabelTex = (text: string, accent: string): THREE.CanvasTexture => {
      const key = `${text}__${accent}`;
      const existing = labelTextureCache.get(key);
      if (existing) return existing;
      const tex = createAtomLabelTexture(text, accent);
      labelTextureCache.set(key, tex);
      return tex;
    };

    const disposeMechanismRig = () => {
      if (!currentMechRig) return;
      mechanismStageGroup.remove(currentMechRig.group);
      currentMechRig.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry !== sharedAtomGeo && obj.geometry !== sharedBondGeo) {
            obj.geometry.dispose();
          }
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        } else if (obj instanceof THREE.Sprite) {
          obj.material.dispose();
        }
      });
      currentMechRig = null;
      builtMechReactionId = '';
    };

    const buildMechanismRig = (spec: ReactionMechanismSpec) => {
      disposeMechanismRig();
      const rigGroup = new THREE.Group();
      rigGroup.position.set(0, 2.75, 0);

      const atomMeshes: THREE.Mesh[] = [];
      const atomSprites: THREE.Sprite[] = [];

      spec.atoms.forEach((atom) => {
        const cpk = CPK_COLORS[atom.element] ?? { color: '#64748B', radius: 0.36 };
        const mat = new THREE.MeshPhysicalMaterial({
          color: cpk.color,
          roughness: 0.2,
          metalness:
            atom.element === 'Cu' || atom.element === 'Fe' || atom.element === 'Ag' || atom.element === 'Zn'
              ? 0.55
              : 0.1,
          clearcoat: 0.65,
          clearcoatRoughness: 0.15,
        });
        const mesh = new THREE.Mesh(sharedAtomGeo, mat);
        const r = cpk.radius * 0.62;
        mesh.scale.setScalar(r);
        mesh.position.set(...atom.startPos);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        rigGroup.add(mesh);
        atomMeshes.push(mesh);

        const labelText = atom.label ?? atom.element;
        const spriteMat = new THREE.SpriteMaterial({
          map: getCachedLabelTex(labelText, cpk.color),
          transparent: true,
          depthWrite: false,
          depthTest: false,
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(0.4, 0.2, 1);
        sprite.position.set(atom.startPos[0], atom.startPos[1] + r + 0.2, atom.startPos[2]);
        sprite.renderOrder = 10;
        rigGroup.add(sprite);
        atomSprites.push(sprite);
      });

      const allBonds = [...spec.oldBonds, ...spec.newBonds];
      const bondEntries: MechanismRig['bondEntries'] = [];
      allBonds.forEach((bond, idx) => {
        const mat = new THREE.MeshStandardMaterial({
          color: '#CBD5E1',
          emissive: '#1E293B',
          emissiveIntensity: 0.1,
          roughness: 0.52,
          metalness: 0.08,
          transparent: true,
          opacity: 1,
        });
        const cylinders: THREE.Mesh[] = [];
        for (let k = 0; k < bond.order; k++) {
          const cyl = new THREE.Mesh(sharedBondGeo, mat);
          rigGroup.add(cyl);
          cylinders.push(cyl);
        }
        bondEntries.push({
          bondIndex: idx,
          cylinders,
          material: mat,
          order: bond.order,
        });
      });

      const breakingHalo = new THREE.Mesh(
        new THREE.TorusGeometry(1.3, 0.032, 12, 48),
        new THREE.MeshBasicMaterial({ color: '#FB7185', transparent: true, opacity: 0.0 }),
      );
      breakingHalo.rotation.x = Math.PI / 2;
      breakingHalo.visible = false;
      rigGroup.add(breakingHalo);

      const formingHalo = new THREE.Mesh(
        new THREE.TorusGeometry(1.45, 0.032, 12, 48),
        new THREE.MeshBasicMaterial({ color: '#34D399', transparent: true, opacity: 0.0 }),
      );
      formingHalo.rotation.x = Math.PI / 2;
      formingHalo.visible = false;
      rigGroup.add(formingHalo);

      mechanismStageGroup.add(rigGroup);
      currentMechRig = {
        group: rigGroup,
        atomMeshes,
        atomSprites,
        bondEntries,
        breakingHalo,
        formingHalo,
      };
      builtMechReactionId = spec.reactionId;
    };

    // Animation state
    let reactionProgress = 0;
    let lastTriggerSeq = propsRef.current.reactionTriggerSeq;
    let lastMode: ViewportMode = propsRef.current.mode;
    let cameraTargetPos = new THREE.Vector3(0, 3.8, 7.6);
    let cameraLookTarget = new THREE.Vector3(0, 1.35, 0);
    let cameraTransitioning = false;

    const applyCameraPreset = (preset: CameraPreset) => {
      const m = propsRef.current.mode;
      if (m === 'mechanism') {
        if (preset === 'overview') {
          cameraTargetPos.set(0, 3.9, 12.8);
          cameraLookTarget.set(0, 2.55, 0);
        } else if (preset === 'closeup') {
          cameraTargetPos.set(0.6, 2.95, 7.8);
          cameraLookTarget.set(0, 2.55, 0);
        } else {
          cameraTargetPos.set(0, 11.4, 2.6);
          cameraLookTarget.set(0, 2.5, 0);
        }
      } else if (m === 'molecule') {
        if (preset === 'overview') {
          cameraTargetPos.set(0, 2.1, 5.4);
          cameraLookTarget.set(0, 1.5, 0);
        } else if (preset === 'closeup') {
          cameraTargetPos.set(0.5, 1.75, 3.2);
          cameraLookTarget.set(0, 1.5, 0);
        } else {
          cameraTargetPos.set(0, 5.8, 1.2);
          cameraLookTarget.set(0, 1.5, 0);
        }
      } else {
        if (preset === 'overview') {
          cameraTargetPos.set(0, 3.8, 7.6);
          cameraLookTarget.set(0, 1.35, 0);
        } else if (preset === 'closeup') {
          cameraTargetPos.set(1.4, 2.1, 4.1);
          cameraLookTarget.set(0, 1.1, 0);
        } else {
          cameraTargetPos.set(0, 7.2, 2.2);
          cameraLookTarget.set(0, 0.8, 0);
        }
      }
      cameraTransitioning = true;
      requestRender();
    };

    const zoomBy = (factor: number) => {
      _vec3A.copy(camera.position).sub(controls.target);
      const currentDist = _vec3A.length();
      const targetDist = THREE.MathUtils.clamp(
        currentDist * factor,
        controls.minDistance,
        controls.maxDistance,
      );
      _vec3A.normalize().multiplyScalar(targetDist);
      cameraTargetPos.copy(controls.target).add(_vec3A);
      cameraLookTarget.copy(controls.target);
      cameraTransitioning = true;
      requestRender();
    };

    const rebuildSceneState = () => {
      const p = propsRef.current;
      labGroup.visible = p.mode === 'lab';
      moleculeStageGroup.visible = p.mode === 'molecule';
      mechanismStageGroup.visible = p.mode === 'mechanism';

      if (p.mode !== lastMode) {
        lastMode = p.mode;
        applyCameraPreset(p.cameraPreset);
      }

      if (p.mode === 'lab') {
        const isASolid = p.substanceA.defaultState === 'Chất rắn';
        const isBSolid = p.substanceB.defaultState === 'Chất rắn';

        beakerALiquid.visible = !isASolid;
        beakerASolid.visible = isASolid;
        beakerASolidMat.color.set(p.substanceA.colorHex);
        beakerALiquidMat.color.set(p.substanceA.colorHex);
        beakerALiquidMat.emissive.set(p.substanceA.colorHex);
        beakerALiquidMat.opacity = Math.max(0.55, p.substanceA.opacity);
        pourStreamMatA.color.set(p.substanceA.colorHex);
        pourStreamMatA.emissive.set(p.substanceA.colorHex);

        beakerBLiquid.visible = !isBSolid;
        beakerBSolid.visible = isBSolid;
        beakerBSolidMat.color.set(p.substanceB.colorHex);
        beakerBLiquidMat.color.set(p.substanceB.colorHex);
        beakerBLiquidMat.emissive.set(p.substanceB.colorHex);
        beakerBLiquidMat.opacity = Math.max(0.55, p.substanceB.opacity);
        pourStreamMatB.color.set(p.substanceB.colorHex);
        pourStreamMatB.emissive.set(p.substanceB.colorHex);

        const showHeat = p.heated || Boolean(p.isReacted && p.activeReaction?.hasFlameOrHeatGlow);
        burnerGroup.visible = showHeat;
        flaskGroup.position.y = showHeat ? 0.42 : 0;

        const solidSub = isASolid ? p.substanceA : isBSolid ? p.substanceB : null;

        if (!p.isReacted) {
          reactionProgress = 0;
          centralLiquidMesh.visible = false;
          solidReagentMesh.visible = false;
          vaporPlume.visible = false;
          centralLiquidMat.color.set(p.substanceA.colorHex);
          centralLiquidMat.emissive.set(p.substanceA.colorHex);
          centralLiquidMat.opacity = Math.max(0.58, p.substanceA.opacity);
          centralLiquidMesh.scale.set(1, 0.05, 1);
          centralLiquidMesh.position.y = 0.025;
          beakerALiquid.scale.set(1, 1, 1);
          beakerALiquid.position.y = 0.48;
          beakerBLiquid.scale.set(1, 1, 1);
          beakerBLiquid.position.y = 0.48;
          precipInstanced.visible = false;
          bubbleInstanced.visible = false;
        } else if (p.activeReaction) {
          centralLiquidMesh.visible = true;
          solidReagentMesh.visible = Boolean(solidSub);
          if (solidSub) {
            solidReagentMat.color.set(solidSub.colorHex);
          }
          if (p.activeReaction.precipitateColorHex) {
            precipMat.color.set(p.activeReaction.precipitateColorHex);
            precipMat.emissive.set(p.activeReaction.precipitateColorHex);
            precipInstanced.visible = true;
          } else {
            precipInstanced.visible = false;
          }
          if (p.activeReaction.hasBubbles) {
            const gCol = p.activeReaction.gasColorHex ?? '#FFFFFF';
            bubbleMat.color.set(gCol);
            bubbleMat.emissive.set(gCol);
            bubbleInstanced.visible = true;
            const isColoredGas = gCol !== '#FFFFFF' && gCol !== '#F8FAFC';
            vaporPlume.visible = isColoredGas;
            if (isColoredGas) {
              vaporMat.color.set(gCol);
              vaporMat.emissive.set(gCol);
            }
          } else {
            bubbleInstanced.visible = false;
            vaporPlume.visible = false;
          }
        } else {
          centralLiquidMesh.visible = true;
          solidReagentMesh.visible = Boolean(solidSub);
          if (solidSub) solidReagentMat.color.set(solidSub.colorHex);
          _colorA.set(p.substanceA.colorHex);
          _colorB.set(p.substanceB.colorHex);
          centralLiquidMat.color.copy(_colorA).lerp(_colorB, 0.5);
          centralLiquidMat.emissive.copy(centralLiquidMat.color);
          centralLiquidMat.opacity = 0.72;
          precipInstanced.visible = false;
          bubbleInstanced.visible = false;
          vaporPlume.visible = false;
        }
      } else if (p.mode === 'molecule') {
        if (currentMoleculeMesh) {
          moleculeStageGroup.remove(currentMoleculeMesh);
          currentMoleculeMesh = null;
        }
        const mol =
          CHEMICAL_CATALOG.find((c) => c.id === p.selectedMoleculeId) ?? p.substanceA;
        const built = buildMoleculeGroup(mol);
        built.position.set(0, 1.5, 0);
        built.scale.setScalar(1.05);
        moleculeStageGroup.add(built);
        currentMoleculeMesh = built;
      } else {
        // Mechanism mode
        if (builtMechReactionId !== p.mechanismSpec.reactionId) {
          buildMechanismRig(p.mechanismSpec);
          mechProgressRef.current = 0;
          setMechProgressUi(0);
        }
        if (currentMechRig) {
          currentMechRig.atomSprites.forEach((sp) => {
            sp.visible = p.showAtomLabels;
          });
        }
      }
      requestRender();
    };

    controls.addEventListener('start', () => {
      cameraTransitioning = false;
    });

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastTime = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 24);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function needsContinuousAnimation(): boolean {
      const p = propsRef.current;
      if (cameraTransitioning) return true;
      if (p.mode === 'molecule' && p.autoRotate) return true;
      if (p.mode === 'mechanism') return true; // always keep gentle thermal vibration & playback alive
      if (p.mode === 'lab' && p.isReacted && reactionProgress < 1) return true;
      if (p.mode === 'lab' && p.isReacted && p.activeReaction?.hasBubbles) return true;
      if (p.mode === 'lab' && p.heated) return true;
      return false;
    }

    function updateScene(dt: number, elapsedSec: number) {
      const p = propsRef.current;

      if (p.reactionTriggerSeq !== lastTriggerSeq) {
        lastTriggerSeq = p.reactionTriggerSeq;
        reactionProgress = 0;
      }

      if (cameraTransitioning) {
        const alpha = 1 - Math.exp(-6 * dt);
        camera.position.lerp(cameraTargetPos, alpha);
        controls.target.lerp(cameraLookTarget, alpha);
        if (camera.position.distanceTo(cameraTargetPos) < 0.03) {
          cameraTransitioning = false;
        }
      }

      if (p.mode === 'molecule' && currentMoleculeMesh && p.autoRotate) {
        currentMoleculeMesh.rotation.y += dt * 0.65;
      }

      if (p.mode === 'mechanism' && currentMechRig) {
        if (p.mechPlaying) {
          mechProgressRef.current += dt * 0.14 * p.mechSpeed;
          if (mechProgressRef.current > 1.15) {
            // brief pause at end, then loop seamlessly from 0
            mechProgressRef.current = 0;
          }
        }
        const clampedP = Math.min(1, mechProgressRef.current);

        // Throttled HUD progress sync (<= 10Hz) while playing
        if (p.mechPlaying && elapsedSec - lastUiSyncRef.current > 0.1) {
          lastUiSyncRef.current = elapsedSec;
          setMechProgressUi(clampedP);
        }

        // Update atom & sprite positions
        const spec = p.mechanismSpec;
        for (let i = 0; i < spec.atoms.length; i++) {
          const atom = spec.atoms[i];
          const mesh = currentMechRig.atomMeshes[i];
          const sprite = currentMechRig.atomSprites[i];
          const pos = evaluateMechanismAtomPos(atom, clampedP, i, elapsedSec, spec.requiresHeat);
          mesh.position.set(pos[0], pos[1], pos[2]);
          if (sprite) {
            const cpkRadius = (CPK_COLORS[atom.element]?.radius ?? 0.36) * 0.62;
            sprite.position.set(pos[0], pos[1] + cpkRadius + 0.2, pos[2]);
            sprite.visible = p.showAtomLabels;
          }
        }

        // Update bond cylinders dynamically
        const bondStates = evaluateMechanismBonds(spec, clampedP);
        for (let bIdx = 0; bIdx < bondStates.length; bIdx++) {
          const st = bondStates[bIdx];
          const entry = currentMechRig.bondEntries[bIdx];
          if (!entry) continue;

          if (!st.visible) {
            entry.cylinders.forEach((c) => {
              c.visible = false;
            });
            continue;
          }

          const meshA = currentMechRig.atomMeshes[st.from];
          const meshB = currentMechRig.atomMeshes[st.to];
          if (!meshA || !meshB) continue;

          _vec3A.copy(meshA.position);
          _vec3B.copy(meshB.position);

          // For forming bonds, animate cylinder growing outward from A to B in 0.48..0.68
          if (st.kind === 'forming' && clampedP < 0.72) {
            const grow = THREE.MathUtils.clamp((clampedP - 0.48) / 0.24, 0.08, 1);
            _vec3B.lerpVectors(_vec3A, _vec3B, grow);
          }

          const dist = _vec3A.distanceTo(_vec3B);
          if (dist < 0.02) {
            entry.cylinders.forEach((c) => {
              c.visible = false;
            });
            continue;
          }

          entry.material.color.set(st.colorHex);
          entry.material.emissive.set(st.emissiveHex);
          entry.material.emissiveIntensity = st.emissiveIntensity;
          entry.material.opacity = st.opacity;

          _vec3Mid.copy(_vec3A).add(_vec3B).multiplyScalar(0.5);
          _vec3Dir.copy(_vec3B).sub(_vec3A).normalize();
          _quat.setFromUnitVectors(_upAxis, _vec3Dir);

          _perpRef.set(0, 0, 1);
          if (Math.abs(_vec3Dir.dot(_perpRef)) > 0.9) _perpRef.set(1, 0, 0);
          _ortho.crossVectors(_vec3Dir, _perpRef).normalize();

          const offsets =
            entry.order === 1
              ? [0]
              : entry.order === 2
                ? [-0.08, 0.08]
                : [-0.11, 0, 0.11];

          const radScale = (entry.order > 1 ? 0.68 : 1) * st.thicknessScale;
          for (let k = 0; k < entry.cylinders.length; k++) {
            const cyl = entry.cylinders[k];
            cyl.visible = true;
            cyl.position.copy(_vec3Mid).addScaledVector(_ortho, offsets[k] ?? 0);
            cyl.quaternion.copy(_quat);
            cyl.scale.set(radScale, dist, radScale);
          }
        }

        // Transition phase indicator rings around reaction center
        const showBreakHalo = spec.hasReaction && clampedP >= 0.22 && clampedP <= 0.54;
        currentMechRig.breakingHalo.visible = showBreakHalo;
        if (showBreakHalo) {
          const haloMat = currentMechRig.breakingHalo.material as THREE.MeshBasicMaterial;
          const phase = Math.sin(((clampedP - 0.22) / 0.32) * Math.PI);
          haloMat.opacity = phase * 0.55;
          currentMechRig.breakingHalo.scale.setScalar(0.85 + phase * 0.45);
        }

        const showFormHalo = spec.hasReaction && clampedP >= 0.5 && clampedP <= 0.86;
        currentMechRig.formingHalo.visible = showFormHalo;
        if (showFormHalo) {
          const haloMat = currentMechRig.formingHalo.material as THREE.MeshBasicMaterial;
          const phase = Math.sin(((clampedP - 0.5) / 0.36) * Math.PI);
          haloMat.opacity = phase * 0.55;
          currentMechRig.formingHalo.scale.setScalar(1.25 - phase * 0.35);
        }
      }

      if (p.mode === 'lab') {
        if (burnerGroup.visible) {
          const pulse = 1 + Math.sin(elapsedSec * 14) * 0.12;
          flameCone.scale.set(1, pulse, 1);
        }

        if (p.isReacted) {
          reactionProgress = Math.min(1, reactionProgress + dt * 1.15);

          const pourPhase =
            reactionProgress < 0.45 ? Math.sin((reactionProgress / 0.45) * Math.PI) : 0;
          beakerAMeshGroup.position.set(
            -2.55 + pourPhase * 1.1,
            pourPhase * 1.65,
            0.2 - pourPhase * 0.2,
          );
          beakerAMeshGroup.rotation.z = -pourPhase * 0.85;
          beakerBMeshGroup.position.set(
            2.55 - pourPhase * 1.1,
            pourPhase * 1.65,
            0.2 - pourPhase * 0.2,
          );
          beakerBMeshGroup.rotation.z = pourPhase * 0.85;

          pourStreamA.visible = pourPhase > 0.3;
          pourStreamA.position.set(-0.55, 1.95, 0);
          pourStreamA.rotation.z = -0.35;

          pourStreamB.visible = pourPhase > 0.3;
          pourStreamB.position.set(0.55, 1.95, 0);
          pourStreamB.rotation.z = 0.35;

          const drainFactor = Math.min(1, reactionProgress / 0.45);
          const beakerRemain = 1 - drainFactor * 0.65;
          beakerALiquid.scale.set(1, beakerRemain, 1);
          beakerALiquid.position.y = 0.05 + 0.43 * beakerRemain;
          beakerBLiquid.scale.set(1, beakerRemain, 1);
          beakerBLiquid.position.y = 0.05 + 0.43 * beakerRemain;

          centralLiquidMesh.visible = true;
          const fillRatio = Math.max(0.18, Math.min(1.06, reactionProgress * 1.18));
          centralLiquidMesh.scale.set(1, fillRatio, 1);
          centralLiquidMesh.position.y = 0.5 * fillRatio;

          if (p.activeReaction) {
            _colorA.set(p.activeReaction.liquidColorBeforeHex);
            _colorB.set(p.activeReaction.liquidColorAfterHex);
            centralLiquidMat.color.copy(_colorA).lerp(_colorB, Math.min(1, reactionProgress * 1.3));
            centralLiquidMat.emissive.copy(centralLiquidMat.color);
            centralLiquidMat.emissiveIntensity = 0.36;
            centralLiquidMat.opacity = THREE.MathUtils.lerp(
              Math.max(0.72, p.substanceA.opacity),
              Math.max(0.78, p.activeReaction.liquidOpacityAfter),
              reactionProgress,
            );
          }

          if (solidReagentMesh.visible) {
            const dissolveScale = p.activeReaction
              ? Math.max(0.18, 1 - reactionProgress * 0.78)
              : 1;
            solidReagentMesh.scale.setScalar(dissolveScale);
            solidReagentMesh.rotation.y = elapsedSec * 0.8;
          }

          if (vaporPlume.visible) {
            vaporMat.opacity = 0.25 + reactionProgress * 0.35 + Math.sin(elapsedSec * 4) * 0.06;
          }

          if (precipInstanced.visible) {
            for (let i = 0; i < precipCount; i++) {
              const seed = precipSeeds[i];
              const fall = Math.min(1, reactionProgress * 1.15 * seed.speed);
              const y = THREE.MathUtils.lerp(seed.yStart, 0.09 + (i % 4) * 0.035, fall);
              _dummy.position.set(
                Math.cos(seed.angle) * seed.radius,
                y,
                Math.sin(seed.angle) * seed.radius,
              );
              _dummy.rotation.set(i, i * 0.5, 0);
              _dummy.scale.setScalar(seed.scale * Math.min(1, reactionProgress * 2));
              _dummy.updateMatrix();
              precipInstanced.setMatrixAt(i, _dummy.matrix);
            }
            precipInstanced.instanceMatrix.needsUpdate = true;
          }

          if (bubbleInstanced.visible) {
            for (let i = 0; i < bubbleCount; i++) {
              const b = bubbleSeeds[i];
              const cycle = (elapsedSec * b.speed + b.phase) % 1.45;
              const y = 0.15 + cycle * 1.55;
              const s = cycle > 1.2 ? 1.25 : 0.85;
              _dummy.position.set(b.x, y, b.z);
              _dummy.scale.setScalar(s);
              _dummy.updateMatrix();
              bubbleInstanced.setMatrixAt(i, _dummy.matrix);
            }
            bubbleInstanced.instanceMatrix.needsUpdate = true;
          }
        } else {
          beakerAMeshGroup.position.set(-2.55, 0, 0.2);
          beakerAMeshGroup.rotation.z = 0;
          beakerBMeshGroup.position.set(2.55, 0, 0.2);
          beakerBMeshGroup.rotation.z = 0;
          pourStreamA.visible = false;
          pourStreamB.visible = false;
        }
      }
    }

    function requestRender() {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        const now = performance.now();
        const dt = Math.min(0.18, (now - lastTime) / 1000);
        lastTime = now;
        updateScene(dt, now / 1000);
        controls.update();
        renderer.render(scene, camera);
        if (viewportRef.current && propsRef.current.mode === 'mechanism') {
          viewportRef.current.dataset.renderedMechProgress = Math.min(
            1,
            mechProgressRef.current,
          ).toFixed(2);
        }
        const done = () => {
          renderBusy = false;
          if (renderDirty || needsContinuousAnimation()) {
            requestRender();
          }
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    controls.addEventListener('change', requestRender);

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth || 720;
      const h = container.clientHeight || 480;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    });
    resizeObserver.observe(container);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    sceneActionsRef.current = { rebuildSceneState, applyCameraPreset, zoomBy, requestRender };
    rebuildSceneState();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      disposeMechanismRig();
      sharedAtomGeo.dispose();
      sharedBondGeo.dispose();
      labelTextureCache.forEach((tex) => tex.dispose());
      labelTextureCache.clear();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      benchTex.dispose();
      gradTex.dispose();
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    sceneActionsRef.current?.rebuildSceneState();
  }, [
    mode,
    substanceA,
    substanceB,
    activeReaction,
    isReacted,
    reactionTriggerSeq,
    selectedMoleculeId,
    heated,
    mechanismSpec,
    showAtomLabels,
  ]);

  useEffect(() => {
    sceneActionsRef.current?.requestRender();
  }, [autoRotate, mechPlaying, mechSpeed]);

  const handlePresetClick = (preset: CameraPreset) => {
    setCameraPreset(preset);
    sceneActionsRef.current?.applyCameraPreset(preset);
  };

  const handleScrubMechanism = (value: number) => {
    setMechPlaying(false);
    propsRef.current.mechPlaying = false;
    mechProgressRef.current = value;
    setMechProgressUi(value);
    sceneActionsRef.current?.requestRender();
  };

  const handleReplayMechanism = () => {
    mechProgressRef.current = 0;
    setMechProgressUi(0);
    setMechPlaying(true);
    propsRef.current.mechPlaying = true;
    sceneActionsRef.current?.requestRender();
  };

  const stageInfo = getMechanismStageLabel(mechanismSpec, mechProgressUi);

  return (
    <div
      ref={viewportRef}
      className={
        isExpanded
          ? 'fixed inset-0 z-50 w-screen h-screen bg-[#070D19] select-none'
          : 'relative w-full h-[360px] sm:h-[460px] lg:h-[540px] rounded-xl overflow-hidden border border-slate-800 bg-slate-950 select-none'
      }
      data-testid="lab-3d-viewport"
      data-mode={mode}
      data-expanded={isExpanded ? 'true' : 'false'}
      data-reacted={isReacted ? 'true' : 'false'}
      data-mech-progress={mechProgressUi.toFixed(2)}
    >
      {/* Top-Left Spec Badge & Mechanism Stage Banner */}
      <div
        className={`pointer-events-none absolute top-3 left-3 z-10 flex flex-col gap-1.5 ${
          isExpanded
            ? 'max-w-[calc(100%-175px)] md:max-w-[calc(100%-470px)]'
            : 'max-w-[calc(100%-175px)]'
        }`}
      >
        <div className="inline-flex items-center gap-2 rounded-lg bg-slate-900/95 border border-slate-700/80 px-3 py-1.5 text-xs text-slate-200 shadow">
          <span className="font-semibold text-white truncate">
            {mode === 'lab'
              ? isReacted && activeReaction
                ? activeReaction.balancedEquation
                : `${substanceA.displayFormula} + ${substanceB.displayFormula}`
              : mode === 'mechanism'
                ? `Tách & Nối phân tử 3D: ${mechanismSpec.equation}`
                : (() => {
                    const mol =
                      CHEMICAL_CATALOG.find((c) => c.id === selectedMoleculeId) ?? substanceA;
                    return `Cấu trúc phân tử 3D: ${mol.name} (${mol.displayFormula})`;
                  })()}
          </span>
        </div>

        {mode === 'mechanism' && (
          <div
            className={`rounded-lg border px-3 py-1.5 text-xs shadow ${stageInfo.colorClass}`}
          >
            <div className="font-bold">{stageInfo.badge}</div>
            <div className="text-[11px] opacity-95 mt-0.5 line-clamp-2">{stageInfo.description}</div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-200">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-3 rounded-sm bg-rose-400" /> Liên kết đang tách
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-3 rounded-sm bg-emerald-400" /> Liên kết mới nối
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Top-Right Fullscreen Expand & Quick Action Controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-wrap items-center justify-end gap-1.5">
        {isExpanded && onModeChange && (
          <div className="hidden md:inline-flex items-center gap-1 rounded-lg bg-slate-900/95 border border-slate-700 p-1">
            <button
              type="button"
              onClick={() => onModeChange('lab')}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold ${
                mode === 'lab' ? 'bg-sky-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Beaker className="h-3.5 w-3.5" /> Lab 3D
            </button>
            <button
              type="button"
              onClick={() => onModeChange('mechanism')}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold ${
                mode === 'mechanism'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <GitMerge className="h-3.5 w-3.5" /> Tách &amp; Nối 3D
            </button>
            <button
              type="button"
              onClick={() => onModeChange('molecule')}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold ${
                mode === 'molecule'
                  ? 'bg-sky-500 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Atom className="h-3.5 w-3.5" /> Phân tử 3D
            </button>
          </div>
        )}

        {isExpanded && mode === 'lab' && onTriggerReaction && (
          <button
            type="button"
            onClick={onTriggerReaction}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400 shadow"
          >
            Trộn &amp; Phản ứng
          </button>
        )}

        {isExpanded && mode === 'lab' && isReacted && onResetLab && (
          <button
            type="button"
            onClick={onResetLab}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/95 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Làm sạch
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          aria-label={isExpanded ? 'Thu nhỏ phòng lab 3D' : 'Phóng to phòng lab 3D'}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800 hover:border-sky-500/60 shadow transition-colors whitespace-nowrap"
        >
          {isExpanded ? (
            <>
              <Minimize2 className="h-3.5 w-3.5 text-sky-400" />
              Thu nhỏ (Esc)
            </>
          ) : (
            <>
              <Maximize2 className="h-3.5 w-3.5 text-sky-400" />
              Phóng to 3D
            </>
          )}
        </button>
      </div>

      {webglError ? (
        <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-slate-300">
          {webglError}
        </div>
      ) : (
        <div ref={mountRef} className="h-full w-full" />
      )}

      {/* Collapsible Bottom Control Dock (Zero Viewport Occlusion, No backdrop-filter) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center max-w-[95%]">
        <button
          type="button"
          onClick={() => setHudCollapsed((v) => !v)}
          className="mb-1.5 inline-flex items-center gap-1 rounded-md bg-slate-900/95 border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap"
        >
          {hudCollapsed ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
          {hudCollapsed ? 'Hiện điều khiển 3D' : 'Thu gọn HUD'}
        </button>

        {!hudCollapsed && (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-slate-900/95 border border-slate-700 px-3 py-2 text-xs text-slate-200 shadow-lg">
            {mode === 'mechanism' && (
              <div className="flex flex-wrap items-center justify-center gap-2 w-full border-b border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => setMechPlaying((v) => !v)}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold ${
                    mechPlaying
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-emerald-500 text-slate-950'
                  }`}
                >
                  {mechPlaying ? (
                    <>
                      <Pause className="h-3.5 w-3.5" /> Tạm dừng
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" /> Phát tiếp
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleReplayMechanism}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1 font-medium text-slate-200 hover:bg-slate-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Phát lại
                </button>
                <div className="flex items-center gap-2 min-w-[160px] sm:min-w-[220px]">
                  <label htmlFor="mechanism-scrubber" className="sr-only">
                    Tiến trình tách và nối liên kết
                  </label>
                  <input
                    id="mechanism-scrubber"
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={mechProgressUi}
                    onChange={(e) => handleScrubMechanism(Number(e.target.value))}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <span className="font-mono text-[11px] tabular-nums text-emerald-300 w-9 text-right">
                    {Math.round(mechProgressUi * 100)}%
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setMechSpeed((s) => (s === 0.5 ? 1 : s === 1 ? 1.5 : 0.5))
                  }
                  className="rounded-md bg-slate-800 px-2 py-1 font-mono text-[11px] font-semibold text-sky-300 hover:bg-slate-700"
                  title="Tốc độ mô phỏng"
                >
                  {mechSpeed}x
                </button>
                <button
                  type="button"
                  onClick={() => setShowAtomLabels((v) => !v)}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium ${
                    showAtomLabels
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Tag className="h-3.5 w-3.5" /> Nhãn
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => handlePresetClick('overview')}
                className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                  cameraPreset === 'overview'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                Tổng quan
              </button>
              <button
                type="button"
                onClick={() => handlePresetClick('closeup')}
                className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                  cameraPreset === 'closeup'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                Cận cảnh
              </button>
              <button
                type="button"
                onClick={() => handlePresetClick('top')}
                className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                  cameraPreset === 'top'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                Nhìn từ trên
              </button>

              <span className="h-4 w-px bg-slate-700" aria-hidden="true" />

              <button
                type="button"
                onClick={() => sceneActionsRef.current?.zoomBy(0.78)}
                aria-label="Phóng to góc nhìn 3D"
                title="Phóng to góc nhìn"
                className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 font-medium text-slate-200 hover:bg-slate-700"
              >
                <ZoomIn className="h-3.5 w-3.5 text-sky-400" />
                <span className="hidden sm:inline">Gần</span>
              </button>
              <button
                type="button"
                onClick={() => sceneActionsRef.current?.zoomBy(1.26)}
                aria-label="Thu nhỏ góc nhìn 3D"
                title="Thu nhỏ góc nhìn"
                className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 font-medium text-slate-200 hover:bg-slate-700"
              >
                <ZoomOut className="h-3.5 w-3.5 text-sky-400" />
                <span className="hidden sm:inline">Xa</span>
              </button>

              {mode === 'molecule' && (
                <>
                  <span className="h-4 w-px bg-slate-700" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => setAutoRotate((r) => !r)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                      autoRotate
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    {autoRotate ? 'Đang tự xoay' : 'Tạm dừng xoay'}
                  </button>
                </>
              )}

              <span className="hidden md:inline text-slate-400">
                · Kéo để xoay 360°, cuộn để thu phóng
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
