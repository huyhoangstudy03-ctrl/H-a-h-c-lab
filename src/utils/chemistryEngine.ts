// Pure chemistry calculation engine: formula parsing, molar mass, stoichiometry,
// equation balancing verification, Faraday electrolysis, pH dissociation, unit & formula conversions.

export const ATOMIC_MASSES: Record<string, number> = {
  H: 1.008, He: 4.0026, Li: 6.94, Be: 9.0122, B: 10.81, C: 12.011, N: 14.007, O: 15.999,
  F: 18.998, Ne: 20.18, Na: 22.99, Mg: 24.305, Al: 26.982, Si: 28.085, P: 30.974, S: 32.06,
  Cl: 35.45, Ar: 39.948, K: 39.098, Ca: 40.078, Sc: 44.956, Ti: 47.867, V: 50.942, Cr: 51.996,
  Mn: 54.938, Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.38, Ga: 69.723, Ge: 72.63,
  As: 74.922, Se: 78.971, Br: 79.904, Kr: 83.798, Rb: 85.468, Sr: 87.62, Y: 88.906, Zr: 91.224,
  Nb: 92.906, Mo: 95.95, Tc: 98, Ru: 101.07, Rh: 102.91, Pd: 106.42, Ag: 107.87, Cd: 112.41,
  In: 114.82, Sn: 118.71, Sb: 121.76, Te: 127.6, I: 126.9, Xe: 131.29, Cs: 132.91, Ba: 137.33,
  La: 138.91, Ce: 140.12, Pr: 140.91, Nd: 144.24, Pm: 145, Sm: 150.36, Eu: 151.96, Gd: 157.25,
  Tb: 158.93, Dy: 162.5, Ho: 164.93, Er: 167.26, Tm: 168.93, Yb: 173.05, Lu: 174.97, Hf: 178.49,
  Ta: 180.95, W: 183.84, Re: 186.21, Os: 190.23, Ir: 192.22, Pt: 195.08, Au: 196.97, Hg: 200.59,
  Tl: 204.38, Pb: 207.2, Bi: 208.98, Po: 209, At: 210, Rn: 222, Fr: 223, Ra: 226, Ac: 227,
  Th: 232.04, Pa: 231.04, U: 238.03,
};

const SUBSCRIPT_MAP: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
};

export function normalizeFormula(raw: string): string {
  let s = raw.trim();
  s = s.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (ch) => SUBSCRIPT_MAP[ch] ?? ch);
  // Remove trailing state markers like (aq), (s), (l), (g), ↓, ↑, charges if simple
  s = s.replace(/\((aq|s|l|g|r|dd|k|h)\)$/i, '').replace(/[↓↑]/g, '').trim();
  return s;
}

export function parseFormulaCounts(rawFormula: string): Record<string, number> {
  const formula = normalizeFormula(rawFormula);
  if (!formula) return {};

  // Handle hydrate dot notation e.g. CuSO4.5H2O or CuSO4·5H2O
  const parts = formula.split(/[.·]/);
  const total: Record<string, number> = {};

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const leadMatch = trimmed.match(/^(\d+)(.*)$/);
    const mult = leadMatch ? parseInt(leadMatch[1], 10) : 1;
    const body = leadMatch ? leadMatch[2] : trimmed;

    const stack: Record<string, number>[] = [{}];
    let i = 0;

    while (i < body.length) {
      const ch = body[i];
      if (ch === '(' || ch === '[') {
        stack.push({});
        i++;
      } else if (ch === ')' || ch === ']') {
        i++;
        let numStr = '';
        while (i < body.length && /\d/.test(body[i])) {
          numStr += body[i++];
        }
        const factor = numStr ? parseInt(numStr, 10) : 1;
        const popped = stack.pop();
        if (popped && stack.length > 0) {
          const top = stack[stack.length - 1];
          for (const [el, count] of Object.entries(popped)) {
            top[el] = (top[el] ?? 0) + count * factor;
          }
        }
      } else if (/[A-Z]/.test(ch)) {
        let el = ch;
        i++;
        while (i < body.length && /[a-z]/.test(body[i])) {
          el += body[i++];
        }
        let numStr = '';
        while (i < body.length && /\d/.test(body[i])) {
          numStr += body[i++];
        }
        const count = numStr ? parseInt(numStr, 10) : 1;
        const top = stack[stack.length - 1];
        top[el] = (top[el] ?? 0) + count;
      } else {
        i++;
      }
    }

    const segmentCounts = stack[0];
    for (const [el, count] of Object.entries(segmentCounts)) {
      total[el] = (total[el] ?? 0) + count * mult;
    }
  }

  return total;
}

export function calculateMolarMass(formula: string): number {
  const counts = parseFormulaCounts(formula);
  let sum = 0;
  for (const [el, count] of Object.entries(counts)) {
    const mass = ATOMIC_MASSES[el];
    if (mass !== undefined) {
      sum += mass * count;
    }
  }
  return Math.round(sum * 100) / 100;
}

