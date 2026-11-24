import type { ChemicalSubstance, LabReactionPreset } from '../data/chemicalsAndReactions';

export type Vec3Tuple = [number, number, number];

export interface MechanismAtom {
  element: string;
  label?: string;
  startPos: Vec3Tuple;
  midPos: Vec3Tuple;
  endPos: Vec3Tuple;
}

export interface MechanismBond {
  from: number;
  to: number;
  order: 1 | 2 | 3;
  staysIntact?: boolean;
}

export interface ReactionMechanismSpec {
  reactionId: string;
  title: string;
  equation: string;
  hasReaction: boolean;
  requiresHeat: boolean;
  atoms: MechanismAtom[];
  oldBonds: MechanismBond[];
  newBonds: MechanismBond[];
  stages: {
    approach: string;
    breaking: string;
    forming: string;
    complete: string;
  };
  mechanismSummary: string;
}

export interface EvaluatedBondState {
  from: number;
  to: number;
  order: 1 | 2 | 3;
  visible: boolean;
  opacity: number;
  thicknessScale: number;
  colorHex: string;
  emissiveHex: string;
  emissiveIntensity: number;
  kind: 'intact' | 'breaking' | 'forming';
}

function lerp3(a: Vec3Tuple, b: Vec3Tuple, t: number): Vec3Tuple {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Computes interpolated 3D position for a mechanism atom at normalized progress t in [0, 1].
 * - 0.00..0.30: Reactants approach midPos (transition zone)
 * - 0.30..0.55: Transition state vibration & bond cleavage around midPos
 * - 0.55..0.90: Atoms migrate smoothly from midPos into product endPos
 */
export function evaluateMechanismAtomPos(
  atom: MechanismAtom,
  progress: number,
  atomIndex: number,
  elapsedSec: number,
  requiresHeat: boolean,
): Vec3Tuple {
  const p = Math.max(0, Math.min(1, progress));
  let base: Vec3Tuple;
  if (p < 0.35) {
    const k = smoothstep(0, 0.35, p);
    base = lerp3(atom.startPos, atom.midPos, k);
  } else if (p < 0.52) {
    // Slight outward recoil during bond breaking
    const recoil = Math.sin(((p - 0.35) / 0.17) * Math.PI) * 0.14;
    base = [
      atom.midPos[0] * (1 + recoil * 0.25),
      atom.midPos[1] + Math.sin(atomIndex * 1.7 + p * 12) * recoil * 0.5,
      atom.midPos[2] * (1 + recoil * 0.25),
    ];
  } else {
    const k = smoothstep(0.52, 0.92, p);
    base = lerp3(atom.midPos, atom.endPos, k);
  }

  // Subtle thermal vibration, amplified in transition zone or heated reactions
  const inTransition = p > 0.22 && p < 0.78 ? 1.5 : 0.7;
  const heatBoost = requiresHeat ? 1.45 : 1.0;
  const amp = 0.03 * inTransition * heatBoost;
  return [
    base[0] + Math.sin(elapsedSec * 4.2 + atomIndex * 1.9) * amp,
    base[1] + Math.cos(elapsedSec * 3.8 + atomIndex * 2.3) * amp,
    base[2] + Math.sin(elapsedSec * 4.5 + atomIndex * 1.1) * amp * 0.8,
  ];
}

/**
 * Evaluates visual state (visibility, thickness, color) of a bond at normalized progress t in [0, 1].
 */
export function evaluateMechanismBonds(
  spec: ReactionMechanismSpec,
  progress: number,
): EvaluatedBondState[] {
  const p = Math.max(0, Math.min(1, progress));
  const result: EvaluatedBondState[] = [];

  for (const bond of spec.oldBonds) {
    if (bond.staysIntact) {
      result.push({
        from: bond.from,
        to: bond.to,
        order: bond.order,
        visible: true,
        opacity: 1,
        thicknessScale: 1,
        colorHex: '#CBD5E1',
        emissiveHex: '#1E293B',
        emissiveIntensity: 0.1,
        kind: 'intact',
      });
      continue;
    }

    // Old breaking bond: intact (0..0.20) -> saturated crimson cleavage stress (0.20..0.54) -> snapped (0.54..1)
    if (p >= 0.54) {
      result.push({
        from: bond.from,
        to: bond.to,
        order: bond.order,
        visible: false,
        opacity: 0,
        thicknessScale: 0,
        colorHex: '#DC2626',
        emissiveHex: '#991B1B',
        emissiveIntensity: 0,
        kind: 'breaking',
      });
    } else if (p < 0.2) {
      result.push({
        from: bond.from,
        to: bond.to,
        order: bond.order,
        visible: true,
        opacity: 1,
        thicknessScale: 1,
        colorHex: '#CBD5E1',
        emissiveHex: '#1E293B',
        emissiveIntensity: 0.1,
        kind: 'breaking',
      });
    } else {
      const k = smoothstep(0.2, 0.54, p);
      result.push({
        from: bond.from,
        to: bond.to,
        order: bond.order,
        visible: true,
        opacity: Math.max(0.25, 1 - k * 0.72),
        thicknessScale: Math.max(0.35, 1 - k * 0.58),
        colorHex: '#DC2626',
        emissiveHex: '#991B1B',
        emissiveIntensity: 0.85,
        kind: 'breaking',
      });
    }
  }

  for (const bond of spec.newBonds) {
    if (p < 0.48) {
      result.push({
        from: bond.from,
        to: bond.to,
        order: bond.order,
        visible: false,
        opacity: 0,
        thicknessScale: 0,
        colorHex: '#059669',
        emissiveHex: '#047857',
        emissiveIntensity: 0,
        kind: 'forming',
      });
    } else {
      const k = smoothstep(0.48, 0.86, p);
      const settled = p > 0.9 ? smoothstep(0.9, 1.0, p) : 0;
      result.push({
        from: bond.from,
        to: bond.to,
        order: bond.order,
        visible: true,
        opacity: Math.min(1, 0.35 + k * 0.65),
        thicknessScale: 0.35 + k * 0.65,
        colorHex: settled > 0.5 ? '#CBD5E1' : '#059669',
        emissiveHex: '#047857',
        emissiveIntensity: (1 - settled) * 0.8 + 0.1,
        kind: 'forming',
      });
    }
  }

  return result;
}

export function getMechanismStageLabel(
  spec: ReactionMechanismSpec,
  progress: number,
): { stepNumber: 1 | 2 | 3 | 4; badge: string; description: string; colorClass: string } {
  if (!spec.hasReaction) {
    return {
      stepNumber: progress < 0.5 ? 1 : 4,
      badge: 'Va chạm không phản ứng',
      description:
        progress < 0.5 ? spec.stages.approach : spec.stages.complete,
      colorClass: 'text-slate-300 border-slate-600 bg-slate-800/80',
    };
  }
  if (progress < 0.24) {
    return {
      stepNumber: 1,
      badge: '1. Tiếp cận & Va chạm',
      description: spec.stages.approach,
      colorClass: 'text-sky-300 border-sky-500/40 bg-sky-950/60',
    };
  }
  if (progress < 0.52) {
    return {
      stepNumber: 2,
      badge: '2. Tách liên kết cũ (Đứt gãy)',
      description: spec.stages.breaking,
      colorClass: 'text-rose-300 border-rose-500/50 bg-rose-950/60',
    };
  }
  if (progress < 0.86) {
    return {
      stepNumber: 3,
      badge: '3. Nối liên kết mới (Tái tổ hợp)',
      description: spec.stages.forming,
      colorClass: 'text-emerald-300 border-emerald-500/50 bg-emerald-950/60',
    };
  }
  return {
    stepNumber: 4,
    badge: '4. Hình thành sản phẩm bền',
    description: spec.stages.complete,
    colorClass: 'text-amber-300 border-amber-500/40 bg-amber-950/60',
  };
}

function spreadTuple(v: Vec3Tuple): Vec3Tuple {
  return [
    Number((v[0] * 1.28).toFixed(3)),
    Number((v[1] * 1.22).toFixed(3)),
    Number((v[2] * 1.15).toFixed(3)),
  ];
}

function widenMechanismSpec(spec: ReactionMechanismSpec): ReactionMechanismSpec {
  return {
    ...spec,
    atoms: spec.atoms.map((a) => ({
      ...a,
      startPos: spreadTuple(a.startPos),
      midPos: spreadTuple(a.midPos),
      endPos: spreadTuple(a.endPos),
    })),
  };
}

export function buildReactionMechanism(
  reaction: LabReactionPreset | null,
  substanceA: ChemicalSubstance,
  substanceB: ChemicalSubstance,
): ReactionMechanismSpec {
  return widenMechanismSpec(buildRawReactionMechanism(reaction, substanceA, substanceB));
}

function buildRawReactionMechanism(
  reaction: LabReactionPreset | null,
  substanceA: ChemicalSubstance,
  substanceB: ChemicalSubstance,
): ReactionMechanismSpec {
  if (!reaction) {
    // Generic elastic non-reactive collision between substanceA and substanceB
    const atoms: MechanismAtom[] = [];
    const oldBonds: MechanismBond[] = [];

    substanceA.atoms3D.forEach((a) => {
      atoms.push({
        element: a.element,
        startPos: [a.x - 2.6, a.y, a.z],
        midPos: [a.x - 1.1, a.y, a.z],
        endPos: [a.x - 2.5, a.y + 0.2, a.z],
      });
    });
    substanceA.bonds3D.forEach((b) => {
      oldBonds.push({ from: b.from, to: b.to, order: b.order, staysIntact: true });
    });

    const offsetB = atoms.length;
    substanceB.atoms3D.forEach((b) => {
      atoms.push({
        element: b.element,
        startPos: [b.x + 2.6, b.y, b.z],
        midPos: [b.x + 1.1, b.y, b.z],
        endPos: [b.x + 2.5, b.y - 0.2, b.z],
      });
    });
    substanceB.bonds3D.forEach((b) => {
      oldBonds.push({
        from: b.from + offsetB,
        to: b.to + offsetB,
        order: b.order,
        staysIntact: true,
      });
    });

    return {
      reactionId: `none_${substanceA.id}_${substanceB.id}`,
      title: `Va chạm giữa ${substanceA.displayFormula} và ${substanceB.displayFormula}`,
      equation: `${substanceA.displayFormula} + ${substanceB.displayFormula} → Không phản ứng`,
      hasReaction: false,
      requiresHeat: false,
      atoms,
      oldBonds,
      newBonds: [],
      stages: {
        approach: `${substanceA.displayFormula} và ${substanceB.displayFormula} chuyển động tiến lại gần nhau.`,
        breaking: 'Không đủ năng lượng hoạt hóa hoặc động lực trao đổi ion để cắt đứt liên kết.',
        forming: 'Các liên kết cũ được giữ nguyên hoàn toàn.',
        complete: 'Hai phân tử tách nhau ra sau va chạm đàn hồi — không có chất mới tạo thành.',
      },
      mechanismSummary:
        'Hai chất không thỏa mãn điều kiện phản ứng trao đổi (tạo kết tủa, khí hoặc chất điện li yếu) hay phản ứng oxi hóa - khử.',
    };
  }

  switch (reaction.id) {
    case 'cuso4_naoh':
      return {
        reactionId: reaction.id,
        title: reaction.title,
        equation: reaction.balancedEquation,
        hasReaction: true,
        requiresHeat: false,
        // 0: Cu, 1: S, 2..5: O (SO4), 6: Na1, 7: O(OH1), 8: H1, 9: Na2, 10: O(OH2), 11: H2
        atoms: [
          { element: 'Cu', label: 'Cu²⁺', startPos: [-3.1, 0.25, 0], midPos: [-1.8, 0.0, 0], endPos: [-2.35, 0, 0] },
          { element: 'S', label: 'S', startPos: [-1.6, -0.25, 0], midPos: [1.35, -0.15, 0.25], endPos: [2.45, 0, 0] },
          { element: 'O', startPos: [-2.3, 0.45, 0.45], midPos: [0.55, 0.45, 0.55], endPos: [1.65, 0.65, 0.3] },
          { element: 'O', startPos: [-2.3, -0.8, -0.4], midPos: [0.55, -0.75, -0.25], endPos: [1.65, -0.65, -0.3] },
          { element: 'O', startPos: [-0.9, 0.45, -0.4], midPos: [2.1, 0.45, -0.25], endPos: [3.25, 0.65, -0.3] },
          { element: 'O', startPos: [-0.9, -0.85, 0.4], midPos: [2.1, -0.75, 0.55], endPos: [3.25, -0.65, 0.3] },

          { element: 'Na', label: 'Na⁺', startPos: [2.5, 1.55, 0], midPos: [1.8, 1.65, 0], endPos: [0.7, 0.65, 0] },
          { element: 'O', label: 'O', startPos: [1.45, 1.55, 0], midPos: [-0.55, 1.25, 0], endPos: [-1.45, 0.95, 0] },
          { element: 'H', startPos: [0.85, 2.0, 0], midPos: [-0.95, 1.9, 0.2], endPos: [-0.95, 1.6, 0.2] },

          { element: 'Na', label: 'Na⁺', startPos: [2.5, -1.55, 0], midPos: [1.8, -1.65, 0], endPos: [0.7, -0.65, 0] },
          { element: 'O', label: 'O', startPos: [1.45, -1.55, 0], midPos: [-0.55, -1.25, 0], endPos: [-3.25, -0.95, 0] },
          { element: 'H', startPos: [0.85, -2.0, 0], midPos: [-0.95, -1.9, -0.2], endPos: [-3.75, -1.6, -0.2] },
        ],
        oldBonds: [
          { from: 1, to: 2, order: 1, staysIntact: true },
          { from: 1, to: 3, order: 1, staysIntact: true },
          { from: 1, to: 4, order: 2, staysIntact: true },
          { from: 1, to: 5, order: 2, staysIntact: true },
          { from: 0, to: 2, order: 1 }, // breaks Cu - SO4
          { from: 0, to: 3, order: 1 }, // breaks Cu - SO4
          { from: 6, to: 7, order: 1 }, // breaks Na - OH
          { from: 7, to: 8, order: 1, staysIntact: true },
          { from: 9, to: 10, order: 1 }, // breaks Na - OH
          { from: 10, to: 11, order: 1, staysIntact: true },
        ],
        newBonds: [
          { from: 0, to: 7, order: 1 }, // Cu - OH1
          { from: 0, to: 10, order: 1 }, // Cu - OH2
          { from: 6, to: 2, order: 1 }, // Na1 - SO4
          { from: 9, to: 3, order: 1 }, // Na2 - SO4
        ],
        stages: {
          approach: 'Phân tử CuSO₄ tiến lại gần 2 phân tử NaOH trong dung dịch.',
          breaking: 'Liên kết ion giữa Cu²⁺–SO₄²⁻ và Na⁺–OH⁻ bị cắt đứt, giữ nguyên nhóm OH⁻ và SO₄²⁻.',
          forming: 'Ion Cu²⁺ nối với 2 nhóm OH⁻ tạo kết tủa Cu(OH)₂; 2 ion Na⁺ gắn với SO₄²⁻.',
          complete: 'Tạo thành kết tủa xanh lam Cu(OH)₂↓ và muối tan Na₂SO₄.',
        },
        mechanismSummary:
          'Trao đổi ion kép: nhóm SO₄²⁻ và nhóm OH⁻ giữ nguyên cấu trúc bên trong, chỉ đổi vị trí phối trí giữa Cu²⁺ và Na⁺.',
      };

    case 'fe_hcl':
      return {
        reactionId: reaction.id,
        title: reaction.title,
        equation: reaction.balancedEquation,
        hasReaction: true,
        requiresHeat: false,
        // 0: Fe, 1: H1, 2: Cl1, 3: H2, 4: Cl2
        atoms: [
          { element: 'Fe', label: 'Fe', startPos: [-2.2, 0, 0], midPos: [-0.8, 0, 0], endPos: [-1.4, 0, 0] },
          { element: 'H', label: 'H', startPos: [1.3, 1.0, 0], midPos: [0.3, 0.45, 0], endPos: [1.8, 0.45, 0] },
          { element: 'Cl', label: 'Cl', startPos: [2.4, 1.0, 0], midPos: [0.8, 1.15, 0], endPos: [-2.55, 0.7, 0] },
          { element: 'H', label: 'H', startPos: [1.3, -1.0, 0], midPos: [0.3, -0.45, 0], endPos: [1.8, -0.45, 0] },
          { element: 'Cl', label: 'Cl', startPos: [2.4, -1.0, 0], midPos: [0.8, -1.15, 0], endPos: [-2.55, -0.7, 0] },
        ],
        oldBonds: [
          { from: 1, to: 2, order: 1 }, // H1 - Cl1 breaks
          { from: 3, to: 4, order: 1 }, // H2 - Cl2 breaks
        ],
        newBonds: [
          { from: 0, to: 2, order: 1 }, // Fe - Cl1
          { from: 0, to: 4, order: 1 }, // Fe - Cl2
          { from: 1, to: 3, order: 1 }, // H1 - H2
        ],
        stages: {
          approach: 'Nguyên tử Fe va chạm trực tiếp với 2 phân tử axit HCl.',
          breaking: 'Liên kết cộng hóa trị phân cực H–Cl bị kéo giãn và đứt gãy hoàn toàn.',
          forming: 'Fe nhường 2e kết hợp với 2 Cl⁻ thành FeCl₂; 2 nguyên tử H ghép đôi tạo H–H.',
          complete: 'Thu được muối tan FeCl₂ (xanh lục nhạt) và phân tử khí H₂↑ bay lên.',
        },
        mechanismSummary:
          'Phản ứng thế: Fe đẩy H ra khỏi HCl. Hai liên kết H–Cl đứt để hình thành 2 liên kết Fe–Cl và 1 liên kết H–H.',
      };

    case 'mg_hcl':
      return {
        reactionId: reaction.id,
        title: reaction.title,
        equation: reaction.balancedEquation,
        hasReaction: true,
        requiresHeat: false,
        atoms: [
          { element: 'Mg', label: 'Mg', startPos: [-2.2, 0, 0], midPos: [-0.8, 0, 0], endPos: [-1.4, 0, 0] },
          { element: 'H', label: 'H', startPos: [1.3, 1.0, 0], midPos: [0.3, 0.45, 0], endPos: [1.8, 0.45, 0] },
          { element: 'Cl', label: 'Cl', startPos: [2.4, 1.0, 0], midPos: [0.8, 1.15, 0], endPos: [-2.55, 0.7, 0] },
          { element: 'H', label: 'H', startPos: [1.3, -1.0, 0], midPos: [0.3, -0.45, 0], endPos: [1.8, -0.45, 0] },
          { element: 'Cl', label: 'Cl', startPos: [2.4, -1.0, 0], midPos: [0.8, -1.15, 0], endPos: [-2.55, -0.7, 0] },
        ],
        oldBonds: [
          { from: 1, to: 2, order: 1 },
          { from: 3, to: 4, order: 1 },
        ],
        newBonds: [
          { from: 0, to: 2, order: 1 },
          { from: 0, to: 4, order: 1 },
          { from: 1, to: 3, order: 1 },
        ],
        stages: {
          approach: 'Nguyên tử Mg tiếp xúc mạnh với 2 phân tử HCl.',
          breaking: 'Liên kết H–Cl bị phá vỡ nhanh chóng do tính khử mạnh của Mg.',
          forming: 'Mg gắn kết với 2 Cl⁻ tạo MgCl₂; 2 nguyên tử H liên kết tạo khí H₂.',
          complete: 'Tạo dung dịch MgCl₂ không màu và giải phóng khí H₂↑.',
        },
        mechanismSummary:
          'Mg nhường 2 electron cho 2H⁺, tách rời liên kết H–Cl để nối thành MgCl₂ và phân tử H₂.',
      };

    case 'agno3_nacl':
      return {
        reactionId: reaction.id,
        title: reaction.title,
        equation: reaction.balancedEquation,
        hasReaction: true,
        requiresHeat: false,
        // 0: Ag, 1: O1, 2: N, 3: O2, 4: O3, 5: Na, 6: Cl
        atoms: [
          { element: 'Ag', label: 'Ag⁺', startPos: [-2.4, 0, 0], midPos: [-0.8, 0.3, 0], endPos: [-1.8, 0, 0] },
          { element: 'O', startPos: [-1.3, 0, 0], midPos: [-0.2, -0.7, 0], endPos: [1.2, 0, 0] },
          { element: 'N', label: 'N', startPos: [-0.4, 0, 0], midPos: [0.6, -0.9, 0], endPos: [2.1, 0, 0] },
          { element: 'O', startPos: [0.2, 0.85, 0], midPos: [1.1, -0.2, 0.5], endPos: [2.7, 0.85, 0] },
          { element: 'O', startPos: [0.2, -0.85, 0], midPos: [1.1, -1.6, -0.5], endPos: [2.7, -0.85, 0] },
          { element: 'Na', label: 'Na⁺', startPos: [2.6, 0.9, 0], midPos: [1.3, 0.9, 0], endPos: [0.2, 0, 0] },
          { element: 'Cl', label: 'Cl⁻', startPos: [1.5, 0.9, 0], midPos: [0.1, 0.8, 0], endPos: [-2.95, 0, 0] },
        ],
        oldBonds: [
          { from: 0, to: 1, order: 1 }, // Ag - ONO2 breaks
          { from: 1, to: 2, order: 1, staysIntact: true },
          { from: 2, to: 3, order: 2, staysIntact: true },
          { from: 2, to: 4, order: 1, staysIntact: true },
          { from: 5, to: 6, order: 1 }, // Na - Cl breaks
        ],
        newBonds: [
          { from: 0, to: 6, order: 1 }, // Ag - Cl
          { from: 5, to: 1, order: 1 }, // Na - ONO2
        ],
        stages: {
          approach: 'Cặp ion AgNO₃ và NaCl tiến lại gần nhau.',
          breaking: 'Liên kết Ag⁺–NO₃⁻ và Na⁺–Cl⁻ đứt rời, giải phóng ion tự do.',
          forming: 'Ag⁺ kết hợp trực tiếp với Cl⁻ tạo mạng tinh thể AgCl; Na⁺ ghép với NO₃⁻.',
          complete: 'Hình thành kết tủa trắng AgCl↓ và dung dịch NaNO₃.',
        },
        mechanismSummary:
          'Nhóm NO₃⁻ giữ nguyên cấu trúc phẳng tam giác; Ag⁺ đổi chỗ cho Na⁺ để tạo liên kết bền Ag–Cl.',
      };

    case 'pbno32_ki':
      return {
        reactionId: reaction.id,
        title: reaction.title,
        equation: reaction.balancedEquation,
        hasReaction: true,
        requiresHeat: false,
        // 0: Pb, 1..4: NO3 #1 (1=O,2=N,3=O,4=O), 5..8: NO3 #2, 9: K1, 10: I1, 11: K2, 12: I2
        atoms: [
          { element: 'Pb', label: 'Pb²⁺', startPos: [-1.8, 0, 0], midPos: [-0.4, 0, 0], endPos: [-1.8, 0, 0] },
          { element: 'O', startPos: [-2.5, 0.9, 0], midPos: [-0.9, 1.1, 0.4], endPos: [1.3, 1.1, 0] },
          { element: 'N', label: 'N', startPos: [-3.1, 1.6, 0], midPos: [-1.4, 1.8, 0.4], endPos: [2.2, 1.1, 0] },
          { element: 'O', startPos: [-3.9, 1.4, 0], midPos: [-2.1, 1.6, 0.4], endPos: [2.8, 1.8, 0] },
          { element: 'O', startPos: [-2.9, 2.5, 0], midPos: [-1.2, 2.6, 0.4], endPos: [2.8, 0.4, 0] },

          { element: 'O', startPos: [-2.5, -0.9, 0], midPos: [-0.9, -1.1, -0.4], endPos: [1.3, -1.1, 0] },
          { element: 'N', label: 'N', startPos: [-3.1, -1.6, 0], midPos: [-1.4, -1.8, -0.4], endPos: [2.2, -1.1, 0] },
          { element: 'O', startPos: [-3.9, -1.4, 0], midPos: [-2.1, -1.6, -0.4], endPos: [2.8, -0.4, 0] },
          { element: 'O', startPos: [-2.9, -2.5, 0], midPos: [-1.2, -2.6, -0.4], endPos: [2.8, -1.8, 0] },

          { element: 'K', label: 'K⁺', startPos: [2.6, 1.1, 0], midPos: [1.2, 1.0, 0], endPos: [0.35, 1.1, 0] },
          { element: 'I', label: 'I⁻', startPos: [1.4, 1.1, 0], midPos: [0.3, 0.55, 0], endPos: [-2.85, 0.8, 0] },
          { element: 'K', label: 'K⁺', startPos: [2.6, -1.1, 0], midPos: [1.2, -1.0, 0], endPos: [0.35, -1.1, 0] },
          { element: 'I', label: 'I⁻', startPos: [1.4, -1.1, 0], midPos: [0.3, -0.55, 0], endPos: [-2.85, -0.8, 0] },
        ],
        oldBonds: [
          { from: 0, to: 1, order: 1 }, // Pb-NO3 breaks
          { from: 1, to: 2, order: 1, staysIntact: true },
          { from: 2, to: 3, order: 2, staysIntact: true },
          { from: 2, to: 4, order: 1, staysIntact: true },
          { from: 0, to: 5, order: 1 }, // Pb-NO3 breaks
          { from: 5, to: 6, order: 1, staysIntact: true },
          { from: 6, to: 7, order: 2, staysIntact: true },
          { from: 6, to: 8, order: 1, staysIntact: true },
          { from: 9, to: 10, order: 1 }, // K-I breaks
          { from: 11, to: 12, order: 1 }, // K-I breaks
        ],
        newBonds: [
          { from: 0, to: 10, order: 1 }, // Pb-I1
          { from: 0, to: 12, order: 1 }, // Pb-I2
          { from: 9, to: 1, order: 1 }, // K1-NO3
          { from: 11, to: 5, order: 1 }, // K2-NO3
        ],
        stages: {
          approach: 'Pb(NO₃)₂ và 2 phân tử KI khuếch tán lại gần nhau.',
          breaking: 'Liên kết giữa Pb²⁺ với 2 gốc NO₃⁻ và giữa K⁺–I⁻ đứt gãy.',
          forming: 'Ion Pb²⁺ nối trực tiếp với 2 ion I⁻ thành tinh thể PbI₂; 2 K⁺ ghép với NO₃⁻.',
          complete: 'Tạo vảy tinh thể vàng rực PbI₂↓ ("Mưa vàng") và 2KNO₃ tan.',
        },
        mechanismSummary:
          'Ion Pb²⁺ trao đổi phối trí với 2 ion I⁻ tạo kết tủa PbI₂ màu vàng óng, trong khi nhóm NO₃⁻ chuyển sang liên kết với K⁺.',
      };

    case 'bacl2_h2so4':
      return {
        reactionId: reaction.id,
        title: reaction.title,
        equation: reaction.balancedEquation,
        hasReaction: true,
        requiresHeat: false,
        // 0: Ba, 1: Cl1, 2: Cl2, 3: S, 4..7: O (SO4), 8: H1, 9: H2
        atoms: [
          { element: 'Ba', label: 'Ba²⁺', startPos: [-2.2, 0, 0], midPos: [-0.8, 0, 0], endPos: [-2.0, 0, 0] },
          { element: 'Cl', label: 'Cl⁻', startPos: [-2.9, 1.0, 0], midPos: [-0.3, 1.1, 0], endPos: [2.4, 0.85, 0] },
          { element: 'Cl', label: 'Cl⁻', startPos: [-2.9, -1.0, 0], midPos: [-0.3, -1.1, 0], endPos: [2.4, -0.85, 0] },
          { element: 'S', label: 'S', startPos: [2.0, 0, 0], midPos: [0.8, 0, 0], endPos: [-0.3, 0, 0] },
          { element: 'O', startPos: [1.15, 0.75, 0], midPos: [0.1, 0.65, 0], endPos: [-1.05, 0.65, 0] },
          { element: 'O', startPos: [1.15, -0.75, 0], midPos: [0.1, -0.65, 0], endPos: [-1.05, -0.65, 0] },
          { element: 'O', startPos: [2.8, 0.75, 0], midPos: [1.5, 0.65, 0.4], endPos: [0.45, 0.65, 0.4] },
          { element: 'O', startPos: [2.8, -0.75, 0], midPos: [1.5, -0.65, -0.4], endPos: [0.45, -0.65, -0.4] },
          { element: 'H', label: 'H⁺', startPos: [1.15, 1.5, 0], midPos: [0.5, 1.35, 0], endPos: [1.4, 0.85, 0] },
          { element: 'H', label: 'H⁺', startPos: [1.15, -1.5, 0], midPos: [0.5, -1.35, 0], endPos: [1.4, -0.85, 0] },
        ],
        oldBonds: [
          { from: 0, to: 1, order: 1 }, // Ba-Cl1
          { from: 0, to: 2, order: 1 }, // Ba-Cl2
          { from: 3, to: 4, order: 1, staysIntact: true },
          { from: 3, to: 5, order: 1, staysIntact: true },
          { from: 3, to: 6, order: 2, staysIntact: true },
          { from: 3, to: 7, order: 2, staysIntact: true },
          { from: 4, to: 8, order: 1 }, // O-H1 breaks
          { from: 5, to: 9, order: 1 }, // O-H2 breaks
        ],
        newBonds: [
          { from: 0, to: 4, order: 1 }, // Ba-O
          { from: 0, to: 5, order: 1 }, // Ba-O
          { from: 8, to: 1, order: 1 }, // H1-Cl1
          { from: 9, to: 2, order: 1 }, // H2-Cl2
        ],
        stages: {
          approach: 'BaCl₂ và phân tử axit H₂SO₄ tiến lại gần nhau.',
          breaking: 'Liên kết Ba–Cl và hai liên kết O–H bị cắt đứt hoàn toàn.',
          forming: 'Ba²⁺ gắn chặt với nhóm SO₄²⁻; 2 H⁺ nối với 2 Cl⁻ tạo 2 phân tử HCl.',
          complete: 'Tạo kết tủa trắng mịn BaSO₄↓ không tan và 2HCl.',
        },
        mechanismSummary:
          'Nhóm SO₄²⁻ tách 2 nguyên tử H để liên kết bền vững với Ba²⁺, đồng thời 2 H⁺ kết hợp với 2 Cl⁻.',
      };

    case 'caco3_hcl':
      return {
        reactionId: reaction.id,
        title: reaction.title,
        equation: reaction.balancedEquation,
        hasReaction: true,
        requiresHeat: false,
        // 0: Ca, 1: C, 2: O(double), 3: O1, 4: O2, 5: H1, 6: Cl1, 7: H2, 8: Cl2
        atoms: [
          { element: 'Ca', label: 'Ca²⁺', startPos: [-2.6, 0, 0], midPos: [-1.1, 0, 0], endPos: [-2.0, 0.6, 0] },
          { element: 'C', label: 'C', startPos: [-0.9, 0, 0], midPos: [0.1, 0, 0], endPos: [1.5, 0.8, 0] },
          { element: 'O', startPos: [-0.1, 0, 0], midPos: [0.8, 0.1, 0], endPos: [2.5, 0.8, 0] },
          { element: 'O', startPos: [-1.5, 0.9, 0], midPos: [-0.2, 0.95, 0], endPos: [0.5, 0.8, 0] },
          { element: 'O', startPos: [-1.5, -0.9, 0], midPos: [0.3, -0.95, 0], endPos: [1.5, -1.0, 0] },
          { element: 'H', label: 'H', startPos: [1.5, -0.9, 0], midPos: [0.8, -0.45, 0], endPos: [0.9, -1.45, 0] },
          { element: 'Cl', label: 'Cl', startPos: [2.5, -0.9, 0], midPos: [-0.5, -1.2, 0], endPos: [-2.9, -0.2, 0] },
          { element: 'H', label: 'H', startPos: [1.5, 1.1, 0], midPos: [0.8, -1.4, 0], endPos: [2.1, -1.45, 0] },
          { element: 'Cl', label: 'Cl', startPos: [2.5, 1.1, 0], midPos: [-0.5, 1.2, 0], endPos: [-2.9, 1.4, 0] },
        ],
        oldBonds: [
          { from: 0, to: 3, order: 1 }, // Ca-O breaks
          { from: 0, to: 4, order: 1 }, // Ca-O breaks
          { from: 1, to: 2, order: 2, staysIntact: true },
          { from: 1, to: 3, order: 1, staysIntact: true },
          { from: 1, to: 4, order: 1 }, // C-O(4) breaks to form H2O + CO2!
          { from: 5, to: 6, order: 1 }, // H1-Cl1 breaks
          { from: 7, to: 8, order: 1 }, // H2-Cl2 breaks
        ],
        newBonds: [
          { from: 0, to: 6, order: 1 }, // Ca-Cl1
          { from: 0, to: 8, order: 1 }, // Ca-Cl2
          { from: 1, to: 3, order: 2 }, // C=O(3) -> CO2 linear
          { from: 4, to: 5, order: 1 }, // H-O
          { from: 4, to: 7, order: 1 }, // O-H
        ],
        stages: {
          approach: 'Đá vôi CaCO₃ tiếp xúc với 2 phân tử axit HCl.',
          breaking: 'Liên kết Ca–O, H–Cl và một liên kết C–O trong gốc CO₃²⁻ bị phân cắt.',
          forming: 'Ca²⁺ nối 2 Cl⁻ thành CaCl₂; gốc C=O còn lại thành O=C=O và O nối 2 H thành H₂O.',
          complete: 'Tạo muối CaCl₂, khí CO₂↑ (O=C=O thẳng) và phân tử nước H₂O.',
        },
        mechanismSummary:
          'Ion H⁺ tấn công một nguyên tử O của CO₃²⁻ để tách thành H₂O, phần O=C=O tách ra thành khí CO₂ thoát lên.',
      };

    case 'na2co3_hcl':
      return {
        reactionId: reaction.id,
        title: reaction.title,
        equation: reaction.balancedEquation,
        hasReaction: true,
        requiresHeat: false,
        // 0: Na1, 1: Na2, 2: C, 3: O(top), 4: O1, 5: O2, 6: H1, 7: Cl1, 8: H2, 9: Cl2
        atoms: [
          { element: 'Na', label: 'Na⁺', startPos: [-2.6, 1.0, 0], midPos: [-1.2, 1.1, 0], endPos: [-2.4, 0.9, 0] },
          { element: 'Na', label: 'Na⁺', startPos: [-2.6, -1.0, 0], midPos: [-1.2, -1.1, 0], endPos: [-2.4, -0.9, 0] },
          { element: 'C', label: 'C', startPos: [-0.7, 0, 0], midPos: [0.1, 0.3, 0], endPos: [1.5, 0.85, 0] },
          { element: 'O', startPos: [0.2, 0, 0], midPos: [0.9, 0.3, 0], endPos: [2.5, 0.85, 0] },
          { element: 'O', startPos: [-1.4, 0.85, 0], midPos: [-0.4, 0.95, 0], endPos: [0.5, 0.85, 0] },
          { element: 'O', startPos: [-1.4, -0.85, 0], midPos: [0.3, -0.85, 0], endPos: [1.5, -1.05, 0] },
          { element: 'H', label: 'H', startPos: [1.5, 0.9, 0], midPos: [0.8, -0.4, 0], endPos: [0.95, -1.5, 0] },
          { element: 'Cl', label: 'Cl', startPos: [2.5, 0.9, 0], midPos: [-0.3, 1.25, 0], endPos: [-1.3, 0.9, 0] },
          { element: 'H', label: 'H', startPos: [1.5, -0.9, 0], midPos: [0.8, -1.3, 0], endPos: [2.05, -1.5, 0] },
          { element: 'Cl', label: 'Cl', startPos: [2.5, -0.9, 0], midPos: [-0.3, -1.25, 0], endPos: [-1.3, -0.9, 0] },
        ],
        oldBonds: [
          { from: 0, to: 4, order: 1 },
          { from: 1, to: 5, order: 1 },
          { from: 2, to: 3, order: 2, staysIntact: true },
          { from: 2, to: 4, order: 1, staysIntact: true },
          { from: 2, to: 5, order: 1 },
          { from: 6, to: 7, order: 1 },
          { from: 8, to: 9, order: 1 },
        ],
        newBonds: [
          { from: 0, to: 7, order: 1 },
          { from: 1, to: 9, order: 1 },
          { from: 2, to: 4, order: 2 },
          { from: 5, to: 6, order: 1 },
          { from: 5, to: 8, order: 1 },
        ],
        stages: {
          approach: 'Na₂CO₃ tiếp cận 2 phân tử HCl.',
          breaking: 'Liên kết Na–O, H–Cl và 1 liên kết C–O bị đứt rời.',
          forming: 'Na⁺ ghép với Cl⁻ thành 2 NaCl; O tách khỏi C nối với 2H thành H₂O và CO₂.',
          complete: 'Tạo 2NaCl, khí CO₂↑ và nước H₂O.',
        },
        mechanismSummary:
          'H⁺ lấy một O từ CO₃²⁻ tạo H₂O, giải phóng phân tử CO₂ thẳng hàng và 2 cặp Na⁺Cl⁻.',
      };

    case 'na_h2o':
      return {
        reactionId: reaction.id,
        title: reaction.title,
        equation: reaction.balancedEquation,
        hasReaction: true,
        requiresHeat: false,
        // 0: Na1, 1: Na2, 2: O1, 3: H1a, 4: H1b, 5: O2, 6: H2a, 7: H2b
        atoms: [
          { element: 'Na', label: 'Na', startPos: [-2.3, 0.85, 0], midPos: [-0.9, 0.8, 0], endPos: [-2.2, 0.9, 0] },
          { element: 'Na', label: 'Na', startPos: [-2.3, -0.85, 0], midPos: [-0.9, -0.8, 0], endPos: [-2.2, -0.9, 0] },
          { element: 'O', label: 'O', startPos: [1.6, 0.9, 0], midPos: [0.4, 0.9, 0], endPos: [-1.0, 0.9, 0] },
          { element: 'H', startPos: [2.2, 1.4, 0], midPos: [0.9, 1.4, 0], endPos: [-0.3, 1.25, 0] },
          { element: 'H', label: 'H', startPos: [1.0, 0.45, 0], midPos: [0.4, 0.35, 0], endPos: [1.8, 0.45, 0] },
          { element: 'O', label: 'O', startPos: [1.6, -0.9, 0], midPos: [0.4, -0.9, 0], endPos: [-1.0, -0.9, 0] },
          { element: 'H', startPos: [2.2, -1.4, 0], midPos: [0.9, -1.4, 0], endPos: [-0.3, -1.25, 0] },
          { element: 'H', label: 'H', startPos: [1.0, -0.45, 0], midPos: [0.4, -0.35, 0], endPos: [1.8, -0.45, 0] },
        ],
        oldBonds: [
          { from: 2, to: 3, order: 1, staysIntact: true },
          { from: 2, to: 4, order: 1 }, // O1-H1b breaks
          { from: 5, to: 6, order: 1, staysIntact: true },
          { from: 5, to: 7, order: 1 }, // O2-H2b breaks
        ],
        newBonds: [
          { from: 0, to: 2, order: 1 }, // Na1-OH
          { from: 1, to: 5, order: 1 }, // Na2-OH
          { from: 4, to: 7, order: 1 }, // H-H gas
        ],
        stages: {
          approach: '2 nguyên tử Na tiến nhanh vào 2 phân tử H₂O.',
          breaking: 'Mỗi phân tử H₂O bị tách đứt 1 liên kết O–H linh động.',
          forming: 'Na⁺ ghép với gốc OH⁻ thành 2 NaOH; 2 nguyên tử H tự do nối đôi thành H₂.',
          complete: 'Tạo kiềm NaOH làm hồng phenolphthalein và sủi bọt khí H₂↑.',
        },
        mechanismSummary:
          'Kim loại kiềm Na nhường electron phá vỡ 1 liên kết O–H trong mỗi phân tử nước, giải phóng khí H₂.',
      };

    case 'zn_cuso4':
      return {
        reactionId: reaction.id,
        title: reaction.title,
        equation: reaction.balancedEquation,
        hasReaction: true,
        requiresHeat: false,
        // 0: Zn, 1: Cu, 2: S, 3..6: O(SO4)
        atoms: [
          { element: 'Zn', label: 'Zn', startPos: [-2.6, 0, 0], midPos: [-0.8, 0.8, 0], endPos: [-1.1, 0, 0] },
          { element: 'Cu', label: 'Cu', startPos: [0.3, 0, 0], midPos: [-0.8, -0.8, 0], endPos: [-2.9, -0.2, 0] },
          { element: 'S', label: 'S', startPos: [2.0, 0, 0], midPos: [1.1, 0, 0], endPos: [1.2, 0, 0] },
          { element: 'O', startPos: [1.15, 0.8, 0], midPos: [0.3, 0.75, 0], endPos: [0.3, 0.75, 0] },
          { element: 'O', startPos: [1.15, -0.8, 0], midPos: [0.3, -0.75, 0], endPos: [0.3, -0.75, 0] },
          { element: 'O', startPos: [2.85, 0.8, 0.3], midPos: [1.95, 0.75, 0.3], endPos: [2.05, 0.75, 0.3] },
          { element: 'O', startPos: [2.85, -0.8, -0.3], midPos: [1.95, -0.75, -0.3], endPos: [2.05, -0.75, -0.3] },
        ],
        oldBonds: [
          { from: 2, to: 3, order: 1, staysIntact: true },
          { from: 2, to: 4, order: 1, staysIntact: true },
          { from: 2, to: 5, order: 2, staysIntact: true },
          { from: 2, to: 6, order: 2, staysIntact: true },
          { from: 1, to: 3, order: 1 }, // Cu-O breaks
          { from: 1, to: 4, order: 1 }, // Cu-O breaks
        ],
        newBonds: [
          { from: 0, to: 3, order: 1 }, // Zn-O
          { from: 0, to: 4, order: 1 }, // Zn-O
        ],
        stages: {
          approach: 'Nguyên tử Zn (tính khử mạnh hơn) tiếp cận muối CuSO₄.',
          breaking: 'Ion Cu²⁺ nhận 2e tách rời khỏi nhóm SO₄²⁻ để khử về kim loại Cu.',
          forming: 'Ion Zn²⁺ tạo thành liên kết phối trí mới với nhóm SO₄²⁻ tạo ZnSO₄.',
          complete: 'Kim loại Cu đỏ cam tách ra lắng xuống, dung dịch còn lại là ZnSO₄ không màu.',
        },
        mechanismSummary:
          'Trao đổi electron trực tiếp: Zn nhường 2e cho Cu²⁺, đẩy Cu ra khỏi gốc sunfat SO₄²⁻.',
      };

    case 'ch3cooh_c2h5oh':
      return {
        reactionId: reaction.id,
        title: reaction.title,
        equation: reaction.balancedEquation,
        hasReaction: true,
        requiresHeat: true,
        // CH3COOH: 0:C(methyl), 1:H, 2:H, 3:H, 4:C(carbonyl), 5:O(=), 6:O(-OH), 7:H(acid)
        // C2H5OH: 8:O(eth), 9:H(alc), 10:C(CH2), 11:H, 12:H, 13:C(CH3), 14:H, 15:H, 16:H
        atoms: [
          { element: 'C', label: 'C', startPos: [-3.1, 0.2, 0], midPos: [-2.2, 0.2, 0], endPos: [-2.7, 0.2, 0] },
          { element: 'H', startPos: [-3.6, 0.95, 0.4], midPos: [-2.7, 0.95, 0.4], endPos: [-3.2, 0.95, 0.4] },
          { element: 'H', startPos: [-3.6, -0.25, -0.75], midPos: [-2.7, -0.25, -0.75], endPos: [-3.2, -0.25, -0.75] },
          { element: 'H', startPos: [-3.6, -0.35, 0.7], midPos: [-2.7, -0.35, 0.7], endPos: [-3.2, -0.35, 0.7] },
          { element: 'C', label: 'C=O', startPos: [-1.8, 0.2, 0], midPos: [-0.9, 0.2, 0], endPos: [-1.4, 0.2, 0] },
          { element: 'O', label: 'O', startPos: [-1.2, 1.25, 0], midPos: [-0.4, 1.25, 0], endPos: [-0.9, 1.25, 0] },
          { element: 'O', label: 'OH(axit)', startPos: [-1.15, -0.8, 0], midPos: [0.1, -1.15, 0], endPos: [2.8, -1.25, 0] },
          { element: 'H', startPos: [-0.45, -1.2, 0], midPos: [0.7, -1.65, 0], endPos: [3.45, -1.65, 0] },

          { element: 'O', label: 'O(ancol)', startPos: [1.1, 0.4, 0], midPos: [0.3, 0.35, 0], endPos: [-0.35, -0.55, 0] },
          { element: 'H', label: 'H(ancol)', startPos: [0.55, -0.25, 0.3], midPos: [0.25, -0.4, 0.3], endPos: [2.15, -1.65, 0] },
          { element: 'C', label: 'C', startPos: [2.25, 0.8, 0], midPos: [1.45, 0.7, 0], endPos: [0.8, -0.1, 0] },
          { element: 'H', startPos: [2.25, 1.45, 0.65], midPos: [1.45, 1.35, 0.65], endPos: [0.8, 0.55, 0.65] },
          { element: 'H', startPos: [2.25, 1.45, -0.65], midPos: [1.45, 1.35, -0.65], endPos: [0.8, 0.55, -0.65] },
          { element: 'C', label: 'C', startPos: [3.45, 0.1, 0], midPos: [2.65, 0.0, 0], endPos: [2.0, -0.75, 0] },
          { element: 'H', startPos: [4.2, 0.6, 0.4], midPos: [3.4, 0.5, 0.4], endPos: [2.75, -0.25, 0.4] },
          { element: 'H', startPos: [3.6, -0.65, 0.55], midPos: [2.8, -0.75, 0.55], endPos: [2.15, -1.5, 0.55] },
          { element: 'H', startPos: [3.6, -0.45, -0.7], midPos: [2.8, -0.55, -0.7], endPos: [2.15, -1.3, -0.7] },
        ],
        oldBonds: [
          { from: 0, to: 1, order: 1, staysIntact: true },
          { from: 0, to: 2, order: 1, staysIntact: true },
          { from: 0, to: 3, order: 1, staysIntact: true },
          { from: 0, to: 4, order: 1, staysIntact: true },
          { from: 4, to: 5, order: 2, staysIntact: true },
          { from: 4, to: 6, order: 1 }, // C - OH of acid breaks!
          { from: 6, to: 7, order: 1, staysIntact: true },
          { from: 8, to: 9, order: 1 }, // O - H of alcohol breaks!
          { from: 8, to: 10, order: 1, staysIntact: true },
          { from: 10, to: 11, order: 1, staysIntact: true },
          { from: 10, to: 12, order: 1, staysIntact: true },
          { from: 10, to: 13, order: 1, staysIntact: true },
          { from: 13, to: 14, order: 1, staysIntact: true },
          { from: 13, to: 15, order: 1, staysIntact: true },
          { from: 13, to: 16, order: 1, staysIntact: true },
        ],
        newBonds: [
          { from: 4, to: 8, order: 1 }, // C(=O) - O(C2H5) ester bond!
          { from: 6, to: 9, order: 1 }, // OH(acid) - H(alcohol) -> H2O!
        ],
        stages: {
          approach: 'CH₃COOH và C₂H₅OH tiếp cận dưới xúc tác axit H⁺ và đun nóng (60–70°C).',
          breaking: 'Nhóm –OH tách khỏi gốc axit CH₃CO–; nguyên tử –H tách khỏi nhóm –OH của ancol.',
          forming: 'Nguyên tử O của ancol nối trực tiếp vào C=O tạo liên kết este; –OH ghép với –H thành H₂O.',
          complete: 'Hoàn tất phân tử este Etyl axetat (CH₃COOC₂H₅) mùi thơm và nước H₂O.',
        },
        mechanismSummary:
          'Cơ chế este hóa chuẩn SGK KNTT 12: tách nhóm –OH của axit cacboxylic kết hợp với –H của ancol tạo H₂O.',
      };

    case 'cuo_h2so4':
      return {
        reactionId: reaction.id,
        title: reaction.title,
        equation: reaction.balancedEquation,
        hasReaction: true,
        requiresHeat: true,
        // 0: Cu, 1: O(CuO), 2: S, 3: O1, 4: O2, 5: O3, 6: O4, 7: H1, 8: H2
        atoms: [
          { element: 'Cu', label: 'Cu', startPos: [-2.6, 0.2, 0], midPos: [-0.9, 0.2, 0], endPos: [-2.0, 0.2, 0] },
          { element: 'O', label: 'O', startPos: [-1.5, 0.2, 0], midPos: [-0.1, -1.0, 0], endPos: [2.2, -1.0, 0] },
          { element: 'S', label: 'S', startPos: [1.8, 0.2, 0], midPos: [0.9, 0.4, 0], endPos: [-0.1, 0.2, 0] },
          { element: 'O', startPos: [1.0, 0.9, 0], midPos: [0.1, 1.0, 0], endPos: [-0.9, 0.85, 0] },
          { element: 'O', startPos: [1.0, -0.5, 0], midPos: [0.1, -0.2, 0], endPos: [-0.9, -0.45, 0] },
          { element: 'O', startPos: [2.6, 0.9, 0.3], midPos: [1.7, 1.0, 0.3], endPos: [0.7, 0.85, 0.3] },
          { element: 'O', startPos: [2.6, -0.5, -0.3], midPos: [1.7, -0.2, -0.3], endPos: [0.7, -0.45, -0.3] },
          { element: 'H', label: 'H', startPos: [0.5, 1.4, 0], midPos: [-0.5, -1.5, 0.3], endPos: [1.6, -1.45, 0] },
          { element: 'H', label: 'H', startPos: [0.5, -1.0, 0], midPos: [0.4, -1.5, -0.3], endPos: [2.8, -1.45, 0] },
        ],
        oldBonds: [
          { from: 0, to: 1, order: 2 }, // Cu=O breaks
          { from: 2, to: 3, order: 1, staysIntact: true },
          { from: 2, to: 4, order: 1, staysIntact: true },
          { from: 2, to: 5, order: 2, staysIntact: true },
          { from: 2, to: 6, order: 2, staysIntact: true },
          { from: 3, to: 7, order: 1 }, // O-H1 breaks
          { from: 4, to: 8, order: 1 }, // O-H2 breaks
        ],
        newBonds: [
          { from: 0, to: 3, order: 1 }, // Cu-SO4
          { from: 0, to: 4, order: 1 }, // Cu-SO4
          { from: 1, to: 7, order: 1 }, // O-H1
          { from: 1, to: 8, order: 1 }, // O-H2
        ],
        stages: {
          approach: 'Phân tử oxit bazơ CuO và axit H₂SO₄ được đun nóng tiến lại gần nhau.',
          breaking: 'Liên kết Cu=O và 2 liên kết O–H của axit bị phá vỡ.',
          forming: 'Cu²⁺ gắn với nhóm SO₄²⁻ tạo muối xanh lam; O của oxit nối 2 H⁺ thành H₂O.',
          complete: 'CuO tan hết tạo dung dịch CuSO₄ màu xanh lam và phân tử nước H₂O.',
        },
        mechanismSummary:
          '2 ion H⁺ từ H₂SO₄ kết hợp với ion O²⁻ trong mạng CuO tạo thành H₂O, giải phóng Cu²⁺ vào dung dịch.',
      };

    case 'cucl2_naoh':
      return {
        reactionId: reaction.id,
        title: reaction.title,
        equation: reaction.balancedEquation,
        hasReaction: true,
        requiresHeat: false,
        // 0: Cu, 1: Cl1, 2: Cl2, 3: Na1, 4: O1, 5: H1, 6: Na2, 7: O2, 8: H2
        atoms: [
          { element: 'Cu', label: 'Cu²⁺', startPos: [-2.0, 0, 0], midPos: [-0.6, 0, 0], endPos: [-2.0, 0, 0] },
          { element: 'Cl', startPos: [-2.8, 0.9, 0], midPos: [0.4, 1.15, 0], endPos: [2.2, 0.9, 0] },
          { element: 'Cl', startPos: [-2.8, -0.9, 0], midPos: [0.4, -1.15, 0], endPos: [2.2, -0.9, 0] },
          { element: 'Na', label: 'Na⁺', startPos: [2.4, 1.1, 0], midPos: [1.3, 1.1, 0], endPos: [1.1, 0.9, 0] },
          { element: 'O', label: 'O', startPos: [1.3, 1.1, 0], midPos: [-0.1, 0.7, 0], endPos: [-1.15, 0.8, 0] },
          { element: 'H', startPos: [0.7, 1.6, 0], midPos: [-0.5, 1.25, 0], endPos: [-0.7, 1.4, 0] },
          { element: 'Na', label: 'Na⁺', startPos: [2.4, -1.1, 0], midPos: [1.3, -1.1, 0], endPos: [1.1, -0.9, 0] },
          { element: 'O', label: 'O', startPos: [1.3, -1.1, 0], midPos: [-0.1, -0.7, 0], endPos: [-2.85, -0.8, 0] },
          { element: 'H', startPos: [0.7, -1.6, 0], midPos: [-0.5, -1.25, 0], endPos: [-3.3, -1.4, 0] },
        ],
        oldBonds: [
          { from: 0, to: 1, order: 1 },
          { from: 0, to: 2, order: 1 },
          { from: 3, to: 4, order: 1 },
          { from: 4, to: 5, order: 1, staysIntact: true },
          { from: 6, to: 7, order: 1 },
          { from: 7, to: 8, order: 1, staysIntact: true },
        ],
        newBonds: [
          { from: 0, to: 4, order: 1 },
          { from: 0, to: 7, order: 1 },
          { from: 3, to: 1, order: 1 },
          { from: 6, to: 2, order: 1 },
        ],
        stages: {
          approach: 'CuCl₂ và 2 phân tử NaOH tiến vào vùng va chạm.',
          breaking: 'Liên kết Cu–Cl và Na–OH bị cắt rời thành các ion.',
          forming: 'Cu²⁺ gắn kết 2 nhóm OH⁻ thành Cu(OH)₂; Na⁺ cặp đôi với Cl⁻.',
          complete: 'Tạo kết tủa xanh lam Cu(OH)₂↓ và 2NaCl tan.',
        },
        mechanismSummary:
          'Trao đổi cặp ion: Cu²⁺ bắt giữ 2 nhóm OH⁻ để kết tủa, giải phóng Na⁺ kết hợp Cl⁻.',
      };

    case 'fecl3_naoh':
      return {
        reactionId: reaction.id,
        title: reaction.title,
        equation: reaction.balancedEquation,
        hasReaction: true,
        requiresHeat: false,
        // 0: Fe, 1..3: Cl, 4..6: Na1,O1,H1, 7..9: Na2,O2,H2, 10..12: Na3,O3,H3
        atoms: [
          { element: 'Fe', label: 'Fe³⁺', startPos: [-2.0, 0, 0], midPos: [-0.7, 0, 0], endPos: [-2.0, 0, 0] },
          { element: 'Cl', startPos: [-1.1, 0.9, 0], midPos: [0.3, 1.3, 0], endPos: [2.4, 1.2, 0] },
          { element: 'Cl', startPos: [-2.9, 0.8, 0], midPos: [0.3, 0.0, 0.8], endPos: [2.4, 0.0, 0] },
          { element: 'Cl', startPos: [-2.0, -1.0, 0], midPos: [0.3, -1.3, 0], endPos: [2.4, -1.2, 0] },

          { element: 'Na', startPos: [2.5, 1.4, 0], midPos: [1.3, 1.3, 0], endPos: [1.3, 1.2, 0] },
          { element: 'O', label: 'O', startPos: [1.4, 1.4, 0], midPos: [-0.2, 0.9, 0], endPos: [-1.1, 0.9, 0] },
          { element: 'H', startPos: [0.8, 1.9, 0], midPos: [-0.6, 1.4, 0], endPos: [-0.6, 1.45, 0] },

          { element: 'Na', startPos: [2.5, 0.0, 0.5], midPos: [1.3, 0.0, 0.8], endPos: [1.3, 0.0, 0] },
          { element: 'O', label: 'O', startPos: [1.4, 0.0, 0.5], midPos: [-0.2, 0.0, -0.7], endPos: [-2.9, 0.6, 0.5] },
          { element: 'H', startPos: [0.8, 0.5, 0.5], midPos: [-0.6, 0.4, -1.1], endPos: [-3.4, 1.0, 0.8] },

          { element: 'Na', startPos: [2.5, -1.4, 0], midPos: [1.3, -1.3, 0], endPos: [1.3, -1.2, 0] },
          { element: 'O', label: 'O', startPos: [1.4, -1.4, 0], midPos: [-0.2, -0.9, 0], endPos: [-2.0, -1.1, -0.3] },
          { element: 'H', startPos: [0.8, -1.9, 0], midPos: [-0.6, -1.4, 0], endPos: [-2.0, -1.7, -0.6] },
        ],
        oldBonds: [
          { from: 0, to: 1, order: 1 },
          { from: 0, to: 2, order: 1 },
          { from: 0, to: 3, order: 1 },
          { from: 4, to: 5, order: 1 },
          { from: 5, to: 6, order: 1, staysIntact: true },
          { from: 7, to: 8, order: 1 },
          { from: 8, to: 9, order: 1, staysIntact: true },
          { from: 10, to: 11, order: 1 },
          { from: 11, to: 12, order: 1, staysIntact: true },
        ],
        newBonds: [
          { from: 0, to: 5, order: 1 },
          { from: 0, to: 8, order: 1 },
          { from: 0, to: 11, order: 1 },
          { from: 4, to: 1, order: 1 },
          { from: 7, to: 2, order: 1 },
          { from: 10, to: 3, order: 1 },
        ],
        stages: {
          approach: 'FeCl₃ tiến lại gần 3 phân tử kiềm NaOH.',
          breaking: 'Cả 3 liên kết Fe–Cl và 3 liên kết Na–OH đồng loạt tách rời.',
          forming: 'Ion Fe³⁺ kết hợp với cả 3 nhóm OH⁻ tạo Fe(OH)₃; 3 Na⁺ ghép với 3 Cl⁻.',
          complete: 'Kết tủa nâu đỏ Fe(OH)₃↓ lắng xuống, tạo 3NaCl tan.',
        },
        mechanismSummary:
          'Fe³⁺ hóa trị III cần 3 nhóm OH⁻ để trung hòa điện tích, thay thế hoàn toàn 3 nguyên tử Cl.',
      };

    case 'cuso4_nh3':
      return {
        reactionId: reaction.id,
        title: reaction.title,
        equation: reaction.balancedEquation,
        hasReaction: true,
        requiresHeat: false,
        // 0: Cu, 1: S, 2..5: O(SO4), 6..9: N of 4 NH3 (with 3 H each -> simplify or keep 4 N + 8 H -> wait keep 4 N + 12 H = 22 atoms total!)
        atoms: [
          { element: 'Cu', label: 'Cu²⁺', startPos: [-2.2, 0, 0], midPos: [-0.5, 0, 0], endPos: [-1.4, 0, 0] },
          { element: 'S', label: 'S', startPos: [-3.5, 0, 0], midPos: [2.2, 0, 0], endPos: [2.7, 0, 0] },
          { element: 'O', startPos: [-2.8, 0.7, 0], midPos: [1.5, 0.7, 0], endPos: [2.0, 0.7, 0] },
          { element: 'O', startPos: [-2.8, -0.7, 0], midPos: [1.5, -0.7, 0], endPos: [2.0, -0.7, 0] },
          { element: 'O', startPos: [-4.2, 0.7, 0.3], midPos: [2.9, 0.7, 0.3], endPos: [3.4, 0.7, 0.3] },
          { element: 'O', startPos: [-4.2, -0.7, -0.3], midPos: [2.9, -0.7, -0.3], endPos: [3.4, -0.7, -0.3] },

          // NH3 #1 (top)
          { element: 'N', label: 'N', startPos: [1.3, 1.5, 0], midPos: [-0.5, 1.35, 0], endPos: [-1.4, 1.25, 0] },
          { element: 'H', startPos: [1.7, 2.1, 0.3], midPos: [-0.1, 1.95, 0.3], endPos: [-1.0, 1.85, 0.3] },
          { element: 'H', startPos: [0.9, 2.1, -0.3], midPos: [-0.9, 1.95, -0.3], endPos: [-1.8, 1.85, -0.3] },

          // NH3 #2 (bottom)
          { element: 'N', label: 'N', startPos: [1.3, -1.5, 0], midPos: [-0.5, -1.35, 0], endPos: [-1.4, -1.25, 0] },
          { element: 'H', startPos: [1.7, -2.1, 0.3], midPos: [-0.1, -1.95, 0.3], endPos: [-1.0, -1.85, 0.3] },
          { element: 'H', startPos: [0.9, -2.1, -0.3], midPos: [-0.9, -1.95, -0.3], endPos: [-1.8, -1.85, -0.3] },

          // NH3 #3 (front Z)
          { element: 'N', label: 'N', startPos: [2.4, 0.3, 1.2], midPos: [-0.5, 0, 1.35], endPos: [-1.4, 0, 1.25] },
          { element: 'H', startPos: [2.8, 0.6, 1.7], midPos: [-0.1, 0.4, 1.85], endPos: [-1.0, 0.4, 1.75] },
          { element: 'H', startPos: [2.0, 0.0, 1.7], midPos: [-0.9, -0.4, 1.85], endPos: [-1.8, -0.4, 1.75] },

          // NH3 #4 (back Z)
          { element: 'N', label: 'N', startPos: [2.4, -0.3, -1.2], midPos: [-0.5, 0, -1.35], endPos: [-1.4, 0, -1.25] },
          { element: 'H', startPos: [2.8, 0.0, -1.7], midPos: [-0.1, 0.4, -1.85], endPos: [-1.0, 0.4, -1.75] },
          { element: 'H', startPos: [2.0, -0.6, -1.7], midPos: [-0.9, -0.4, -1.85], endPos: [-1.8, -0.4, -1.75] },
        ],
        oldBonds: [
          { from: 1, to: 2, order: 1, staysIntact: true },
          { from: 1, to: 3, order: 1, staysIntact: true },
          { from: 1, to: 4, order: 2, staysIntact: true },
          { from: 1, to: 5, order: 2, staysIntact: true },
          { from: 0, to: 2, order: 1 }, // Cu-SO4 detaches
          { from: 0, to: 3, order: 1 },
          { from: 6, to: 7, order: 1, staysIntact: true },
          { from: 6, to: 8, order: 1, staysIntact: true },
          { from: 9, to: 10, order: 1, staysIntact: true },
          { from: 9, to: 11, order: 1, staysIntact: true },
          { from: 12, to: 13, order: 1, staysIntact: true },
          { from: 12, to: 14, order: 1, staysIntact: true },
          { from: 15, to: 16, order: 1, staysIntact: true },
          { from: 15, to: 17, order: 1, staysIntact: true },
        ],
        newBonds: [
          { from: 0, to: 6, order: 1 },
          { from: 0, to: 9, order: 1 },
          { from: 0, to: 12, order: 1 },
          { from: 0, to: 15, order: 1 },
        ],
        stages: {
          approach: '4 phối tử NH₃ tiến bao quanh ion trung tâm Cu²⁺ của muối CuSO₄.',
          breaking: 'Gốc SO₄²⁻ rời khỏi cầu nội để nhường chỗ phối trí xung quanh Cu²⁺.',
          forming: '4 nguyên tử N cho cặp electron chưa liên kết tạo 4 liên kết cho–nhận với Cu²⁺.',
          complete: 'Hình thành ion phức vuông phẳng [Cu(NH₃)₄]²⁺ màu xanh lam thẫm.',
        },
        mechanismSummary:
          'Phản ứng tạo phức chất (Hóa 12 KNTT): liên kết phối trí N→Cu được hình thành mà không phá vỡ phân tử NH₃.',
      };

    case 'al_naoh':
      return {
        reactionId: reaction.id,
        title: reaction.title,
        equation: reaction.balancedEquation,
        hasReaction: true,
        requiresHeat: false,
        // Single unit: Al + NaOH + H2O -> NaAlO2 + 1.5 H2 (or 2Al + 2NaOH + 2H2O -> 2NaAlO2 + 3H2)
        // Use 2Al + 2NaOH + 2H2O (14 atoms):
        // 0: Al1, 1: Al2, 2: Na1, 3: O1, 4: H1, 5: Na2, 6: O2, 7: H2, 8: O3, 9: H3a, 10: H3b, 11: O4, 12: H4a, 13: H4b
        atoms: [
          { element: 'Al', label: 'Al', startPos: [-2.6, 0.7, 0], midPos: [-0.8, 0.7, 0], endPos: [-2.0, 0.8, 0] },
          { element: 'Al', label: 'Al', startPos: [-2.6, -0.7, 0], midPos: [-0.8, -0.7, 0], endPos: [-2.0, -0.8, 0] },

          { element: 'Na', label: 'Na', startPos: [1.8, 1.3, 0], midPos: [0.3, 1.3, 0], endPos: [-3.1, 0.8, 0] },
          { element: 'O', startPos: [0.9, 1.3, 0], midPos: [-0.3, 0.9, 0.4], endPos: [-1.15, 0.8, 0.5] },
          { element: 'H', startPos: [0.4, 1.8, 0], midPos: [0.8, 0.6, 0.5], endPos: [2.0, 1.1, 0] },

          { element: 'Na', label: 'Na', startPos: [1.8, -1.3, 0], midPos: [0.3, -1.3, 0], endPos: [-3.1, -0.8, 0] },
          { element: 'O', startPos: [0.9, -1.3, 0], midPos: [-0.3, -0.9, -0.4], endPos: [-1.15, -0.8, -0.5] },
          { element: 'H', startPos: [0.4, -1.8, 0], midPos: [0.8, -0.6, -0.5], endPos: [2.0, 0.4, 0] },

          { element: 'O', startPos: [2.2, 0.5, 0.7], midPos: [0.1, 0.3, -0.5], endPos: [-1.15, 0.8, -0.5] },
          { element: 'H', startPos: [2.8, 0.8, 0.7], midPos: [1.2, 0.1, 0.4], endPos: [2.0, -0.4, 0] },
          { element: 'H', startPos: [1.7, 0.1, 0.9], midPos: [1.2, 0.1, -0.4], endPos: [2.0, -1.1, 0] },

          { element: 'O', startPos: [2.2, -0.5, -0.7], midPos: [0.1, -0.3, 0.5], endPos: [-1.15, -0.8, 0.5] },
          { element: 'H', startPos: [2.8, -0.8, -0.7], midPos: [1.2, 1.1, 0], endPos: [2.75, 1.1, 0] },
          { element: 'H', startPos: [1.7, -0.1, -0.9], midPos: [1.2, -1.1, 0], endPos: [2.75, -1.1, 0] },
        ],
        oldBonds: [
          { from: 0, to: 1, order: 1 }, // Al-Al metallic breaks
          { from: 2, to: 3, order: 1 },
          { from: 3, to: 4, order: 1 },
          { from: 5, to: 6, order: 1 },
          { from: 6, to: 7, order: 1 },
          { from: 8, to: 9, order: 1 },
          { from: 8, to: 10, order: 1 },
          { from: 11, to: 12, order: 1 },
          { from: 11, to: 13, order: 1 },
        ],
        newBonds: [
          { from: 0, to: 3, order: 2 },
          { from: 0, to: 8, order: 2 },
          { from: 1, to: 6, order: 2 },
          { from: 1, to: 11, order: 2 },
          { from: 2, to: 0, order: 1 },
          { from: 5, to: 1, order: 1 },
          { from: 4, to: 12, order: 1 }, // H2 #1
          { from: 7, to: 9, order: 1 }, // H2 #2
          { from: 10, to: 13, order: 1 }, // H2 #3
        ],
        stages: {
          approach: 'Nguyên tử Al tiếp xúc với dung dịch kiềm NaOH và nước H₂O.',
          breaking: 'Các liên kết O–H bị cắt đứt giải phóng nguyên tử H; mạng Al tách rời.',
          forming: 'Al liên kết với 2 nguyên tử O thành gốc aluminat AlO₂⁻; 6 H ghép thành 3 H₂.',
          complete: 'Tạo dung dịch muối tan NaAlO₂ và 3 phân tử khí H₂↑.',
        },
        mechanismSummary:
          'Nhôm khử nước trong môi trường kiềm: tách H ra tạo 3 phân tử H₂ và hình thành ion aluminat.',
      };

    case 'cu_hno3':
      return {
        reactionId: reaction.id,
        title: reaction.title,
        equation: reaction.balancedEquation,
        hasReaction: true,
        requiresHeat: false,
        // Compact chemically accurate 1:2:4 representation: Cu + 4 HNO3 -> Cu(NO3)2 + 2 NO2 + 2 H2O (only 21 atoms, exact!)
        // Wait: 0:Cu; HNO3#1(1:N,2:O,3:O,4:O,5:H); HNO3#2(6:N,7:O,8:O,9:O,10:H);
        // HNO3#3(11:N,12:O,13:O,14:H); HNO3#4(15:N,16:O,17:O,18:H) -> keep 19 atoms (omit 2 distant H or keep all 21? Keep 19 with O on NO2!)
        // Let's keep exact 17 atoms for Cu + 4 HNO3 core: 0:Cu, 1..4(NO3#1), 5..8(NO3#2), 9..11(NO2#3+OH), 12..14(NO2#4+OH), 15:H, 16:H -> actually let's include all atoms cleanly:
        // 0: Cu
        // 1: N1, 2: O1a, 3: O1b, 4: O1c, 5: H1
        // 6: N2, 7: O2a, 8: O2b, 9: O2c, 10: H2
        // 11: N3, 12: O3a, 13: O3b, 14: O3c, 15: H3
        // 16: N4, 17: O4a, 18: O4b, 19: O4c, 20: H4
        atoms: [
          { element: 'Cu', label: 'Cu', startPos: [-2.6, 0, 0], midPos: [-0.8, 0, 0], endPos: [-2.0, 0, 0] },
          // HNO3 #1 -> keeps NO3 attached to Cu
          { element: 'N', startPos: [1.4, 1.4, 0], midPos: [0.3, 1.1, 0], endPos: [-2.0, 1.25, 0] },
          { element: 'O', startPos: [0.8, 0.9, 0], midPos: [-0.2, 0.7, 0], endPos: [-2.0, 0.6, 0] },
          { element: 'O', startPos: [2.0, 1.8, 0.4], midPos: [0.9, 1.5, 0.4], endPos: [-2.5, 1.65, 0] },
          { element: 'O', startPos: [1.8, 1.0, -0.4], midPos: [0.7, 0.8, -0.4], endPos: [-1.5, 1.65, 0] },
          { element: 'H', startPos: [0.2, 1.1, 0], midPos: [0.5, 0.2, 0.5], endPos: [1.2, 1.4, 0.5] },
          // HNO3 #2 -> keeps NO3 attached to Cu
          { element: 'N', startPos: [1.4, -1.4, 0], midPos: [0.3, -1.1, 0], endPos: [-2.0, -1.25, 0] },
          { element: 'O', startPos: [0.8, -0.9, 0], midPos: [-0.2, -0.7, 0], endPos: [-2.0, -0.6, 0] },
          { element: 'O', startPos: [2.0, -1.8, 0.4], midPos: [0.9, -1.5, 0.4], endPos: [-2.5, -1.65, 0] },
          { element: 'O', startPos: [1.8, -1.0, -0.4], midPos: [0.7, -0.8, -0.4], endPos: [-1.5, -1.65, 0] },
          { element: 'H', startPos: [0.2, -1.1, 0], midPos: [0.5, -0.2, -0.5], endPos: [1.2, -1.4, -0.5] },
          // HNO3 #3 -> breaks into NO2 #1 + OH -> H2O #1
          { element: 'N', label: 'N⁺⁴', startPos: [2.8, 0.65, 0.6], midPos: [1.5, 0.6, 0.6], endPos: [2.8, 0.9, 0] },
          { element: 'O', startPos: [3.4, 1.0, 0.6], midPos: [2.1, 0.9, 0.6], endPos: [3.3, 1.3, 0] },
          { element: 'O', startPos: [3.2, 0.2, 0.9], midPos: [1.9, 0.2, 0.9], endPos: [3.3, 0.5, 0] },
          { element: 'O', startPos: [2.1, 0.6, 0.2], midPos: [1.0, 0.3, 0.2], endPos: [0.8, 1.0, 0.5] },
          { element: 'H', startPos: [1.7, 0.3, 0.1], midPos: [0.9, 0.1, 0.1], endPos: [0.4, 1.4, 0.5] },
          // HNO3 #4 -> breaks into NO2 #2 + OH -> H2O #2
          { element: 'N', label: 'N⁺⁴', startPos: [2.8, -0.65, -0.6], midPos: [1.5, -0.6, -0.6], endPos: [2.8, -0.9, 0] },
          { element: 'O', startPos: [3.4, -1.0, -0.6], midPos: [2.1, -0.9, -0.6], endPos: [3.3, -1.3, 0] },
          { element: 'O', startPos: [3.2, -0.2, -0.9], midPos: [1.9, -0.2, -0.9], endPos: [3.3, -0.5, 0] },
          { element: 'O', startPos: [2.1, -0.6, -0.2], midPos: [1.0, -0.3, -0.2], endPos: [0.8, -1.0, -0.5] },
          { element: 'H', startPos: [1.7, -0.3, -0.1], midPos: [0.9, -0.1, -0.1], endPos: [0.4, -1.4, -0.5] },
        ],
        oldBonds: [
          { from: 1, to: 2, order: 1, staysIntact: true },
          { from: 1, to: 3, order: 2, staysIntact: true },
          { from: 1, to: 4, order: 1, staysIntact: true },
          { from: 2, to: 5, order: 1 }, // O1a-H1 breaks
          { from: 6, to: 7, order: 1, staysIntact: true },
          { from: 6, to: 8, order: 2, staysIntact: true },
          { from: 6, to: 9, order: 1, staysIntact: true },
          { from: 7, to: 10, order: 1 }, // O2a-H2 breaks
          { from: 11, to: 12, order: 2, staysIntact: true },
          { from: 11, to: 13, order: 1, staysIntact: true },
          { from: 11, to: 14, order: 1 }, // N3-OH breaks
          { from: 14, to: 15, order: 1, staysIntact: true },
          { from: 16, to: 17, order: 2, staysIntact: true },
          { from: 16, to: 18, order: 1, staysIntact: true },
          { from: 16, to: 19, order: 1 }, // N4-OH breaks
          { from: 19, to: 20, order: 1, staysIntact: true },
        ],
        newBonds: [
          { from: 0, to: 2, order: 1 }, // Cu-NO3 #1
          { from: 0, to: 7, order: 1 }, // Cu-NO3 #2
          { from: 14, to: 5, order: 1 }, // H2O #1
          { from: 19, to: 10, order: 1 }, // H2O #2
        ],
        stages: {
          approach: 'Kim loại Cu tiếp xúc với 4 phân tử axit HNO₃ đặc.',
          breaking: 'Liên kết N–OH ở 2 phân tử HNO₃ bị khử đứt; 2 phân tử còn lại tách H⁺.',
          forming: 'Cu²⁺ gắn kết 2 gốc NO₃⁻; nhóm –OH ghép với H⁺ thành 2 H₂O và giải phóng 2 NO₂.',
          complete: 'Tạo dung dịch xanh Cu(NO₃)₂, 2 phân tử khí nâu đỏ NO₂↑ và 2 H₂O.',
        },
        mechanismSummary:
          '2 phân tử HNO₃ đóng vai trò chất oxi hóa bị tách nhóm –OH thành khí NO₂, 2 phân tử tạo môi trường muối Cu(NO₃)₂.',
      };

    case 'kmno4_hcl':
      return {
        reactionId: reaction.id,
        title: reaction.title,
        equation: reaction.balancedEquation,
        hasReaction: true,
        requiresHeat: false,
        // Representative redox core: KMnO4 + 8HCl -> KCl + MnCl2 + 2.5Cl2? Let's show clean intact cluster of 1 MnO4 + 8 HCl -> MnCl2 + Cl2 + H2O (or exact MnO4^- + 5 Cl^- + 8 H^+ -> Mn^2+ + 2.5 Cl2 -> better: MnO2-like or 2 MnO4 + 10 HCl -> wait 2*5 + 8*2 = 26 atoms is tiny!).
        // Even cleaner: show the 2-electron transfer unit from MnO4^- + 8 HCl (keeping exact stoichiometry of half unit MnO4^- + 5Cl^- + 8H^+? Wait Mn(+7)->Mn(+2) needs 5 Cl^- -> 2.5 Cl2 so double is 2 KMnO4 + 16 HCl, which has 14 atoms? No, 2*6 + 16*2 = 44 atoms. Let's make a crystal-clear 14-atom redox center showing 1 MnO4^- + 4 HCl + 2 H^+ -> MnCl2 + Cl2 + 2 H2O? Wait, let's check atom balance! If we show the EXACT balanced unit `2KMnO₄ + 16HCl` or `MnO₄⁻ + 5Cl⁻ + 8H⁺`, better NOT invent fake stoichiometry! Can we render 20 atoms? Wait: `KMnO₄ + 4HCl` isn't balanced, `2KMnO₄ + 16HCl -> 2KCl + 2MnCl₂ + 5Cl₂ + 8H₂O`: 44 atoms is super easy if organized cleanly!). Let's inspect: 2 K, 2 Mn, 8 O, 16 H, 16 Cl = 44 spheres. Let's make it crisp and non-overlapping in 3D!
        atoms: (() => {
          const list: MechanismAtom[] = [
            // 0..5: KMnO4 #1
            { element: 'Mn', label: 'Mn', startPos: [-2.2, 0.9, 0], midPos: [-0.8, 0.8, 0], endPos: [-2.2, 0.9, 0] },
            { element: 'K', startPos: [-3.3, 0.9, 0], midPos: [-1.8, 1.3, 0], endPos: [-3.2, 1.2, 0] },
            { element: 'O', startPos: [-1.6, 1.4, 0], midPos: [-0.2, 1.3, 0], endPos: [0.3, 1.5, 0] },
            { element: 'O', startPos: [-1.6, 0.4, 0], midPos: [-0.2, 0.5, 0], endPos: [0.3, 0.7, 0] },
            { element: 'O', startPos: [-2.7, 1.4, 0.4], midPos: [-1.1, 1.2, 0.5], endPos: [0.3, 0.1, 0.6] },
            { element: 'O', startPos: [-2.7, 0.4, -0.4], midPos: [-1.1, 0.4, -0.5], endPos: [0.3, -0.5, -0.6] },
            // 6..11: KMnO4 #2
            { element: 'Mn', label: 'Mn', startPos: [-2.2, -0.9, 0], midPos: [-0.8, -0.8, 0], endPos: [-2.2, -0.9, 0] },
            { element: 'K', startPos: [-3.3, -0.9, 0], midPos: [-1.8, -1.3, 0], endPos: [-3.2, -1.2, 0] },
            { element: 'O', startPos: [-1.6, -0.4, 0], midPos: [-0.2, -0.5, 0], endPos: [1.1, 1.5, 0] },
            { element: 'O', startPos: [-1.6, -1.4, 0], midPos: [-0.2, -1.3, 0], endPos: [1.1, 0.7, 0] },
            { element: 'O', startPos: [-2.7, -0.4, 0.4], midPos: [-1.1, -0.4, 0.5], endPos: [1.1, 0.1, 0.6] },
            { element: 'O', startPos: [-2.7, -1.4, -0.4], midPos: [-1.1, -1.2, -0.5], endPos: [1.1, -0.5, -0.6] },
          ];
          // Add 10 HCl forming 5 Cl2 (pairs 12..31) + 6 HCl forming KCl & MnCl2 (32..43)
          const oTargets: Vec3Tuple[] = [
            [0.3, 1.5, 0], [0.3, 0.7, 0], [0.3, 0.1, 0.6], [0.3, -0.5, -0.6],
            [1.1, 1.5, 0], [1.1, 0.7, 0], [1.1, 0.1, 0.6], [1.1, -0.5, -0.6],
          ];
          const clTargets: Vec3Tuple[] = [
            [2.4, 1.4, 0], [3.1, 1.4, 0],
            [2.4, 0.7, 0], [3.1, 0.7, 0],
            [2.4, 0.0, 0], [3.1, 0.0, 0],
            [2.4, -0.7, 0], [3.1, -0.7, 0],
            [2.4, -1.4, 0], [3.1, -1.4, 0],
            [-3.2, 1.8, 0], [-3.2, -1.8, 0],
            [-1.7, 1.5, 0], [-1.7, 0.3, 0],
            [-1.7, -0.3, 0], [-1.7, -1.5, 0],
          ];
          for (let i = 0; i < 16; i++) {
            const row = Math.floor(i / 2);
            const col = i % 2;
            const sy = (row - 3.5) * 0.5;
            const sz = col === 0 ? 0.55 : -0.55;
            const oTarget = oTargets[Math.floor(i / 2)];
            const hEnd: Vec3Tuple = [
              oTarget[0] + (i % 2 === 0 ? -0.32 : 0.32),
              oTarget[1] - 0.32,
              oTarget[2],
            ];
            list.push({
              element: 'H',
              startPos: [1.3, sy, sz],
              midPos: [0.5, sy * 0.8, sz * 0.7],
              endPos: hEnd,
            });
            list.push({
              element: 'Cl',
              startPos: [2.1, sy, sz],
              midPos: [1.2, sy * 0.8, sz * 0.7],
              endPos: clTargets[i],
            });
          }
          return list;
        })(),
        oldBonds: (() => {
          const b: MechanismBond[] = [
            { from: 0, to: 2, order: 2 },
            { from: 0, to: 3, order: 2 },
            { from: 0, to: 4, order: 2 },
            { from: 0, to: 5, order: 1 },
            { from: 1, to: 5, order: 1 },
            { from: 6, to: 8, order: 2 },
            { from: 6, to: 9, order: 2 },
            { from: 6, to: 10, order: 2 },
            { from: 6, to: 11, order: 1 },
            { from: 7, to: 11, order: 1 },
          ];
          for (let i = 0; i < 16; i++) {
            b.push({ from: 12 + i * 2, to: 12 + i * 2 + 1, order: 1 });
          }
          return b;
        })(),
        newBonds: (() => {
          const b: MechanismBond[] = [];
          const oIndices = [2, 3, 4, 5, 8, 9, 10, 11];
          for (let i = 0; i < 16; i++) {
            const hIdx = 12 + i * 2;
            b.push({ from: oIndices[Math.floor(i / 2)], to: hIdx, order: 1 });
          }
          // 5 Cl2 pairs (i = 0..9)
          for (let p = 0; p < 5; p++) {
            b.push({ from: 12 + (p * 2) * 2 + 1, to: 12 + (p * 2 + 1) * 2 + 1, order: 1 });
          }
          // KCl & MnCl2
          b.push({ from: 1, to: 12 + 10 * 2 + 1, order: 1 });
          b.push({ from: 7, to: 12 + 11 * 2 + 1, order: 1 });
          b.push({ from: 0, to: 12 + 12 * 2 + 1, order: 1 });
          b.push({ from: 0, to: 12 + 13 * 2 + 1, order: 1 });
          b.push({ from: 6, to: 12 + 14 * 2 + 1, order: 1 });
          b.push({ from: 6, to: 12 + 15 * 2 + 1, order: 1 });
          return b;
        })(),
        stages: {
          approach: '2 phân tử KMnO₄ tím tiến vào tiếp xúc với 16 phân tử HCl đặc.',
          breaking: 'Toàn bộ liên kết Mn=O và H–Cl bị cắt đứt trong phản ứng oxi hóa - khử mạnh.',
          forming: '10 Cl⁻ ghép thành 5 Cl₂; 8 O từ MnO₄⁻ kết hợp 16 H⁺ tạo 8 H₂O; Mn²⁺ & K⁺ gắn Cl⁻.',
          complete: 'Mất màu tím tạo dung dịch MnCl₂ + KCl, 8 H₂O và 5 phân tử khí Cl₂↑ vàng lục.',
        },
        mechanismSummary:
          'Mn⁺⁷ nhận 5e về Mn²⁺ giải phóng 4 nguyên tử O để kết hợp với 8H⁺ thành 4H₂O, đồng thời oxi hóa Cl⁻ thành Cl₂.',
      };

    case 'k2cr2o7_feso4':
      return {
        reactionId: reaction.id,
        title: reaction.title,
        equation: reaction.balancedEquation,
        hasReaction: true,
        requiresHeat: false,
        // Active ionic redox center: Cr2O7^2- + 6 Fe^2+ -> 2 Cr^3+ + 6 Fe^3+ + 7 O^2- (shown with 14 H+ -> 7 H2O; 2+7+6+14 = 29 atoms)
        atoms: (() => {
          const list: MechanismAtom[] = [
            // 0: Cr1, 1: Cr2, 2: bridging O, 3..8: 6 O
            { element: 'Cr', label: 'Cr⁺⁶', startPos: [-2.2, 0.65, 0], midPos: [-0.9, 0.7, 0], endPos: [-2.4, 0.9, 0] },
            { element: 'Cr', label: 'Cr⁺⁶', startPos: [-2.2, -0.65, 0], midPos: [-0.9, -0.7, 0], endPos: [-2.4, -0.9, 0] },
            { element: 'O', startPos: [-2.2, 0, 0], midPos: [-0.4, 0, 0], endPos: [0.4, 0, 0] },
            { element: 'O', startPos: [-2.9, 1.15, 0.3], midPos: [-0.2, 1.2, 0.3], endPos: [0.4, 1.4, 0] },
            { element: 'O', startPos: [-1.5, 1.15, -0.3], midPos: [0.1, 0.9, -0.4], endPos: [0.4, 0.7, 0.4] },
            { element: 'O', startPos: [-2.8, 0.4, -0.5], midPos: [-0.1, 0.4, -0.6], endPos: [0.4, -0.7, -0.4] },
            { element: 'O', startPos: [-2.9, -1.15, 0.3], midPos: [-0.2, -1.2, 0.3], endPos: [0.4, -1.4, 0] },
            { element: 'O', startPos: [-1.5, -1.15, -0.3], midPos: [0.1, -0.9, -0.4], endPos: [1.3, 0.9, 0] },
            { element: 'O', startPos: [-2.8, -0.4, 0.5], midPos: [-0.1, -0.4, 0.6], endPos: [1.3, -0.9, 0] },
          ];
          // 9..14: 6 Fe^2+ -> Fe^3+
          for (let f = 0; f < 6; f++) {
            const fy = (f - 2.5) * 0.55;
            list.push({
              element: 'Fe',
              label: 'Fe',
              startPos: [1.4, fy, 0.4],
              midPos: [0.8, fy * 0.85, 0.5],
              endPos: [2.7, fy, 0],
            });
          }
          // 15..28: 14 H+ combining with the 7 O -> 7 H2O
          const oEnd: Vec3Tuple[] = [
            [0.4, 0, 0],
            [0.4, 1.4, 0],
            [0.4, 0.7, 0.4],
            [0.4, -0.7, -0.4],
            [0.4, -1.4, 0],
            [1.3, 0.9, 0],
            [1.3, -0.9, 0],
          ];
          for (let h = 0; h < 14; h++) {
            const oIdx = Math.floor(h / 2);
            const side = h % 2 === 0 ? -0.32 : 0.32;
            list.push({
              element: 'H',
              startPos: [2.5, (oIdx - 3) * 0.48, side * 1.4],
              midPos: [1.1, (oIdx - 3) * 0.42, side],
              endPos: [oEnd[oIdx][0] + side, oEnd[oIdx][1] - 0.3, oEnd[oIdx][2]],
            });
          }
          return list;
        })(),
        oldBonds: [
          { from: 0, to: 2, order: 1 },
          { from: 1, to: 2, order: 1 },
          { from: 0, to: 3, order: 2 },
          { from: 0, to: 4, order: 2 },
          { from: 0, to: 5, order: 1 },
          { from: 1, to: 6, order: 2 },
          { from: 1, to: 7, order: 2 },
          { from: 1, to: 8, order: 1 },
        ],
        newBonds: (() => {
          const b: MechanismBond[] = [];
          for (let h = 0; h < 14; h++) {
            b.push({ from: 2 + Math.floor(h / 2), to: 15 + h, order: 1 });
          }
          return b;
        })(),
        stages: {
          approach: 'Ion đicromat Cr₂O₇²⁻ (da cam) tiếp cận 6 ion Fe²⁺ và H⁺.',
          breaking: 'Cầu nối Cr–O–Cr và toàn bộ các liên kết Cr=O đứt gãy khi Cr⁺⁶ nhận 6e.',
          forming: '7 nguyên tử O tách ra nối với 14 ion H⁺ tạo 7 phân tử H₂O; giải phóng 2 Cr³⁺.',
          complete: 'Thu được 2 ion Cr³⁺ màu xanh lục ngọc, 6 ion Fe³⁺ và 7 phân tử H₂O.',
        },
        mechanismSummary:
          'Mỗi Fe²⁺ nhường 1e cho ion Cr₂O₇²⁻, cắt đứt cầu Cr–O–Cr để tạo 2Cr³⁺ (xanh lục) và 7 H₂O.',
      };

    default:
      return {
        reactionId: reaction.id,
        title: reaction.title,
        equation: reaction.balancedEquation,
        hasReaction: true,
        requiresHeat: reaction.requiresHeat,
        atoms: (() => {
          const atoms: MechanismAtom[] = [];
          substanceA.atoms3D.forEach((a, idx) => {
            atoms.push({
              element: a.element,
              startPos: [a.x - 2.3, a.y, a.z],
              midPos: [a.x * 0.7 - 0.5, a.y * 0.8, a.z],
              endPos: [a.x * 0.9 - 1.2, a.y + (idx % 2 === 0 ? 0.35 : -0.35), a.z],
            });
          });
          substanceB.atoms3D.forEach((b, idx) => {
            atoms.push({
              element: b.element,
              startPos: [b.x + 2.3, b.y, b.z],
              midPos: [b.x * 0.7 + 0.5, b.y * 0.8, b.z],
              endPos: [b.x * 0.9 + 1.2, b.y + (idx % 2 === 0 ? -0.35 : 0.35), b.z],
            });
          });
          return atoms;
        })(),
        oldBonds: [
          ...substanceA.bonds3D.map((b, i) => ({
            from: b.from,
            to: b.to,
            order: b.order,
            staysIntact: i > 0,
          })),
          ...substanceB.bonds3D.map((b, i) => ({
            from: b.from + substanceA.atoms3D.length,
            to: b.to + substanceA.atoms3D.length,
            order: b.order,
            staysIntact: i > 0,
          })),
        ],
        newBonds: [
          { from: 0, to: substanceA.atoms3D.length, order: 1 },
        ],
        stages: {
          approach: `${substanceA.displayFormula} và ${substanceB.displayFormula} tiến vào vùng phản ứng.`,
          breaking: 'Liên kết cũ bị kéo căng và đứt gãy tại trung tâm phản ứng.',
          forming: 'Các nguyên tử/ion tái sắp xếp tạo liên kết mới thành sản phẩm.',
          complete: `Hoàn thành phản ứng: ${reaction.balancedEquation}`,
        },
        mechanismSummary: reaction.observationDetail,
      };
  }
}
