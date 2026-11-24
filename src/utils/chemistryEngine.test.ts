import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMolarMass,
  parseFormulaCounts,
  verifyBalancedEquation,
  computeStoichiometry,
  calculateElectrolysis,
  calculateDissociationPH,
  convertUnit,
  computeFormulaBridge,
  solveChemicalEquation,
  analyzeCustomElectrolyte,
  analyzeCustomElectrolysis,
  applyMembraneOption,
} from './chemistryEngine';

test('parseFormulaCounts and calculateMolarMass handle parentheses and subscripts', () => {
  assert.deepEqual(parseFormulaCounts('CuSO₄'), { Cu: 1, S: 1, O: 4 });
  assert.deepEqual(parseFormulaCounts('Fe2(SO4)3'), { Fe: 2, S: 3, O: 12 });
  assert.deepEqual(parseFormulaCounts('Ca(OH)2↓'), { Ca: 1, O: 2, H: 2 });

  const cuso4Mass = calculateMolarMass('CuSO4');
  assert.ok(Math.abs(cuso4Mass - 159.61) < 0.05);

  const caoh2Mass = calculateMolarMass('Ca(OH)2');
  assert.ok(Math.abs(caoh2Mass - 74.09) < 0.05);
});

test('verifyBalancedEquation validates atom conservation and minimal coefficients', () => {
  const valid = verifyBalancedEquation(
    [{ formula: 'Fe' }, { formula: 'O2' }],
    [{ formula: 'Fe3O4' }],
    [3, 2],
    [1],
  );
  assert.equal(valid.balanced, true);
  assert.equal(valid.isMinimalRatio, true);

  const nonMinimal = verifyBalancedEquation(
    [{ formula: 'Fe' }, { formula: 'O2' }],
    [{ formula: 'Fe3O4' }],
    [6, 4],
    [2],
  );
  assert.equal(nonMinimal.balanced, true);
  assert.equal(nonMinimal.isMinimalRatio, false);

  const unbalanced = verifyBalancedEquation(
    [{ formula: 'CuSO4' }, { formula: 'NaOH' }],
    [{ formula: 'Cu(OH)2' }, { formula: 'Na2SO4' }],
    [1, 1],
    [1, 1],
  );
  assert.equal(unbalanced.balanced, false);
  assert.deepEqual(unbalanced.elementDiffs.Na, { left: 1, right: 2 });
});

test('computeStoichiometry enforces limiting reagent and conservation of mass', () => {
  const result = computeStoichiometry(
    { formula: 'CuSO4', name: 'Đồng(II) sunfat', coeff: 1, stateLabel: 'Dung dịch', colorLabel: 'Xanh lam' },
    { formula: 'NaOH', name: 'Natri hiđroxit', coeff: 2, stateLabel: 'Dung dịch', colorLabel: 'Không màu' },
    [
      { formula: 'Cu(OH)2', name: 'Đồng(II) hiđroxit', coeff: 1, stateLabel: 'Kết tủa', colorLabel: 'Xanh lam' },
      { formula: 'Na2SO4', name: 'Natri sunfat', coeff: 1, stateLabel: 'Dung dịch', colorLabel: 'Không màu' },
    ],
    15.961, // ~0.1 mol CuSO4
    4.0,    // ~0.1 mol NaOH -> limiting (needs 0.2 mol for 0.1 mol CuSO4)
    true,
  );
  assert.equal(result.limitingReactant, 'B');
  assert.ok(Math.abs(result.totalMassBeforeG - result.totalMassAfterG) < 0.05);
  assert.ok(result.reactantAMassRemainingG > 7.5);
  assert.ok(result.reactantBMassRemainingG < 0.05);
  assert.ok(Math.abs(result.productsProduced[0].moles - 0.05) < 0.002);
});

test('calculateElectrolysis computes Faraday mass and gas volume', () => {
  // 5A for 1930s => Q = 9650C => ~0.1 mol e => 0.05 mol Cu (~3.18 g) & 0.025 mol O2 (~0.62 L)
  const calc = calculateElectrolysis({
    currentAmp: 5,
    durationSec: 1930,
    cathodeProductMolarMass: 63.546,
    cathodeElectrons: 2,
    cathodeIsGas: false,
    anodeProductMolarMass: 32,
    anodeElectrons: 4,
    anodeIsGas: true,
  });
  assert.equal(calc.chargeCoulombs, 9650);
  assert.ok(Math.abs(calc.cathodeMassG - 3.177) < 0.02);
  assert.ok(Math.abs(calc.anodeGasLiters - 0.62) < 0.02);
});

test('calculateDissociationPH and unit conversions work accurately', () => {
  const acid = calculateDissociationPH({ type: 'strong_acid', molarity: 0.01 });
  assert.ok(Math.abs(acid.pH - 2) < 0.001);
  assert.equal(acid.conductivityLevel, 'Mạnh');

  const weakAcid = calculateDissociationPH({ type: 'weak_acid', molarity: 0.1, kaOrKb: 1.8e-5 });
  assert.ok(weakAcid.pH > 2.5 && weakAcid.pH < 3.2);
  assert.equal(weakAcid.conductivityLevel, 'Yếu');

  assert.ok(Math.abs(convertUnit('mass', 2.5, 'kg', 'g') - 2500) < 0.001);
  assert.ok(Math.abs(convertUnit('temperature', 25, 'C', 'K') - 298.15) < 0.001);

  const bridge = computeFormulaBridge('cm_to_mass', { cM: 1, vMl: 500, M: 40 });
  assert.ok(Math.abs(bridge.targetValue - 20) < 0.01);
  assert.equal(bridge.steps.length, 3);
});