export interface EquationVerificationResult {
  balanced: boolean;
  validInputs: boolean;
  isMinimalRatio: boolean;
  elementDiffs: Record<string, { left: number; right: number }>;
  errorMessage?: string;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

export function verifyBalancedEquation(
  reactants: { formula: string }[],
  products: { formula: string }[],
  reactantCoeffs: number[],
  productCoeffs: number[],
): EquationVerificationResult {
  if (
    reactants.length !== reactantCoeffs.length ||
    products.length !== productCoeffs.length
  ) {
    return {
      balanced: false,
      validInputs: false,
      isMinimalRatio: false,
      elementDiffs: {},
      errorMessage: 'Số lượng hệ số không khớp với phương trình.',
    };
  }

  const allCoeffs = [...reactantCoeffs, ...productCoeffs];
  if (allCoeffs.some((c) => !Number.isInteger(c) || c <= 0)) {
    return {
      balanced: false,
      validInputs: false,
      isMinimalRatio: false,
      elementDiffs: {},
      errorMessage: 'Tất cả hệ số cân bằng phải là số nguyên dương (≥ 1).',
    };
  }

  const leftTotals: Record<string, number> = {};
  const rightTotals: Record<string, number> = {};

  reactants.forEach((r, idx) => {
    const counts = parseFormulaCounts(r.formula);
    const coeff = reactantCoeffs[idx];
    for (const [el, cnt] of Object.entries(counts)) {
      leftTotals[el] = (leftTotals[el] ?? 0) + cnt * coeff;
    }
  });

  products.forEach((p, idx) => {
    const counts = parseFormulaCounts(p.formula);
    const coeff = productCoeffs[idx];
    for (const [el, cnt] of Object.entries(counts)) {
      rightTotals[el] = (rightTotals[el] ?? 0) + cnt * coeff;
    }
  });

  const allElements = new Set([
    ...Object.keys(leftTotals),
    ...Object.keys(rightTotals),
  ]);
  const elementDiffs: Record<string, { left: number; right: number }> = {};
  let balanced = true;

  for (const el of allElements) {
    const l = leftTotals[el] ?? 0;
    const r = rightTotals[el] ?? 0;
    elementDiffs[el] = { left: l, right: r };
    if (l !== r) {
      balanced = false;
    }
  }

  const overallGcd = allCoeffs.reduce((acc, val) => gcd(acc, val), allCoeffs[0]);
  const isMinimalRatio = overallGcd === 1;

  return {
    balanced,
    validInputs: true,
    isMinimalRatio,
    elementDiffs,
    errorMessage: !balanced
      ? 'Số nguyên tử ở hai vế chưa bằng nhau.'
      : !isMinimalRatio
        ? 'Phương trình đã cân bằng nhưng hệ số chưa tối giản (hãy chia cho ước chung lớn nhất).'
        : undefined,
  };
}

export interface StoichiometrySpeciesSpec {
  formula: string;
  name: string;
  coeff: number;
  stateLabel: string;
  colorLabel: string;
}

export interface StoichiometryResult {
  reactantAMolesInitial: number;
  reactantBMolesInitial: number;
  reactantAMassInitialG: number;
  reactantBMassInitialG: number;
  reactantAMolarMass: number;
  reactantBMolarMass: number;
  limitingReactant: 'A' | 'B' | 'BOTH' | 'NONE';
  extentMoles: number;
  reactantAMolesRemaining: number;
  reactantBMolesRemaining: number;
  reactantAMassRemainingG: number;
  reactantBMassRemainingG: number;
  productsProduced: Array<{
    formula: string;
    name: string;
    moles: number;
    massG: number;
    molarMass: number;
    stateLabel: string;
    colorLabel: string;
  }>;
  totalMassBeforeG: number;
  totalMassAfterG: number;
}

export function computeStoichiometry(
  reactantA: StoichiometrySpeciesSpec,
  reactantB: StoichiometrySpeciesSpec,
  products: StoichiometrySpeciesSpec[],
  massAG: number,
  massBG: number,
  didReact: boolean,
): StoichiometryResult {
  const mA = Math.max(0, massAG);
  const mB = Math.max(0, massBG);
  const molarA = calculateMolarMass(reactantA.formula) || 1;
  const molarB = calculateMolarMass(reactantB.formula) || 1;

  const nA = mA / molarA;
  const nB = mB / molarB;

  if (!didReact || nA === 0 || nB === 0) {
    return {
      reactantAMolesInitial: nA,
      reactantBMolesInitial: nB,
      reactantAMassInitialG: mA,
      reactantBMassInitialG: mB,
      reactantAMolarMass: molarA,
      reactantBMolarMass: molarB,
      limitingReactant: 'NONE',
      extentMoles: 0,
      reactantAMolesRemaining: nA,
      reactantBMolesRemaining: nB,
      reactantAMassRemainingG: mA,
      reactantBMassRemainingG: mB,
      productsProduced: [],
      totalMassBeforeG: mA + mB,
      totalMassAfterG: mA + mB,
    };
  }

  const ratioA = nA / reactantA.coeff;
  const ratioB = nB / reactantB.coeff;
  const eps = 1e-9;

  let limitingReactant: 'A' | 'B' | 'BOTH' = 'BOTH';
  let extent = ratioA;
  if (Math.abs(ratioA - ratioB) <= eps) {
    limitingReactant = 'BOTH';
    extent = ratioA;
  } else if (ratioA < ratioB) {
    limitingReactant = 'A';
    extent = ratioA;
  } else {
    limitingReactant = 'B';
    extent = ratioB;
  }

  const remMolesA = Math.max(0, nA - extent * reactantA.coeff);
  const remMolesB = Math.max(0, nB - extent * reactantB.coeff);
  const remMassA = remMolesA * molarA;
  const remMassB = remMolesB * molarB;

  const productsProduced = products.map((p) => {
    const molarP = calculateMolarMass(p.formula) || 1;
    const molesP = extent * p.coeff;
    const massP = molesP * molarP;
    return {
      formula: p.formula,
      name: p.name,
      moles: molesP,
      massG: massP,
      molarMass: molarP,
      stateLabel: p.stateLabel,
      colorLabel: p.colorLabel,
    };
  });

  const totalProductsMass = productsProduced.reduce((s, p) => s + p.massG, 0);
  const totalAfter = remMassA + remMassB + totalProductsMass;

  return {
    reactantAMolesInitial: nA,
    reactantBMolesInitial: nB,
    reactantAMassInitialG: mA,
    reactantBMassInitialG: mB,
    reactantAMolarMass: molarA,
    reactantBMolarMass: molarB,
    limitingReactant,
    extentMoles: extent,
    reactantAMolesRemaining: remMolesA,
    reactantBMolesRemaining: remMolesB,
    reactantAMassRemainingG: remMassA,
    reactantBMassRemainingG: remMassB,
    productsProduced,
    totalMassBeforeG: mA + mB,
    totalMassAfterG: totalAfter,
  };
}

export const FARADAY_CONSTANT = 96485; // C/mol
export const GAS_VOLUME_DKC = 24.79; // L/mol at 25°C, 1 bar (GDPT 2018)

export interface ElectrolysisCalculation {
  chargeCoulombs: number;
  electronMoles: number;
  cathodeMassG: number;
  cathodeGasLiters: number;
  anodeMassG: number;
  anodeGasLiters: number;
  cathodeElectrodeDeltaG: number;
  anodeElectrodeDeltaG: number;
  solutionDeltaG: number;
}

export function calculateElectrolysis(params: {
  currentAmp: number;
  durationSec: number;
  cathodeProductMolarMass: number;
  cathodeElectrons: number;
  cathodeIsGas: boolean;
  anodeProductMolarMass: number;
  anodeElectrons: number;
  anodeIsGas: boolean;
  anodeDissolves?: boolean;
  anodeReactsInSolution?: boolean;
}): ElectrolysisCalculation {
  const I = Math.max(0, params.currentAmp);
  const t = Math.max(0, params.durationSec);
  const Q = I * t;
  const ne = Q / FARADAY_CONSTANT;

  const nCathode = ne / Math.max(1, params.cathodeElectrons);
  const cathodeMassG = nCathode * params.cathodeProductMolarMass;
  const cathodeGasLiters = params.cathodeIsGas ? nCathode * GAS_VOLUME_DKC : 0;

  const nAnode = ne / Math.max(1, params.anodeElectrons);
  const anodeMassG = nAnode * params.anodeProductMolarMass;
  const anodeGasLiters =
    params.anodeIsGas && !params.anodeReactsInSolution ? nAnode * GAS_VOLUME_DKC : 0;

  // Electrode mass change: positive if solid metal plates onto cathode; negative if soluble anode dissolves
  const cathodeElectrodeDeltaG = params.cathodeIsGas ? 0 : cathodeMassG;
  const anodeElectrodeDeltaG = params.anodeDissolves ? -anodeMassG : 0;

  // Solution mass change: solute/water loses whatever leaves as solid deposit or escaping gas,
  // and gains whatever dissolves from a soluble anode.
  const anodeLeavesSolutionG = params.anodeDissolves
    ? -anodeMassG
    : params.anodeReactsInSolution
      ? 0
      : anodeMassG;
  const solutionDeltaG = -(cathodeMassG + anodeLeavesSolutionG);

  return {
    chargeCoulombs: Q,
    electronMoles: ne,
    cathodeMassG,
    cathodeGasLiters,
    anodeMassG,
    anodeGasLiters,
    cathodeElectrodeDeltaG,
    anodeElectrodeDeltaG,
    solutionDeltaG,
  };
}

export interface DissociationCalculation {
  pH: number;
  pOH: number;
  hPlusM: number;
  ohMinusM: number;
  alphaPercent: number;
  conductivityLevel: 'Mạnh' | 'Yếu' | 'Không điện li';
}

export function calculateDissociationPH(params: {
  type: 'strong_acid' | 'weak_acid' | 'strong_base' | 'weak_base' | 'neutral_salt' | 'none';
  molarity: number;
  kaOrKb?: number;
  stoichFactor?: number;
}): DissociationCalculation {
  const c = Math.max(0.0001, params.molarity);
  const factor = params.stoichFactor ?? 1;

  if (params.type === 'none') {
    return {
      pH: 7.0,
      pOH: 7.0,
      hPlusM: 1e-7,
      ohMinusM: 1e-7,
      alphaPercent: 0,
      conductivityLevel: 'Không điện li',
    };
  }

  if (params.type === 'neutral_salt') {
    return {
      pH: 7.0,
      pOH: 7.0,
      hPlusM: 1e-7,
      ohMinusM: 1e-7,
      alphaPercent: 100,
      conductivityLevel: 'Mạnh',
    };
  }

  if (params.type === 'strong_acid') {
    const hPlus = c * factor;
    const pH = Math.max(0, Math.min(14, -Math.log10(hPlus)));
    const pOH = 14 - pH;
    return {
      pH,
      pOH,
      hPlusM: hPlus,
      ohMinusM: Math.pow(10, -pOH),
      alphaPercent: 100,
      conductivityLevel: 'Mạnh',
    };
  }

  if (params.type === 'strong_base') {
    const ohMinus = c * factor;
    const pOH = Math.max(0, Math.min(14, -Math.log10(ohMinus)));
    const pH = 14 - pOH;
    return {
      pH,
      pOH,
      hPlusM: Math.pow(10, -pH),
      ohMinusM: ohMinus,
      alphaPercent: 100,
      conductivityLevel: 'Mạnh',
    };
  }

  // Weak acid or weak base: x^2 + K*x - K*C = 0
  const K = params.kaOrKb ?? 1.8e-5;
  const x = (-K + Math.sqrt(K * K + 4 * K * c)) / 2;
  const alphaPercent = Math.min(100, (x / c) * 100);

  if (params.type === 'weak_acid') {
    const pH = Math.max(0, Math.min(14, -Math.log10(x)));
    const pOH = 14 - pH;
    return {
      pH,
      pOH,
      hPlusM: x,
      ohMinusM: Math.pow(10, -pOH),
      alphaPercent,
      conductivityLevel: 'Yếu',
    };
  }

  // weak_base
  const pOH = Math.max(0, Math.min(14, -Math.log10(x)));
  const pH = 14 - pOH;
  return {
    pH,
    pOH,
    hPlusM: Math.pow(10, -pH),
    ohMinusM: x,
    alphaPercent,
    conductivityLevel: 'Yếu',
  };
}

export type UnitCategory = 'mass' | 'volume' | 'pressure' | 'temperature' | 'concentration';

export function convertUnit(
  category: UnitCategory,
  value: number,
  fromUnit: string,
  toUnit: string,
): number {
  if (!Number.isFinite(value)) return 0;
  if (fromUnit === toUnit) return value;

  if (category === 'mass') {
    const toGrams: Record<string, number> = {
      mg: 0.001,
      g: 1,
      kg: 1000,
      tan: 1_000_000,
    };
    const grams = value * (toGrams[fromUnit] ?? 1);
    return grams / (toGrams[toUnit] ?? 1);
  }

  if (category === 'volume') {
    const toLiters: Record<string, number> = {
      mL: 0.001,
      L: 1,
      m3: 1000,
    };
    const liters = value * (toLiters[fromUnit] ?? 1);
    return liters / (toLiters[toUnit] ?? 1);
  }

  if (category === 'pressure') {
    const toBar: Record<string, number> = {
      bar: 1,
      atm: 1.01325,
      kPa: 0.01,
      mmHg: 1 / 750.062,
    };
    const bar = value * (toBar[fromUnit] ?? 1);
    return bar / (toBar[toUnit] ?? 1);
  }

  if (category === 'temperature') {
    if (fromUnit === 'C' && toUnit === 'K') return value + 273.15;
    if (fromUnit === 'K' && toUnit === 'C') return value - 273.15;
    return value;
  }

  if (category === 'concentration') {
    const toMolL: Record<string, number> = {
      'mol/L': 1,
      'mmol/L': 0.001,
    };
    const molL = value * (toMolL[fromUnit] ?? 1);
    return molL / (toMolL[toUnit] ?? 1);
  }

  return value;
}

export interface FormulaBridgeStep {
  stepNumber: number;
  title: string;
  formulaText: string;
  substitutionText: string;
  resultText: string;
}

export interface FormulaBridgeResult {
  targetLabel: string;
  targetValue: number;
  targetUnit: string;
  steps: FormulaBridgeStep[];
}

export type FormulaBridgeMode =
  | 'mass_to_gas_dkc'
  | 'cpercent_to_cm'
  | 'cm_to_mass'
  | 'faraday_to_mass'
  | 'gas_to_molecules';

export function computeFormulaBridge(
  mode: FormulaBridgeMode,
  inputs: Record<string, number>,
): FormulaBridgeResult {
  if (mode === 'mass_to_gas_dkc') {
    const m = Math.max(0, inputs.m ?? 6.5);
    const M = Math.max(0.01, inputs.M ?? 65.38);
    const ratio = Math.max(0.01, inputs.ratio ?? 1);
    const nChat = m / M;
    const nKhi = nChat * ratio;
    const V = nKhi * GAS_VOLUME_DKC;
    return {
      targetLabel: 'Thể tích khí ở đkc (25°C, 1 bar)',
      targetValue: V,
      targetUnit: 'L',
      steps: [
        {
          stepNumber: 1,
          title: 'Quy đổi từ khối lượng sang số mol chất',
          formulaText: 'n = m / M',
          substitutionText: `n = ${m} / ${M}`,
          resultText: `${nChat.toFixed(4)} mol`,
        },
        {
          stepNumber: 2,
          title: 'Suy ra số mol khí theo tỷ lệ phương trình',
          formulaText: 'n_khí = n_chất × k',
          substitutionText: `n_khí = ${nChat.toFixed(4)} × ${ratio}`,
          resultText: `${nKhi.toFixed(4)} mol`,
        },
        {
          stepNumber: 3,
          title: 'Quy đổi từ số mol khí sang thể tích (đkc)',
          formulaText: 'V = n_khí × 24,79',
          substitutionText: `V = ${nKhi.toFixed(4)} × 24,79`,
          resultText: `${V.toFixed(3)} L`,
        },
      ],
    };
  }

  if (mode === 'cpercent_to_cm') {
    const cPercent = Math.max(0, inputs.cPercent ?? 9.8);
    const D = Math.max(0.01, inputs.D ?? 1.06);
    const M = Math.max(0.01, inputs.M ?? 98.08);
    const cM = (10 * cPercent * D) / M;
    return {
      targetLabel: 'Nồng độ mol dung dịch (C_M)',
      targetValue: cM,
      targetUnit: 'mol/L',
      steps: [
        {
          stepNumber: 1,
          title: 'Xét 1 lít dung dịch (1000 mL), tính khối lượng dung dịch',
          formulaText: 'm_dd = 1000 × D',
          substitutionText: `m_dd = 1000 × ${D}`,
          resultText: `${(1000 * D).toFixed(1)} g`,
        },
        {
          stepNumber: 2,
          title: 'Tính khối lượng chất tan và số mol chất tan trong 1L',
          formulaText: 'n = m_ct / M = (m_dd × C% / 100) / M',
          substitutionText: `n = (${(1000 * D).toFixed(1)} × ${cPercent}% / 100) / ${M}`,
          resultText: `${cM.toFixed(4)} mol`,
        },
        {
          stepNumber: 3,
          title: 'Công thức liên hệ trực tiếp C_M và C%',
          formulaText: 'C_M = (10 × C% × D) / M',
          substitutionText: `C_M = (10 × ${cPercent} × ${D}) / ${M}`,
          resultText: `${cM.toFixed(3)} mol/L`,
        },
      ],
    };
  }

  if (mode === 'cm_to_mass') {
    const cM = Math.max(0, inputs.cM ?? 0.5);
    const vMl = Math.max(0, inputs.vMl ?? 200);
    const M = Math.max(0.01, inputs.M ?? 40);
    const vL = vMl / 1000;
    const n = cM * vL;
    const m = n * M;
    return {
      targetLabel: 'Khối lượng chất tan cần dùng (m)',
      targetValue: m,
      targetUnit: 'g',
      steps: [
        {
          stepNumber: 1,
          title: 'Đổi thể tích dung dịch từ mL sang lít (L)',
          formulaText: 'V (L) = V (mL) / 1000',
          substitutionText: `V = ${vMl} / 1000`,
          resultText: `${vL.toFixed(3)} L`,
        },
        {
          stepNumber: 2,
          title: 'Tính số mol chất tan từ nồng độ mol',
          formulaText: 'n = C_M × V',
          substitutionText: `n = ${cM} × ${vL.toFixed(3)}`,
          resultText: `${n.toFixed(4)} mol`,
        },
        {
          stepNumber: 3,
          title: 'Quy đổi từ số mol sang khối lượng (gam)',
          formulaText: 'm = n × M',
          substitutionText: `m = ${n.toFixed(4)} × ${M}`,
          resultText: `${m.toFixed(3)} g`,
        },
      ],
    };
  }

  if (mode === 'faraday_to_mass') {
    const I = Math.max(0, inputs.I ?? 5);
    const t = Math.max(0, inputs.t ?? 1930);
    const A = Math.max(0.01, inputs.A ?? 64);
    const nVal = Math.max(1, inputs.n ?? 2);
    const Q = I * t;
    const ne = Q / FARADAY_CONSTANT;
    const m = (A * I * t) / (nVal * FARADAY_CONSTANT);
    return {
      targetLabel: 'Khối lượng kim loại bám ở catot (m)',
      targetValue: m,
      targetUnit: 'g',
      steps: [
        {
          stepNumber: 1,
          title: 'Tính điện lượng truyền qua bình điện phân',
          formulaText: 'Q = I × t',
          substitutionText: `Q = ${I} × ${t}`,
          resultText: `${Q.toFixed(1)} C`,
        },
        {
          stepNumber: 2,
          title: 'Quy đổi sang số mol electron trao đổi',
          formulaText: 'n_e = Q / F (với F = 96485 C/mol)',
          substitutionText: `n_e = ${Q.toFixed(1)} / 96485`,
          resultText: `${ne.toFixed(4)} mol e`,
        },
        {
          stepNumber: 3,
          title: 'Áp dụng định luật Faraday tính khối lượng chất',
          formulaText: 'm = (A × I × t) / (n × F) = (n_e / n) × A',
          substitutionText: `m = (${ne.toFixed(4)} / ${nVal}) × ${A}`,
          resultText: `${m.toFixed(3)} g`,
        },
      ],
    };
  }

  // gas_to_molecules
  const V = Math.max(0, inputs.V ?? 2.479);
  const n = V / GAS_VOLUME_DKC;
  const N = n * 6.022e23;
  return {
    targetLabel: 'Số phân tử khí (N)',
    targetValue: N,
    targetUnit: 'phân tử',
    steps: [
      {
        stepNumber: 1,
        title: 'Tính số mol khí từ thể tích ở đkc',
        formulaText: 'n = V / 24,79',
        substitutionText: `n = ${V} / 24,79`,
        resultText: `${n.toFixed(4)} mol`,
      },
      {
        stepNumber: 2,
        title: 'Nhân với hằng số Avogadro để tìm số phân tử',
        formulaText: 'N = n × 6,022 × 10²³',
        substitutionText: `N = ${n.toFixed(4)} × 6,022 × 10²³`,
        resultText: `${N.toExponential(3)} phân tử`,
      },
    ],
  };
}

// ============================================================================
// Exact Chemical Equation Auto-Balancer (BigInt Rational Gaussian Elimination)
// ============================================================================

const TO_SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
};

export function formatFormulaDisplay(raw: string): string {
  const clean = normalizeFormula(raw);
  // Convert trailing/internal numbers after letters or ) into subscripts, keeping hydrate multipliers if any
  return clean.replace(/([A-Za-z)\]])(\d+)/g, (_, prefix: string, digits: string) => {
    const sub = digits
      .split('')
      .map((d) => TO_SUBSCRIPT_MAP[d] ?? d)
      .join('');
    return `${prefix}${sub}`;
  });
}

function bigGcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x === 0n ? 1n : x;
}

function bigLcm(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  const g = bigGcd(a, b);
  const res = (a / g) * b;
  return res < 0n ? -res : res;
}

interface BigFrac {
  n: bigint;
  d: bigint;
}

function makeFrac(n: bigint, d: bigint = 1n): BigFrac {
  if (d === 0n) throw new Error('Division by zero');
  if (n === 0n) return { n: 0n, d: 1n };
  let num = n;
  let den = d;
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  const g = bigGcd(num, den);
  return { n: num / g, d: den / g };
}

function subFrac(a: BigFrac, b: BigFrac): BigFrac {
  return makeFrac(a.n * b.d - b.n * a.d, a.d * b.d);
}

function mulFrac(a: BigFrac, b: BigFrac): BigFrac {
  return makeFrac(a.n * b.n, a.d * b.d);
}

function divFrac(a: BigFrac, b: BigFrac): BigFrac {
  return makeFrac(a.n * b.d, a.d * b.n);
}

export interface SolvedEquationResult {
  success: boolean;
  error?: string;
  reactants: { formula: string; display: string }[];
  products: { formula: string; display: string }[];
  coefficients: number[];
  balancedText: string;
  elementCounts: Record<string, number>;
  steps: string[];
}

export function solveChemicalEquation(rawInput: string): SolvedEquationResult {
  const emptyFail = (error: string): SolvedEquationResult => ({
    success: false,
    error,
    reactants: [],
    products: [],
    coefficients: [],
    balancedText: '',
    elementCounts: {},
    steps: [],
  });

  const normalizedInput = rawInput
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (ch) => SUBSCRIPT_MAP[ch] ?? ch)
    .replace(/[—–]/g, '-')
    .replace(/\((đặc|loãng|r|l|k|dd|aq|s|g|đpdd|đpnc|cmn|t°|xt)\)/gi, '')
    .replace(/[↓↑]/g, '')
    .trim();

  if (!normalizedInput) {
    return emptyFail('Vui lòng nhập phương trình hóa học (ví dụ: CuSO4 + NaOH -> Cu(OH)2 + Na2SO4).');
  }

  const arrowParts = normalizedInput.split(/->|→|⇌|=>|=/);
  if (arrowParts.length !== 2) {
    return emptyFail('Phương trình cần có đúng 1 mũi tên "->" (hoặc "→", "=") ngăn cách hai vế.');
  }

  const parseSide = (sideStr: string) =>
    sideStr
      .split('+')
      .map((s) => s.trim().replace(/^\d+/, '').trim())
      .filter(Boolean);

  const rawReactants = parseSide(arrowParts[0]);
  const rawProducts = parseSide(arrowParts[1]);

  if (rawReactants.length === 0 || rawProducts.length === 0) {
    return emptyFail('Mỗi vế phải chứa ít nhất 1 chất hóa học.');
  }

  const species = [
    ...rawReactants.map((f) => ({ formula: normalizeFormula(f), display: formatFormulaDisplay(f), side: 1 })),
    ...rawProducts.map((f) => ({ formula: normalizeFormula(f), display: formatFormulaDisplay(f), side: -1 })),
  ];

  const parsedCounts = species.map((sp) => parseFormulaCounts(sp.formula));
  for (let i = 0; i < species.length; i++) {
    const keys = Object.keys(parsedCounts[i]);
    if (keys.length === 0) {
      return emptyFail(`Không nhận diện được công thức "${species[i].formula}". Hãy kiểm tra lại chữ hoa/thường (vd: CuSO4, FeCl3).`);
    }
    for (const el of keys) {
      if (ATOMIC_MASSES[el] === undefined) {
        return emptyFail(`Nguyên tố "${el}" trong "${species[i].formula}" không có trong bảng tuần hoàn.`);
      }
    }
  }

  const elements = Array.from(new Set(parsedCounts.flatMap((c) => Object.keys(c))));
  const leftEls = new Set(parsedCounts.slice(0, rawReactants.length).flatMap((c) => Object.keys(c)));
  const rightEls = new Set(parsedCounts.slice(rawReactants.length).flatMap((c) => Object.keys(c)));

  for (const el of elements) {
    if (!leftEls.has(el) || !rightEls.has(el)) {
      return emptyFail(
        `Nguyên tố ${el} chỉ xuất hiện ở ${leftEls.has(el) ? 'vế trái' : 'vế phải'}. Phương trình thiếu chất hoặc viết sai công thức.`,
      );
    }
  }

  const numRows = elements.length;
  const numCols = species.length;
  const mat: BigFrac[][] = elements.map((el) =>
    species.map((sp, j) => makeFrac(BigInt((parsedCounts[j][el] ?? 0) * sp.side))),
  );

  // RREF over Q
  const pivotCols: number[] = [];
  let r = 0;
  for (let c = 0; c < numCols && r < numRows; c++) {
    let piv = -1;
    for (let i = r; i < numRows; i++) {
      if (mat[i][c].n !== 0n) {
        piv = i;
        break;
      }
    }
    if (piv === -1) continue;
    [mat[r], mat[piv]] = [mat[piv], mat[r]];

    const pv = mat[r][c];
    for (let j = c; j < numCols; j++) {
      mat[r][j] = divFrac(mat[r][j], pv);
    }

    for (let i = 0; i < numRows; i++) {
      if (i !== r && mat[i][c].n !== 0n) {
        const factor = mat[i][c];
        for (let j = c; j < numCols; j++) {
          mat[i][j] = subFrac(mat[i][j], mulFrac(factor, mat[r][j]));
        }
      }
    }
    pivotCols.push(c);
    r++;
  }

  const freeCols: number[] = [];
  for (let c = 0; c < numCols; c++) {
    if (!pivotCols.includes(c)) freeCols.push(c);
  }

  if (freeCols.length === 0) {
    return emptyFail('Không tìm thấy nghiệm hệ số khác 0 cho phương trình này. Hãy kiểm tra lại công thức các chất.');
  }

  if (freeCols.length > 1) {
    return emptyFail('Phương trình có nhiều hơn 1 bậc tự do (có thể là tổ hợp của hai phản ứng độc lập).');
  }

  const freeCol = freeCols[0];
  const vec: BigFrac[] = Array(numCols).fill(makeFrac(0n));
  vec[freeCol] = makeFrac(1n);

  for (let i = 0; i < pivotCols.length; i++) {
    const pc = pivotCols[i];
    vec[pc] = makeFrac(-mat[i][freeCol].n, mat[i][freeCol].d);
  }

  // Convert rational vector to minimal positive integer coefficients
  let lcmDen = 1n;
  for (const f of vec) {
    lcmDen = bigLcm(lcmDen, f.d);
  }
  let ints = vec.map((f) => (f.n * lcmDen) / f.d);
  if (ints[0] < 0n) {
    ints = ints.map((v) => -v);
  }

  if (ints.some((v) => v <= 0n)) {
    return emptyFail('Không thể cân bằng với toàn bộ hệ số dương — hãy kiểm tra xem có chất nào bị đặt nhầm vế không.');
  }

  const overallGcd = ints.reduce((acc, v) => bigGcd(acc, v), ints[0]);
  const coeffs = ints.map((v) => Number(v / overallGcd));

  const rLen = rawReactants.length;
  const reactants = species.slice(0, rLen).map((s) => ({ formula: s.formula, display: s.display }));
  const products = species.slice(rLen).map((s) => ({ formula: s.formula, display: s.display }));

  const leftText = reactants
    .map((sp, i) => `${coeffs[i] > 1 ? coeffs[i] : ''}${sp.display}`)
    .join(' + ');
  const rightText = products
    .map((sp, i) => `${coeffs[rLen + i] > 1 ? coeffs[rLen + i] : ''}${sp.display}`)
    .join(' + ');

  const elementCounts: Record<string, number> = {};
  for (const el of elements) {
    let sum = 0;
    for (let i = 0; i < rLen; i++) {
      sum += (parsedCounts[i][el] ?? 0) * coeffs[i];
    }
    elementCounts[el] = sum;
  }

  const nonHO = elements.filter((e) => e !== 'H' && e !== 'O');
  const orderEls = [...nonHO, ...elements.filter((e) => e === 'H' || e === 'O')];

  const steps: string[] = [
    `Bước 1 (Xác định nguyên tố tham gia): Hai vế gồm ${elements.length} nguyên tố (${orderEls.join(', ')}). Đặt ẩn hệ số nguyên dương trước ${numCols} chất.`,
    `Bước 2 (Lập bảo toàn nguyên tử & Ưu tiên cân bằng): Cân bằng theo thứ tự Kim loại/Phi kim chính (${nonHO.join(', ') || 'nguyên tố chính'}) → Hiđro (H) → Oxi (O) để tìm tỉ lệ tối giản.`,
    `Bước 3 (Bộ hệ số nguyên tối giản): Tìm được tỉ lệ [${coeffs.join(' : ')}] với ước chung lớn nhất bằng 1.`,
    `Bước 4 (Kiểm chứng bảo toàn): ${orderEls.map((el) => `${el}: ${elementCounts[el]} = ${elementCounts[el]}`).join(' | ')}. Phương trình chuẩn: ${leftText} → ${rightText}.`,
  ];

  return {
    success: true,
    reactants,
    products,
    coefficients: coeffs,
    balancedText: `${leftText} → ${rightText}`,
    elementCounts,
    steps,
  };
}