test('solveChemicalEquation solves complex inorganic and redox equations exactly', () => {
  const simple = solveChemicalEquation('CuSO4 + NaOH -> Cu(OH)2 + Na2SO4');
  assert.equal(simple.success, true);
  assert.deepEqual(simple.coefficients, [1, 2, 1, 1]);

  const redox = solveChemicalEquation('KMnO4 + HCl -> KCl + MnCl2 + Cl2 + H2O');
  assert.equal(redox.success, true);
  assert.deepEqual(redox.coefficients, [2, 16, 2, 2, 5, 8]);

  const dichromate = solveChemicalEquation('FeSO4 + K2Cr2O7 + H2SO4 -> Fe2(SO4)3 + K2SO4 + Cr2(SO4)3 + H2O');
  assert.equal(dichromate.success, true);
  assert.deepEqual(dichromate.coefficients, [6, 1, 7, 3, 1, 1, 7]);

  const invalid = solveChemicalEquation('Fe + O2 -> CuO');
  assert.equal(invalid.success, false);
});

test('analyzeCustomElectrolyte and analyzeCustomElectrolysis classify formulas accurately', () => {
  const h2so4 = analyzeCustomElectrolyte('H2SO4');
  assert.equal(h2so4.type, 'strong_acid');
  assert.equal(h2so4.stoichFactor, 2);

  const baoh2 = analyzeCustomElectrolyte('Ba(OH)2');
  assert.equal(baoh2.type, 'strong_base');
  assert.equal(baoh2.stoichFactor, 2);

  const plating = analyzeCustomElectrolysis('CuSO4', 'electroplating');
  assert.equal(plating.modeType, 'electroplating');
  assert.equal(plating.anodeDissolves, true);

  const molten = analyzeCustomElectrolysis('CaCl2', 'molten');
  assert.equal(molten.modeType, 'molten');
  assert.deepEqual(molten.equationCoeffs, [1, 1, 1]);

  const aqKBr = analyzeCustomElectrolysis('KBr', 'aqueous');
  assert.equal(aqKBr.cathodeIsGas, true);
  assert.equal(aqKBr.anodeIsGas, true);
  assert.deepEqual(aqKBr.equationCoeffs, [2, 2, 2, 1, 1]);
});

test('applyMembraneOption and calculateElectrolysis track membrane Javel reaction and mass increase/decrease', () => {
  const naclBase = analyzeCustomElectrolysis('NaCl', 'aqueous');
  const naclMem = applyMembraneOption(naclBase, true);
  assert.equal(naclMem.hasMembrane, true);
  assert.equal(naclMem.anodeReactsInSolution, false);
  assert.ok(naclMem.overallEquation.includes('NaOH'));

  const naclNoMem = applyMembraneOption(naclBase, false);
  assert.equal(naclNoMem.hasMembrane, false);
  assert.equal(naclNoMem.anodeReactsInSolution, true);
  assert.ok(naclNoMem.overallEquation.includes('NaClO'));

  // With membrane, both H2 and Cl2 escape -> solution loses both masses
  const calcMem = calculateElectrolysis({
    currentAmp: 5,
    durationSec: 1930,
    cathodeProductMolarMass: naclMem.cathodeMolarMass,
    cathodeElectrons: naclMem.cathodeElectrons,
    cathodeIsGas: naclMem.cathodeIsGas,
    anodeProductMolarMass: naclMem.anodeMolarMass,
    anodeElectrons: naclMem.anodeElectrons,
    anodeIsGas: naclMem.anodeIsGas,
    anodeReactsInSolution: naclMem.anodeReactsInSolution,
  });
  assert.ok(calcMem.solutionDeltaG < -3.5);
  assert.ok(calcMem.anodeGasLiters > 1.0);

  // Without membrane, Cl2 stays in solution as NaClO -> only H2 escapes -> smaller solution mass loss
  const calcNoMem = calculateElectrolysis({
    currentAmp: 5,
    durationSec: 1930,
    cathodeProductMolarMass: naclNoMem.cathodeMolarMass,
    cathodeElectrons: naclNoMem.cathodeElectrons,
    cathodeIsGas: naclNoMem.cathodeIsGas,
    anodeProductMolarMass: naclNoMem.anodeMolarMass,
    anodeElectrons: naclNoMem.anodeElectrons,
    anodeIsGas: naclNoMem.anodeIsGas,
    anodeReactsInSolution: naclNoMem.anodeReactsInSolution,
  });
  assert.equal(calcNoMem.anodeGasLiters, 0);
  assert.ok(calcNoMem.solutionDeltaG > -0.2 && calcNoMem.solutionDeltaG < 0);

  // Electroplating soluble anode: cathode increases (+m), anode decreases (-m), solution unchanged (0)
  const calcPlating = calculateElectrolysis({
    currentAmp: 5,
    durationSec: 1930,
    cathodeProductMolarMass: 63.546,
    cathodeElectrons: 2,
    cathodeIsGas: false,
    anodeProductMolarMass: 63.546,
    anodeElectrons: 2,
    anodeIsGas: false,
    anodeDissolves: true,
  });
  assert.ok(calcPlating.cathodeElectrodeDeltaG > 3.1);
  assert.ok(calcPlating.anodeElectrodeDeltaG < -3.1);
  assert.ok(Math.abs(calcPlating.solutionDeltaG) < 0.001);
});