// ============================================================================
// Custom Electrolyte & Electrolysis Analyzer
// ============================================================================

export interface AnalyzedElectrolyte {
  formula: string;
  displayFormula: string;
  name: string;
  type: 'strong_acid' | 'weak_acid' | 'strong_base' | 'weak_base' | 'neutral_salt' | 'none';
  dissociationEquation: string;
  reactants: { formula: string; display: string }[];
  products: { formula: string; display: string }[];
  solutionCoeffs: number[];
  kaOrKb?: number;
  stoichFactor: number;
  cationLabel: string;
  anionLabel: string;
  solutionColorHex: string;
  description: string;
}

export const KNOWN_ELECTROLYTES: Record<string, Omit<AnalyzedElectrolyte, 'formula'>> = {
  HCl: {
    displayFormula: 'HCl',
    name: 'Axit clohiđric (Chất điện li mạnh)',
    type: 'strong_acid',
    dissociationEquation: 'HCl → H⁺ + Cl⁻',
    reactants: [{ formula: 'HCl', display: 'HCl' }],
    products: [{ formula: 'H+', display: 'H⁺' }, { formula: 'Cl-', display: 'Cl⁻' }],
    solutionCoeffs: [1, 1, 1],
    stoichFactor: 1,
    cationLabel: 'H⁺',
    anionLabel: 'Cl⁻',
    solutionColorHex: '#38BDF8',
    description: 'Axit mạnh phân li hoàn toàn 100% thành ion H⁺ và Cl⁻; dung dịch dẫn điện rất mạnh.',
  },
  HNO3: {
    displayFormula: 'HNO₃',
    name: 'Axit nitric (Chất điện li mạnh)',
    type: 'strong_acid',
    dissociationEquation: 'HNO₃ → H⁺ + NO₃⁻',
    reactants: [{ formula: 'HNO3', display: 'HNO₃' }],
    products: [{ formula: 'H+', display: 'H⁺' }, { formula: 'NO3-', display: 'NO₃⁻' }],
    solutionCoeffs: [1, 1, 1],
    stoichFactor: 1,
    cationLabel: 'H⁺',
    anionLabel: 'NO₃⁻',
    solutionColorHex: '#38BDF8',
    description: 'Axit vô cơ mạnh điện li hoàn toàn 1 nấc tạo H⁺ và gốc nitrat NO₃⁻.',
  },
  H2SO4: {
    displayFormula: 'H₂SO₄',
    name: 'Axit sunfuric (Axit mạnh 2 nấc)',
    type: 'strong_acid',
    dissociationEquation: 'H₂SO₄ → 2H⁺ + SO₄²⁻',
    reactants: [{ formula: 'H2SO4', display: 'H₂SO₄' }],
    products: [{ formula: 'H+', display: 'H⁺' }, { formula: 'SO42-', display: 'SO₄²⁻' }],
    solutionCoeffs: [1, 2, 1],
    stoichFactor: 2,
    cationLabel: 'H⁺',
    anionLabel: 'SO₄²⁻',
    solutionColorHex: '#38BDF8',
    description: 'Axit mạnh hai nấc, giải phóng 2 ion H⁺ trên mỗi phân tử trong dung dịch loãng.',
  },
  CH3COOH: {
    displayFormula: 'CH₃COOH',
    name: 'Axit axetic (Chất điện li yếu)',
    type: 'weak_acid',
    dissociationEquation: 'CH₃COOH ⇌ CH₃COO⁻ + H⁺',
    reactants: [{ formula: 'CH3COOH', display: 'CH₃COOH' }],
    products: [{ formula: 'CH3COO-', display: 'CH₃COO⁻' }, { formula: 'H+', display: 'H⁺' }],
    solutionCoeffs: [1, 1, 1],
    kaOrKb: 1.8e-5,
    stoichFactor: 1,
    cationLabel: 'H⁺',
    anionLabel: 'CH₃COO⁻',
    solutionColorHex: '#60A5FA',
    description: 'Axit hữu cơ yếu (Ka = 1,8×10⁻⁵): phần lớn tồn tại ở dạng phân tử CH₃COOH chưa phân li.',
  },
  HF: {
    displayFormula: 'HF',
    name: 'Axit flohiđric (Chất điện li yếu)',
    type: 'weak_acid',
    dissociationEquation: 'HF ⇌ H⁺ + F⁻',
    reactants: [{ formula: 'HF', display: 'HF' }],
    products: [{ formula: 'H+', display: 'H⁺' }, { formula: 'F-', display: 'F⁻' }],
    solutionCoeffs: [1, 1, 1],
    kaOrKb: 6.8e-4,
    stoichFactor: 1,
    cationLabel: 'H⁺',
    anionLabel: 'F⁻',
    solutionColorHex: '#60A5FA',
    description: 'Khác với HCl/HBr/HI, HF là axit yếu do năng lượng liên kết H–F rất lớn và có liên kết hiđro.',
  },
  H3PO4: {
    displayFormula: 'H₃PO₄',
    name: 'Axit photphoric (Axit trung bình/yếu)',
    type: 'weak_acid',
    dissociationEquation: 'H₃PO₄ ⇌ H⁺ + H₂PO₄⁻',
    reactants: [{ formula: 'H3PO4', display: 'H₃PO₄' }],
    products: [{ formula: 'H+', display: 'H⁺' }, { formula: 'H2PO4-', display: 'H₂PO₄⁻' }],
    solutionCoeffs: [1, 1, 1],
    kaOrKb: 7.5e-3,
    stoichFactor: 1,
    cationLabel: 'H⁺',
    anionLabel: 'H₂PO₄⁻',
    solutionColorHex: '#60A5FA',
    description: 'Axit ba nấc có độ mạnh trung bình, phân li chủ yếu ở nấc 1 (Ka₁ = 7,5×10⁻³).',
  },
  NaOH: {
    displayFormula: 'NaOH',
    name: 'Natri hiđroxit (Bazơ mạnh)',
    type: 'strong_base',
    dissociationEquation: 'NaOH → Na⁺ + OH⁻',
    reactants: [{ formula: 'NaOH', display: 'NaOH' }],
    products: [{ formula: 'Na+', display: 'Na⁺' }, { formula: 'OH-', display: 'OH⁻' }],
    solutionCoeffs: [1, 1, 1],
    stoichFactor: 1,
    cationLabel: 'Na⁺',
    anionLabel: 'OH⁻',
    solutionColorHex: '#818CF8',
    description: 'Kiềm mạnh phân li hoàn toàn tạo ion Na⁺ và OH⁻, làm pH tăng cao (> 7).',
  },
  KOH: {
    displayFormula: 'KOH',
    name: 'Kali hiđroxit (Bazơ mạnh)',
    type: 'strong_base',
    dissociationEquation: 'KOH → K⁺ + OH⁻',
    reactants: [{ formula: 'KOH', display: 'KOH' }],
    products: [{ formula: 'K+', display: 'K⁺' }, { formula: 'OH-', display: 'OH⁻' }],
    solutionCoeffs: [1, 1, 1],
    stoichFactor: 1,
    cationLabel: 'K⁺',
    anionLabel: 'OH⁻',
    solutionColorHex: '#818CF8',
    description: 'Dung dịch kiềm mạnh điện li 100% thành K⁺ và OH⁻.',
  },
  'Ba(OH)2': {
    displayFormula: 'Ba(OH)₂',
    name: 'Bari hiđroxit (Kiềm mạnh 2 nấc)',
    type: 'strong_base',
    dissociationEquation: 'Ba(OH)₂ → Ba²⁺ + 2OH⁻',
    reactants: [{ formula: 'Ba(OH)2', display: 'Ba(OH)₂' }],
    products: [{ formula: 'Ba2+', display: 'Ba²⁺' }, { formula: 'OH-', display: 'OH⁻' }],
    solutionCoeffs: [1, 1, 2],
    stoichFactor: 2,
    cationLabel: 'Ba²⁺',
    anionLabel: 'OH⁻',
    solutionColorHex: '#818CF8',
    description: 'Mỗi phân tử Ba(OH)₂ giải phóng 2 ion OH⁻ nên pH cao hơn NaOH cùng nồng độ.',
  },
  NH3: {
    displayFormula: 'NH₃',
    name: 'Dung dịch Amoniac (Bazơ yếu)',
    type: 'weak_base',
    dissociationEquation: 'NH₃ + H₂O ⇌ NH₄⁺ + OH⁻',
    reactants: [{ formula: 'NH3', display: 'NH₃' }, { formula: 'H2O', display: 'H₂O' }],
    products: [{ formula: 'NH4+', display: 'NH₄⁺' }, { formula: 'OH-', display: 'OH⁻' }],
    solutionCoeffs: [1, 1, 1, 1],
    kaOrKb: 1.8e-5,
    stoichFactor: 1,
    cationLabel: 'NH₄⁺',
    anionLabel: 'OH⁻',
    solutionColorHex: '#A78BFA',
    description: 'Theo thuyết Brønsted–Lowry, NH₃ nhận proton H⁺ từ nước tạo NH₄⁺ và OH⁻ (Kb = 1,8×10⁻⁵).',
  },
  NaCl: {
    displayFormula: 'NaCl',
    name: 'Natri clorua (Muối trung tính)',
    type: 'neutral_salt',
    dissociationEquation: 'NaCl → Na⁺ + Cl⁻',
    reactants: [{ formula: 'NaCl', display: 'NaCl' }],
    products: [{ formula: 'Na+', display: 'Na⁺' }, { formula: 'Cl-', display: 'Cl⁻' }],
    solutionCoeffs: [1, 1, 1],
    stoichFactor: 1,
    cationLabel: 'Na⁺',
    anionLabel: 'Cl⁻',
    solutionColorHex: '#2DD4BF',
    description: 'Muối của bazơ mạnh và axit mạnh, điện li hoàn toàn và không thủy phân (pH = 7).',
  },
  CuSO4: {
    displayFormula: 'CuSO₄',
    name: 'Đồng(II) sunfat (Muối tan điện li mạnh)',
    type: 'weak_acid',
    dissociationEquation: 'CuSO₄ → Cu²⁺ + SO₄²⁻',
    reactants: [{ formula: 'CuSO4', display: 'CuSO₄' }],
    products: [{ formula: 'Cu2+', display: 'Cu²⁺' }, { formula: 'SO42-', display: 'SO₄²⁻' }],
    solutionCoeffs: [1, 1, 1],
    kaOrKb: 1.0e-8,
    stoichFactor: 1,
    cationLabel: 'Cu²⁺',
    anionLabel: 'SO₄²⁻',
    solutionColorHex: '#0284C7',
    description: 'Muối tan điện li hoàn toàn tạo dung dịch màu xanh lam của ion [Cu(H₂O)₆]²⁺; ion Cu²⁺ thủy phân nhẹ tạo môi trường axit yếu.',
  },
  FeCl3: {
    displayFormula: 'FeCl₃',
    name: 'Sắt(III) clorua (Muối thủy phân axit)',
    type: 'weak_acid',
    dissociationEquation: 'FeCl₃ → Fe³⁺ + 3Cl⁻',
    reactants: [{ formula: 'FeCl3', display: 'FeCl₃' }],
    products: [{ formula: 'Fe3+', display: 'Fe³⁺' }, { formula: 'Cl-', display: 'Cl⁻' }],
    solutionCoeffs: [1, 1, 3],
    kaOrKb: 6.3e-3,
    stoichFactor: 1,
    cationLabel: 'Fe³⁺',
    anionLabel: 'Cl⁻',
    solutionColorHex: '#D97706',
    description: 'Điện li hoàn toàn ra Fe³⁺ và 3 Cl⁻ màu vàng nâu; Fe³⁺ thủy phân mạnh tạo môi trường axit rõ rệt.',
  },
  Na2CO3: {
    displayFormula: 'Na₂CO₃',
    name: 'Natri cacbonat (Muối thủy phân bazơ)',
    type: 'weak_base',
    dissociationEquation: 'Na₂CO₃ → 2Na⁺ + CO₃²⁻',
    reactants: [{ formula: 'Na2CO3', display: 'Na₂CO₃' }],
    products: [{ formula: 'Na+', display: 'Na⁺' }, { formula: 'CO32-', display: 'CO₃²⁻' }],
    solutionCoeffs: [1, 2, 1],
    kaOrKb: 2.1e-4,
    stoichFactor: 1,
    cationLabel: 'Na⁺',
    anionLabel: 'CO₃²⁻',
    solutionColorHex: '#818CF8',
    description: 'Muối điện li hoàn toàn; ion CO₃²⁻ nhận H⁺ của nước tạo HCO₃⁻ và OH⁻ nên dung dịch có môi trường kiềm (pH > 7).',
  },
  NH4Cl: {
    displayFormula: 'NH₄Cl',
    name: 'Amoni clorua (Muối thủy phân axit)',
    type: 'weak_acid',
    dissociationEquation: 'NH₄Cl → NH₄⁺ + Cl⁻',
    reactants: [{ formula: 'NH4Cl', display: 'NH₄Cl' }],
    products: [{ formula: 'NH4+', display: 'NH₄⁺' }, { formula: 'Cl-', display: 'Cl⁻' }],
    solutionCoeffs: [1, 1, 1],
    kaOrKb: 5.6e-10,
    stoichFactor: 1,
    cationLabel: 'NH₄⁺',
    anionLabel: 'Cl⁻',
    solutionColorHex: '#38BDF8',
    description: 'Điện li hoàn toàn; ion NH₄⁺ nhường proton H⁺ cho nước nên dung dịch có tính axit nhẹ (pH < 7).',
  },
  C2H5OH: {
    displayFormula: 'C₂H₅OH',
    name: 'Etanol (Chất không điện li)',
    type: 'none',
    dissociationEquation: 'C₂H₅OH (l) → C₂H₅OH (aq) (không phân li thành ion)',
    reactants: [{ formula: 'C2H5OH', display: 'C₂H₅OH' }],
    products: [{ formula: 'C2H5OH', display: 'C₂H₅OH(aq)' }],
    solutionCoeffs: [1, 1],
    stoichFactor: 0,
    cationLabel: 'Phân tử C₂H₅OH',
    anionLabel: 'Không có ion',
    solutionColorHex: '#475569',
    description: 'Hợp chất cộng hóa trị không phân li thành ion trong nước → bóng đèn không sáng.',
  },
  C6H12O6: {
    displayFormula: 'C₆H₁₂O₆',
    name: 'Glucozơ (Chất không điện li)',
    type: 'none',
    dissociationEquation: 'C₆H₁₂O₆ (r) → C₆H₁₂O₆ (aq) (không phân li thành ion)',
    reactants: [{ formula: 'C6H12O6', display: 'C₆H₁₂O₆' }],
    products: [{ formula: 'C6H12O6', display: 'C₆H₁₂O₆(aq)' }],
    solutionCoeffs: [1, 1],
    stoichFactor: 0,
    cationLabel: 'Phân tử C₆H₁₂O₆',
    anionLabel: 'Không có ion',
    solutionColorHex: '#475569',
    description: 'Tan tốt nhờ liên kết hiđro với nước nhưng không sinh ion tự do nên không dẫn điện.',
  },
};

export function analyzeCustomElectrolyte(rawFormula: string): AnalyzedElectrolyte {
  const clean = normalizeFormula(rawFormula);
  const exactKey = Object.keys(KNOWN_ELECTROLYTES).find(
    (k) => k.toLowerCase() === clean.toLowerCase(),
  );
  if (exactKey) {
    return { formula: exactKey, ...KNOWN_ELECTROLYTES[exactKey] };
  }

  const disp = formatFormulaDisplay(clean || 'NaCl');
  const counts = parseFormulaCounts(clean);

  // Intelligent heuristic fallback for user-typed formulas
  if (/^H\d*[A-Z]/.test(clean) && !clean.startsWith('He') && !clean.startsWith('Hg') && clean !== 'H2O') {
    const hCount = counts.H ?? 1;
    const isStrong = ['HBr', 'HI', 'HClO4', 'HClO3'].includes(clean);
    return {
      formula: clean,
      displayFormula: disp,
      name: `${disp} (${isStrong ? 'Axit mạnh' : 'Axit yếu'})`,
      type: isStrong ? 'strong_acid' : 'weak_acid',
      dissociationEquation: `${disp} ${isStrong ? '→' : '⇌'} ${hCount > 1 ? hCount : ''}H⁺ + A${hCount > 1 ? `${hCount}⁻` : '⁻'}`,
      reactants: [{ formula: clean, display: disp }],
      products: [{ formula: 'H+', display: 'H⁺' }, { formula: 'Anion', display: 'Gốc axit⁻' }],
      solutionCoeffs: [1, hCount, 1],
      kaOrKb: isStrong ? undefined : 1.5e-4,
      stoichFactor: isStrong ? hCount : 1,
      cationLabel: 'H⁺',
      anionLabel: 'Gốc axit⁻',
      solutionColorHex: '#38BDF8',
      description: `Phân tích tự động cho axit ${disp}: giải phóng ion H⁺ làm pH < 7.`,
    };
  }

  if (clean.includes('OH') && !clean.includes('COOH')) {
    const ohCount = counts.O ?? 1;
    const metal = clean.replace(/\(OH\)\d*|OH/g, '');
    const isStrong = ['Li', 'Na', 'K', 'Ba', 'Ca', 'Sr'].includes(metal);
    return {
      formula: clean,
      displayFormula: disp,
      name: `${disp} (${isStrong ? 'Bazơ kiềm mạnh' : 'Bazơ ít tan/yếu'})`,
      type: isStrong ? 'strong_base' : 'weak_base',
      dissociationEquation: `${disp} ${isStrong ? '→' : '⇌'} ${metal || 'M'}ⁿ⁺ + ${ohCount > 1 ? ohCount : ''}OH⁻`,
      reactants: [{ formula: clean, display: disp }],
      products: [{ formula: metal || 'M', display: `${metal || 'M'}ⁿ⁺` }, { formula: 'OH-', display: 'OH⁻' }],
      solutionCoeffs: [1, 1, ohCount],
      kaOrKb: isStrong ? undefined : 1e-5,
      stoichFactor: ohCount,
      cationLabel: `${metal || 'M'}ⁿ⁺`,
      anionLabel: 'OH⁻',
      solutionColorHex: '#818CF8',
      description: `Phân tích tự động cho bazơ ${disp}: tạo ion OH⁻ làm pH > 7.`,
    };
  }

  if (counts.C && counts.H && !counts.Na && !counts.K && !counts.Ca && !counts.Cu && !counts.Fe) {
    return {
      formula: clean,
      displayFormula: disp,
      name: `${disp} (Hợp chất hữu cơ không điện li)`,
      type: 'none',
      dissociationEquation: `${disp} → ${disp} (aq) (không phân li thành ion)`,
      reactants: [{ formula: clean, display: disp }],
      products: [{ formula: clean, display: `${disp}(aq)` }],
      solutionCoeffs: [1, 1],
      stoichFactor: 0,
      cationLabel: `Phân tử ${disp}`,
      anionLabel: 'Không có ion',
      solutionColorHex: '#475569',
      description: `Hợp chất phân tử ${disp} không sinh ra ion tự do trong nước.`,
    };
  }

  return {
    formula: clean || 'NaCl',
    displayFormula: disp,
    name: `${disp} (Muối điện li mạnh)`,
    type: 'neutral_salt',
    dissociationEquation: `${disp} → Cation⁺ + Anion⁻`,
    reactants: [{ formula: clean || 'NaCl', display: disp }],
    products: [{ formula: 'Cation', display: 'Mⁿ⁺' }, { formula: 'Anion', display: 'Xᵐ⁻' }],
    solutionCoeffs: [1, 1, 1],
    stoichFactor: 1,
    cationLabel: 'Mⁿ⁺',
    anionLabel: 'Xᵐ⁻',
    solutionColorHex: '#2DD4BF',
    description: `Muối tan ${disp} phân li hoàn toàn thành các ion tự do dẫn điện.`,
  };
}

export type ElectrolysisModeType = 'aqueous' | 'molten' | 'electroplating';

export interface AnalyzedElectrolysisCell {
  id: string;
  formula: string;
  title: string;
  modeType: ElectrolysisModeType;
  modeLabel: 'Điện phân dung dịch' | 'Điện phân nóng chảy' | 'Mạ điện (Anot tan)';
  cathodeReaction: string;
  anodeReaction: string;
  overallEquation: string;
  equationReactants: { formula: string; display: string }[];
  equationProducts: { formula: string; display: string }[];
  equationCoeffs: number[];
  cathodeProductName: string;
  cathodeMolarMass: number;
  cathodeElectrons: number;
  cathodeIsGas: boolean;
  cathodeColor: string;
  anodeProductName: string;
  anodeMolarMass: number;
  anodeElectrons: number;
  anodeIsGas: boolean;
  anodeDissolves?: boolean;
  anodeReactsInSolution?: boolean;
  hasMembrane?: boolean;
  secondaryReaction?: string;
  solutionColor: string;
  cationFormula: string;
  anionFormula: string;
  note: string;
}

export const PRESET_ELECTROLYSIS_CELLS: AnalyzedElectrolysisCell[] = [
  {
    id: 'cuso4_aq',
    formula: 'CuSO4',
    title: 'Điện phân dung dịch CuSO₄ (điện cực trơ Pt/Graphite)',
    modeType: 'aqueous',
    modeLabel: 'Điện phân dung dịch',
    cathodeReaction: 'Cu²⁺ + 2e → Cu↓ (bám đỏ cam ở Catot)',
    anodeReaction: '2H₂O → O₂↑ + 4H⁺ + 4e (khí không màu ở Anot)',
    overallEquation: '2CuSO₄ + 2H₂O → 2Cu↓ + O₂↑ + 2H₂SO₄',
    equationReactants: [{ formula: 'CuSO4', display: 'CuSO₄' }, { formula: 'H2O', display: 'H₂O' }],
    equationProducts: [{ formula: 'Cu', display: 'Cu↓' }, { formula: 'O2', display: 'O₂↑' }, { formula: 'H2SO4', display: 'H₂SO₄' }],
    equationCoeffs: [2, 2, 2, 1, 2],
    cathodeProductName: 'Đồng (Cu)',
    cathodeMolarMass: 63.546,
    cathodeElectrons: 2,
    cathodeIsGas: false,
    cathodeColor: '#EA580C',
    anodeProductName: 'Khí O₂',
    anodeMolarMass: 32,
    anodeElectrons: 4,
    anodeIsGas: true,
    solutionColor: '#0284C7',
    cationFormula: 'Cu²⁺',
    anionFormula: 'SO₄²⁻',
    note: 'Dung dịch nhạt dần màu xanh lam và pH giảm do sinh ra axit H₂SO₄.',
  },
  {
    id: 'cu_plating',
    formula: 'CuSO4',
    title: 'Mạ đồng lên vật kim loại (Anot Cu tan trong dd CuSO₄)',
    modeType: 'electroplating',
    modeLabel: 'Mạ điện (Anot tan)',
    cathodeReaction: 'Cu²⁺ + 2e → Cu↓ (lớp mạ đồng đỏ sáng phủ lên vật cần mạ)',
    anodeReaction: 'Cu (anot) → Cu²⁺ + 2e (Anot đồng tan dần bù ion Cu²⁺)',
    overallEquation: 'Cu (anot) + Cu²⁺ → Cu²⁺ + Cu (catot)',
    equationReactants: [{ formula: 'Cu', display: 'Cu (anot)' }, { formula: 'CuSO4', display: 'CuSO₄' }],
    equationProducts: [{ formula: 'CuSO4', display: 'CuSO₄' }, { formula: 'Cu', display: 'Cu (mạ)' }],
    equationCoeffs: [1, 1, 1, 1],
    cathodeProductName: 'Lớp mạ Đồng (Cu)',
    cathodeMolarMass: 63.546,
    cathodeElectrons: 2,
    cathodeIsGas: false,
    cathodeColor: '#F97316',
    anodeProductName: 'Cu tan vào dd',
    anodeMolarMass: 63.546,
    anodeElectrons: 2,
    anodeIsGas: false,
    anodeDissolves: true,
    solutionColor: '#0284C7',
    cationFormula: 'Cu²⁺',
    anionFormula: 'SO₄²⁻',
    note: 'Hiện tượng dương cực tan: nồng độ CuSO₄ không đổi vì lượng Cu tan ở Anot bằng lượng Cu bám vào Catot.',
  },
  {
    id: 'ag_plating',
    formula: 'AgNO3',
    title: 'Mạ bạc trang sức (Anot Ag tan trong dd AgNO₃)',
    modeType: 'electroplating',
    modeLabel: 'Mạ điện (Anot tan)',
    cathodeReaction: 'Ag⁺ + 1e → Ag↓ (bạc trắng sáng bám mịn lên vật cần mạ)',
    anodeReaction: 'Ag (anot) → Ag⁺ + 1e (thanh bạc Anot tan dần)',
    overallEquation: 'Ag (anot) + AgNO₃ → AgNO₃ + Ag (mạ)',
    equationReactants: [{ formula: 'Ag', display: 'Ag (anot)' }, { formula: 'AgNO3', display: 'AgNO₃' }],
    equationProducts: [{ formula: 'AgNO3', display: 'AgNO₃' }, { formula: 'Ag', display: 'Ag (mạ)' }],
    equationCoeffs: [1, 1, 1, 1],
    cathodeProductName: 'Lớp mạ Bạc (Ag)',
    cathodeMolarMass: 107.87,
    cathodeElectrons: 1,
    cathodeIsGas: false,
    cathodeColor: '#E2E8F0',
    anodeProductName: 'Ag tan vào dd',
    anodeMolarMass: 107.87,
    anodeElectrons: 1,
    anodeIsGas: false,
    anodeDissolves: true,
    solutionColor: '#38BDF8',
    cationFormula: 'Ag⁺',
    anionFormula: 'NO₃⁻',
    note: 'Kỹ thuật mạ bạc công nghiệp giúp bề mặt sáng bóng, chống oxi hóa và dẫn điện tốt.',
  },
  {
    id: 'ni_plating',
    formula: 'NiSO4',
    title: 'Mạ Niken chống gỉ (Anot Ni tan trong dd NiSO₄)',
    modeType: 'electroplating',
    modeLabel: 'Mạ điện (Anot tan)',
    cathodeReaction: 'Ni²⁺ + 2e → Ni↓ (lớp mạ niken trắng ánh vàng bền chắc)',
    anodeReaction: 'Ni (anot) → Ni²⁺ + 2e (thanh Niken Anot tan dần)',
    overallEquation: 'Ni (anot) + NiSO₄ → NiSO₄ + Ni (mạ)',
    equationReactants: [{ formula: 'Ni', display: 'Ni (anot)' }, { formula: 'NiSO4', display: 'NiSO₄' }],
    equationProducts: [{ formula: 'NiSO4', display: 'NiSO₄' }, { formula: 'Ni', display: 'Ni (mạ)' }],
    equationCoeffs: [1, 1, 1, 1],
    cathodeProductName: 'Lớp mạ Niken (Ni)',
    cathodeMolarMass: 58.693,
    cathodeElectrons: 2,
    cathodeIsGas: false,
    cathodeColor: '#CBD5E1',
    anodeProductName: 'Ni tan vào dd',
    anodeMolarMass: 58.693,
    anodeElectrons: 2,
    anodeIsGas: false,
    anodeDissolves: true,
    solutionColor: '#10B981',
    cationFormula: 'Ni²⁺',
    anionFormula: 'SO₄²⁻',
    note: 'Dung dịch NiSO₄ có màu xanh lục ngọc đặc trưng; mạ Niken bảo vệ thép khỏi ăn mòn.',
  },
  {
    id: 'nacl_aq',
    formula: 'NaCl',
    title: 'Điện phân dung dịch NaCl bão hòa (có màng ngăn)',
    modeType: 'aqueous',
    modeLabel: 'Điện phân dung dịch',
    cathodeReaction: '2H₂O + 2e → H₂↑ + 2OH⁻ (khí H₂ thoát ra ở Catot)',
    anodeReaction: '2Cl⁻ → Cl₂↑ + 2e (khí Cl₂ vàng lục ở Anot)',
    overallEquation: '2NaCl + 2H₂O → 2NaOH + H₂↑ + Cl₂↑',
    equationReactants: [{ formula: 'NaCl', display: 'NaCl' }, { formula: 'H2O', display: 'H₂O' }],
    equationProducts: [{ formula: 'NaOH', display: 'NaOH' }, { formula: 'H2', display: 'H₂↑' }, { formula: 'Cl2', display: 'Cl₂↑' }],
    equationCoeffs: [2, 2, 2, 1, 1],
    cathodeProductName: 'Khí H₂',
    cathodeMolarMass: 2.016,
    cathodeElectrons: 2,
    cathodeIsGas: true,
    cathodeColor: '#E2E8F0',
    anodeProductName: 'Khí Cl₂',
    anodeMolarMass: 70.9,
    anodeElectrons: 2,
    anodeIsGas: true,
    solutionColor: '#0EA5E9',
    cationFormula: 'Na⁺',
    anionFormula: 'Cl⁻',
    note: 'Công nghiệp sản xuất xút (NaOH) và khí Clo (Cl₂); nếu không có màng ngăn thu được nước Javel (NaClO).',
  },
  {
    id: 'cucl2_aq',
    formula: 'CuCl2',
    title: 'Điện phân dung dịch CuCl₂ (điện cực trơ)',
    modeType: 'aqueous',
    modeLabel: 'Điện phân dung dịch',
    cathodeReaction: 'Cu²⁺ + 2e → Cu↓ (đồng đỏ cam bám Catot)',
    anodeReaction: '2Cl⁻ → Cl₂↑ + 2e (khí Cl₂ vàng lục thoát ra ở Anot)',
    overallEquation: 'CuCl₂ → Cu↓ + Cl₂↑',
    equationReactants: [{ formula: 'CuCl2', display: 'CuCl₂' }],
    equationProducts: [{ formula: 'Cu', display: 'Cu↓' }, { formula: 'Cl2', display: 'Cl₂↑' }],
    equationCoeffs: [1, 1, 1],
    cathodeProductName: 'Đồng (Cu)',
    cathodeMolarMass: 63.546,
    cathodeElectrons: 2,
    cathodeIsGas: false,
    cathodeColor: '#EA580C',
    anodeProductName: 'Khí Cl₂',
    anodeMolarMass: 70.9,
    anodeElectrons: 2,
    anodeIsGas: true,
    solutionColor: '#0D9488',
    cationFormula: 'Cu²⁺',
    anionFormula: 'Cl⁻',
    note: 'Cả Cu²⁺ và Cl⁻ đều bị điện phân trực tiếp, nước chưa tham gia phản ứng khi muối chưa hết.',
  },
  {
    id: 'agno3_aq',
    formula: 'AgNO3',
    title: 'Điện phân dung dịch AgNO₃ (điện cực trơ)',
    modeType: 'aqueous',
    modeLabel: 'Điện phân dung dịch',
    cathodeReaction: 'Ag⁺ + 1e → Ag↓ (bạc trắng sáng bám Catot)',
    anodeReaction: '2H₂O → O₂↑ + 4H⁺ + 4e (khí O₂ ở Anot)',
    overallEquation: '4AgNO₃ + 2H₂O → 4Ag↓ + O₂↑ + 4HNO₃',
    equationReactants: [{ formula: 'AgNO3', display: 'AgNO₃' }, { formula: 'H2O', display: 'H₂O' }],
    equationProducts: [{ formula: 'Ag', display: 'Ag↓' }, { formula: 'O2', display: 'O₂↑' }, { formula: 'HNO3', display: 'HNO₃' }],
    equationCoeffs: [4, 2, 4, 1, 4],
    cathodeProductName: 'Bạc (Ag)',
    cathodeMolarMass: 107.87,
    cathodeElectrons: 1,
    cathodeIsGas: false,
    cathodeColor: '#F1F5F9',
    anodeProductName: 'Khí O₂',
    anodeMolarMass: 32,
    anodeElectrons: 4,
    anodeIsGas: true,
    solutionColor: '#38BDF8',
    cationFormula: 'Ag⁺',
    anionFormula: 'NO₃⁻',
    note: 'Dung dịch sau điện phân có môi trường axit HNO₃ mạnh.',
  },
  {
    id: 'nacl_nc',
    formula: 'NaCl',
    title: 'Điện phân NaCl nóng chảy (Điều chế Natri)',
    modeType: 'molten',
    modeLabel: 'Điện phân nóng chảy',
    cathodeReaction: 'Na⁺ + 1e → Na (natri lỏng nổi lên ở Catot)',
    anodeReaction: '2Cl⁻ → Cl₂↑ + 2e (khí Cl₂ vàng lục ở Anot)',
    overallEquation: '2NaCl → 2Na + Cl₂↑',
    equationReactants: [{ formula: 'NaCl', display: 'NaCl' }],
    equationProducts: [{ formula: 'Na', display: 'Na' }, { formula: 'Cl2', display: 'Cl₂↑' }],
    equationCoeffs: [2, 2, 1],
    cathodeProductName: 'Natri (Na)',
    cathodeMolarMass: 22.99,
    cathodeElectrons: 1,
    cathodeIsGas: false,
    cathodeColor: '#E2E8F0',
    anodeProductName: 'Khí Cl₂',
    anodeMolarMass: 70.9,
    anodeElectrons: 2,
    anodeIsGas: true,
    solutionColor: '#EA580C',
    cationFormula: 'Na⁺',
    anionFormula: 'Cl⁻',
    note: 'Nhiệt độ nóng chảy ~801°C; kim loại mạnh (IA, IIA, Al) bắt buộc điều chế bằng điện phân nóng chảy.',
  },
  {
    id: 'mgcl2_nc',
    formula: 'MgCl2',
    title: 'Điện phân MgCl₂ nóng chảy (Điều chế Magie)',
    modeType: 'molten',
    modeLabel: 'Điện phân nóng chảy',
    cathodeReaction: 'Mg²⁺ + 2e → Mg (kim loại magie ở Catot)',
    anodeReaction: '2Cl⁻ → Cl₂↑ + 2e (khí Cl₂ ở Anot)',
    overallEquation: 'MgCl₂ → Mg + Cl₂↑',
    equationReactants: [{ formula: 'MgCl2', display: 'MgCl₂' }],
    equationProducts: [{ formula: 'Mg', display: 'Mg' }, { formula: 'Cl2', display: 'Cl₂↑' }],
    equationCoeffs: [1, 1, 1],
    cathodeProductName: 'Magie (Mg)',
    cathodeMolarMass: 24.305,
    cathodeElectrons: 2,
    cathodeIsGas: false,
    cathodeColor: '#CBD5E1',
    anodeProductName: 'Khí Cl₂',
    anodeMolarMass: 70.9,
    anodeElectrons: 2,
    anodeIsGas: true,
    solutionColor: '#F59E0B',
    cationFormula: 'Mg²⁺',
    anionFormula: 'Cl⁻',
    note: 'Phương pháp công nghiệp chủ yếu sản xuất kim loại nhẹ Magie (~714°C).',
  },
  {
    id: 'al2o3_nc',
    formula: 'Al2O3',
    title: 'Điện phân Al₂O₃ nóng chảy (có Criolit Na₃AlF₆)',
    modeType: 'molten',
    modeLabel: 'Điện phân nóng chảy',
    cathodeReaction: 'Al³⁺ + 3e → Al (nhôm lỏng lắng đáy Catot)',
    anodeReaction: '2O²⁻ → O₂↑ + 4e (khí O₂ sinh ra ở Anot than chì)',
    overallEquation: '2Al₂O₃ → 4Al + 3O₂↑',
    equationReactants: [{ formula: 'Al2O3', display: 'Al₂O₃' }],
    equationProducts: [{ formula: 'Al', display: 'Al' }, { formula: 'O2', display: 'O₂↑' }],
    equationCoeffs: [2, 4, 3],
    cathodeProductName: 'Nhôm (Al)',
    cathodeMolarMass: 26.982,
    cathodeElectrons: 3,
    cathodeIsGas: false,
    cathodeColor: '#94A3B8',
    anodeProductName: 'Khí O₂',
    anodeMolarMass: 32,
    anodeElectrons: 4,
    anodeIsGas: true,
    solutionColor: '#F97316',
    cationFormula: 'Al³⁺',
    anionFormula: 'O²⁻',
    note: 'Criolit (Na₃AlF₆) hạ nhiệt độ nóng chảy từ 2050°C xuống ~950°C, tăng độ dẫn điện và tạo lớp xỉ bảo vệ Al lỏng.',
  },
];

const ACTIVE_CATIONS: Record<string, { val: number; mass: number; afterAl: boolean; color: string; metalColor: string; name: string }> = {
  Ag: { val: 1, mass: 107.87, afterAl: true, color: '#38BDF8', metalColor: '#F1F5F9', name: 'Bạc (Ag)' },
  Cu: { val: 2, mass: 63.546, afterAl: true, color: '#0284C7', metalColor: '#EA580C', name: 'Đồng (Cu)' },
  Ni: { val: 2, mass: 58.693, afterAl: true, color: '#10B981', metalColor: '#CBD5E1', name: 'Niken (Ni)' },
  Zn: { val: 2, mass: 65.38, afterAl: true, color: '#38BDF8', metalColor: '#94A3B8', name: 'Kẽm (Zn)' },
  Fe: { val: 2, mass: 55.845, afterAl: true, color: '#22C55E', metalColor: '#64748B', name: 'Sắt (Fe)' },
  Pb: { val: 2, mass: 207.2, afterAl: true, color: '#38BDF8', metalColor: '#64748B', name: 'Chì (Pb)' },
  Na: { val: 1, mass: 22.99, afterAl: false, color: '#0EA5E9', metalColor: '#E2E8F0', name: 'Natri (Na)' },
  K: { val: 1, mass: 39.098, afterAl: false, color: '#0EA5E9', metalColor: '#E2E8F0', name: 'Kali (K)' },
  Ca: { val: 2, mass: 40.078, afterAl: false, color: '#0EA5E9', metalColor: '#CBD5E1', name: 'Canxi (Ca)' },
  Mg: { val: 2, mass: 24.305, afterAl: false, color: '#0EA5E9', metalColor: '#CBD5E1', name: 'Magie (Mg)' },
  Al: { val: 3, mass: 26.982, afterAl: false, color: '#0EA5E9', metalColor: '#94A3B8', name: 'Nhôm (Al)' },
};

export function analyzeCustomElectrolysis(
  rawFormula: string,
  modeType: ElectrolysisModeType,
): AnalyzedElectrolysisCell {
  const clean = normalizeFormula(rawFormula) || 'CuSO4';
  const presetMatch = PRESET_ELECTROLYSIS_CELLS.find(
    (c) => c.formula.toLowerCase() === clean.toLowerCase() && c.modeType === modeType,
  );
  if (presetMatch) return presetMatch;

  const disp = formatFormulaDisplay(clean);
  const counts = parseFormulaCounts(clean);
  const metalKey = Object.keys(ACTIVE_CATIONS).find((m) => (counts[m] ?? 0) > 0) ?? 'Cu';
  const metal = ACTIVE_CATIONS[metalKey];
  const hasHalideCl = (counts.Cl ?? 0) > 0;
  const hasHalideBr = (counts.Br ?? 0) > 0;
  const hasHalideI = (counts.I ?? 0) > 0;
  const halideSymbol = hasHalideCl ? 'Cl' : hasHalideBr ? 'Br' : hasHalideI ? 'I' : null;
  const halideMass = hasHalideCl ? 70.9 : hasHalideBr ? 159.8 : 253.8;

  if (modeType === 'electroplating') {
    const val = metal.val;
    return {
      id: `custom_plate_${clean}`,
      formula: clean,
      title: `Mạ ${metal.name} từ dung dịch ${disp} (Anot ${metalKey} tan)`,
      modeType: 'electroplating',
      modeLabel: 'Mạ điện (Anot tan)',
      cathodeReaction: `${metalKey}${val > 1 ? `${val}⁺` : '⁺'} + ${val}e → ${metalKey}↓ (bám lên vật cần mạ)`,
      anodeReaction: `${metalKey} (anot) → ${metalKey}${val > 1 ? `${val}⁺` : '⁺'} + ${val}e (Anot tan bù ion)`,
      overallEquation: `${metalKey} (anot) + ${disp} → ${disp} + ${metalKey} (mạ)`,
      equationReactants: [{ formula: metalKey, display: `${metalKey} (anot)` }, { formula: clean, display: disp }],
      equationProducts: [{ formula: clean, display: disp }, { formula: metalKey, display: `${metalKey} (mạ)` }],
      equationCoeffs: [1, 1, 1, 1],
      cathodeProductName: `Lớp mạ ${metal.name}`,
      cathodeMolarMass: metal.mass,
      cathodeElectrons: val,
      cathodeIsGas: false,
      cathodeColor: metal.metalColor,
      anodeProductName: `${metalKey} tan vào dd`,
      anodeMolarMass: metal.mass,
      anodeElectrons: val,
      anodeIsGas: false,
      anodeDissolves: true,
      solutionColor: metal.color,
      cationFormula: `${metalKey}${val > 1 ? `${val}⁺` : '⁺'}`,
      anionFormula: halideSymbol ? `${halideSymbol}⁻` : 'SO₄²⁻',
      note: `Mạ điện dùng cực dương làm bằng kim loại mạ (${metalKey}) để giữ nồng độ muối ${disp} ổn định suốt quá trình.`,
    };
  }

  if (modeType === 'molten') {
    const isOxide = !halideSymbol && (counts.O ?? 0) > 0 && !(counts.OH);
    const anionFormula = halideSymbol ? `${halideSymbol}⁻` : isOxide ? 'O²⁻' : 'OH⁻';
    const anodeProdFormula = halideSymbol ? `${halideSymbol}2` : 'O2';
    const anodeProdDisplay = halideSymbol ? `${halideSymbol}₂↑` : 'O₂↑';
    const solved = solveChemicalEquation(`${clean} -> ${metalKey} + ${anodeProdFormula}`);
    return {
      id: `custom_molten_${clean}`,
      formula: clean,
      title: `Điện phân ${disp} nóng chảy`,
      modeType: 'molten',
      modeLabel: 'Điện phân nóng chảy',
      cathodeReaction: `${metalKey}${metal.val > 1 ? `${metal.val}⁺` : '⁺'} + ${metal.val}e → ${metalKey}`,
      anodeReaction: halideSymbol
        ? `2${halideSymbol}⁻ → ${halideSymbol}₂↑ + 2e`
        : '2O²⁻ → O₂↑ + 4e',
      overallEquation: solved.success ? solved.balancedText : `${disp} → ${metalKey} + ${anodeProdDisplay}`,
      equationReactants: solved.success ? solved.reactants : [{ formula: clean, display: disp }],
      equationProducts: solved.success
        ? solved.products
        : [{ formula: metalKey, display: metalKey }, { formula: anodeProdFormula, display: anodeProdDisplay }],
      equationCoeffs: solved.success ? solved.coefficients : [1, 1, 1],
      cathodeProductName: metal.name,
      cathodeMolarMass: metal.mass,
      cathodeElectrons: metal.val,
      cathodeIsGas: false,
      cathodeColor: metal.metalColor,
      anodeProductName: `Khí ${anodeProdDisplay.replace('↑', '')}`,
      anodeMolarMass: halideSymbol ? halideMass : 32,
      anodeElectrons: halideSymbol ? 2 : 4,
      anodeIsGas: true,
      solutionColor: '#EA580C',
      cationFormula: `${metalKey}${metal.val > 1 ? `${metal.val}⁺` : '⁺'}`,
      anionFormula,
      note: `Ở trạng thái nóng chảy không có mặt nước, cation ${metalKey} bị khử trực tiếp tại Catot (-).`,
    };
  }

  // Aqueous electrolysis (điện cực trơ)
  const cathodeGas = !metal.afterAl;
  const anodeGasFormula = halideSymbol ? `${halideSymbol}2` : 'O2';
  const anodeGasDisplay = halideSymbol ? `${halideSymbol}₂↑` : 'O₂↑';

  let eqStr = '';
  if (!cathodeGas && halideSymbol) {
    eqStr = `${clean} -> ${metalKey} + ${anodeGasFormula}`;
  } else if (!cathodeGas && !halideSymbol) {
    const acidFormula = (counts.N ?? 0) > 0 ? 'HNO3' : 'H2SO4';
    eqStr = `${clean} + H2O -> ${metalKey} + O2 + ${acidFormula}`;
  } else if (cathodeGas && halideSymbol) {
    const baseFormula = `${metalKey}${metal.val > 1 ? `(OH)${metal.val}` : 'OH'}`;
    eqStr = `${clean} + H2O -> ${baseFormula} + H2 + ${anodeGasFormula}`;
  } else {
    // Both water -> 2H2O -> 2H2 + O2
    eqStr = 'H2O -> H2 + O2';
  }

  const solved = solveChemicalEquation(eqStr);
  return {
    id: `custom_aq_${clean}`,
    formula: clean,
    title: `Điện phân dung dịch ${disp} (điện cực trơ)`,
    modeType: 'aqueous',
    modeLabel: 'Điện phân dung dịch',
    cathodeReaction: cathodeGas
      ? `2H₂O + 2e → H₂↑ + 2OH⁻ (${metalKey} đứng trước Al nên H₂O điện phân thay)`
      : `${metalKey}${metal.val > 1 ? `${metal.val}⁺` : '⁺'} + ${metal.val}e → ${metalKey}↓ (bám trên Catot)`,
    anodeReaction: halideSymbol
      ? `2${halideSymbol}⁻ → ${halideSymbol}₂↑ + 2e`
      : '2H₂O → O₂↑ + 4H⁺ + 4e (gốc axit có oxi không bị điện phân)',
    overallEquation: solved.success ? solved.balancedText : eqStr,
    equationReactants: solved.success ? solved.reactants : [{ formula: clean, display: disp }],
    equationProducts: solved.success ? solved.products : [{ formula: 'H2', display: 'H₂↑' }, { formula: 'O2', display: 'O₂↑' }],
    equationCoeffs: solved.success ? solved.coefficients : [2, 2, 1],
    cathodeProductName: cathodeGas ? 'Khí H₂' : metal.name,
    cathodeMolarMass: cathodeGas ? 2.016 : metal.mass,
    cathodeElectrons: cathodeGas ? 2 : metal.val,
    cathodeIsGas: cathodeGas,
    cathodeColor: cathodeGas ? '#E2E8F0' : metal.metalColor,
    anodeProductName: `Khí ${anodeGasDisplay.replace('↑', '')}`,
    anodeMolarMass: halideSymbol ? halideMass : 32,
    anodeElectrons: halideSymbol ? 2 : 4,
    anodeIsGas: true,
    solutionColor: metal.color,
    cationFormula: `${metalKey}${metal.val > 1 ? `${metal.val}⁺` : '⁺'}`,
    anionFormula: halideSymbol ? `${halideSymbol}⁻` : (counts.N ?? 0) > 0 ? 'NO₃⁻' : 'SO₄²⁻',
    note: cathodeGas && !halideSymbol
      ? `Cả ${metalKey} (đứng trước Al) và gốc axit có oxi đều không bị điện phân → Thực chất là điện phân nước.`
      : `Phân tích tự động theo dãy điện hóa và thứ tự phóng điện trên điện cực trơ cho ${disp}.`,
  };
}

export function applyMembraneOption(
  cell: AnalyzedElectrolysisCell,
  hasMembrane: boolean,
): AnalyzedElectrolysisCell {
  if (cell.modeType !== 'aqueous') {
    return { ...cell, hasMembrane: false };
  }

  const counts = parseFormulaCounts(cell.formula);
  const halideSymbol =
    (counts.Cl ?? 0) > 0
      ? 'Cl'
      : (counts.Br ?? 0) > 0
        ? 'Br'
        : (counts.I ?? 0) > 0
          ? 'I'
          : null;
  const metalKey =
    Object.keys(ACTIVE_CATIONS).find((m) => (counts[m] ?? 0) > 0) ?? 'Na';
  const metal = ACTIVE_CATIONS[metalKey];
  const disp = formatFormulaDisplay(cell.formula);

  // Case 1: Alkali/alkaline-earth halide (e.g. NaCl, KCl, KBr, CaCl2) -> Javel / Chlorate when NO membrane
  if (!metal.afterAl && halideSymbol) {
    if (hasMembrane) {
      const baseFormula = `${metalKey}${metal.val > 1 ? `(OH)${metal.val}` : 'OH'}`;
      const solved = solveChemicalEquation(
        `${cell.formula} + H2O -> ${baseFormula} + H2 + ${halideSymbol}2`,
      );
      return {
        ...cell,
        hasMembrane: true,
        anodeIsGas: true,
        anodeReactsInSolution: false,
        title: `Điện phân dung dịch ${disp} (có màng ngăn xốp)`,
        anodeReaction: `2${halideSymbol}⁻ → ${halideSymbol}₂↑ + 2e (khí ${halideSymbol}₂ tách riêng ở ngăn Anot)`,
        overallEquation: solved.success
          ? `${solved.balancedText} (đpdd, có màng ngăn)`
          : cell.overallEquation,
        equationReactants: solved.success ? solved.reactants : cell.equationReactants,
        equationProducts: solved.success ? solved.products : cell.equationProducts,
        equationCoeffs: solved.success ? solved.coefficients : cell.equationCoeffs,
        anodeProductName: `Khí ${halideSymbol}₂`,
        secondaryReaction: undefined,
        note: `Màng ngăn xốp ngăn không cho ${halideSymbol}₂ khuếch tán sang gặp ${formatFormulaDisplay(baseFormula)}, thu được kiềm và khí ${halideSymbol}₂ tinh khiết.`,
      };
    }

    // Without membrane: X2 reacts with OH- to form hypohalite (e.g., NaClO - nước Javel)
    const oxySalt =
      metal.val > 1 ? `${metalKey}(${halideSymbol}O)2` : `${metalKey}${halideSymbol}O`;
    const solvedNoMem = solveChemicalEquation(`${cell.formula} + H2O -> ${oxySalt} + H2`);
    const baseFormula = `${metalKey}${metal.val > 1 ? `(OH)${metal.val}` : 'OH'}`;
    return {
      ...cell,
      hasMembrane: false,
      anodeIsGas: true,
      anodeReactsInSolution: true,
      title: `Điện phân dung dịch ${disp} (không màng ngăn → Nước Javel)`,
      anodeReaction: `2${halideSymbol}⁻ → ${halideSymbol}₂ + 2e, sau đó ${halideSymbol}₂ + 2OH⁻ → ${halideSymbol}⁻ + ${halideSymbol}O⁻ + H₂O`,
      overallEquation: solvedNoMem.success
        ? `${solvedNoMem.balancedText} (đpdd, không màng ngăn)`
        : `${disp} + H₂O → ${formatFormulaDisplay(oxySalt)} + H₂↑`,
      equationReactants: solvedNoMem.success
        ? solvedNoMem.reactants
        : [{ formula: cell.formula, display: disp }, { formula: 'H2O', display: 'H₂O' }],
      equationProducts: solvedNoMem.success
        ? solvedNoMem.products
        : [{ formula: oxySalt, display: formatFormulaDisplay(oxySalt) }, { formula: 'H2', display: 'H₂↑' }],
      equationCoeffs: solvedNoMem.success ? solvedNoMem.coefficients : [1, 1, 1, 1],
      anodeProductName: `${halideSymbol}₂ → ${formatFormulaDisplay(oxySalt)} (dd)`,
      secondaryReaction: `${halideSymbol}₂ + 2${formatFormulaDisplay(baseFormula)} → ${disp} + ${formatFormulaDisplay(oxySalt)} + H₂O`,
      note: `Không có màng ngăn nên ${halideSymbol}₂ sinh ra ở Anot hòa tan và phản ứng ngay với ${formatFormulaDisplay(baseFormula)} tạo dung dịch tẩy rửa (${formatFormulaDisplay(oxySalt)}); chỉ có khí H₂ thoát ra ngoài.`,
    };
  }

  // Case 2: Copper/Silver/Heavy-metal halide (e.g. CuCl2)
  if (metal.afterAl && halideSymbol) {
    if (hasMembrane) {
      return {
        ...cell,
        hasMembrane: true,
        anodeReactsInSolution: false,
        title: `Điện phân dung dịch ${disp} (có màng ngăn xốp)`,
        note: `Màng ngăn tách riêng ngăn Catot (${metalKey} bám) và ngăn Anot (khí ${halideSymbol}₂ thoát), hạn chế ${halideSymbol}₂ hòa tan ăn mòn ngược lại ${metalKey}.`,
      };
    }
    return {
      ...cell,
      hasMembrane: false,
      anodeReactsInSolution: false,
      title: `Điện phân dung dịch ${disp} (không màng ngăn)`,
      secondaryReaction: `${metalKey} + ${halideSymbol}₂ (tan) → ${disp} (hòa tan phụ nếu để lâu)`,
      note: `Không có màng ngăn: phản ứng chính vẫn là ${cell.overallEquation}, tuy nhiên một phần nhỏ ${halideSymbol}₂ tan có thể khuếch tán sang làm hao hụt nhẹ lớp ${metalKey} ở Catot.`,
    };
  }

  // Case 3: CuSO4 / AgNO3 / oxo-acid salts or water electrolysis
  if (hasMembrane) {
    const acidName = (counts.N ?? 0) > 0 ? 'HNO₃' : 'H₂SO₄';
    return {
      ...cell,
      hasMembrane: true,
      anodeReactsInSolution: false,
      title: `${cell.title.replace(/\s*\(có màng ngăn.*?\)/i, '')} (có màng ngăn)`,
      note: `${cell.note} Màng ngăn giữ axit ${acidName} tập trung ở ngăn Anot (+), ngăn H⁺ hòa tan hoặc khuếch tán sang ngăn Catot (-).`,
    };
  }

  return {
    ...cell,
    hasMembrane: false,
    anodeReactsInSolution: false,
  };
}


