import test from 'node:test';
import assert from 'node:assert/strict';
import { CHEMICAL_CATALOG, LAB_REACTIONS } from '../data/chemicalsAndReactions';
import {
  buildReactionMechanism,
  evaluateMechanismAtomPos,
  evaluateMechanismBonds,
  getMechanismStageLabel,
} from './molecularMechanism';

test('buildReactionMechanism provides valid bond-breaking & bond-forming specs for all 19 presets', () => {
  assert.equal(LAB_REACTIONS.length, 19);

  for (const rxn of LAB_REACTIONS) {
    const subA = CHEMICAL_CATALOG.find((c) => c.id === rxn.reactantAId);
    const subB = CHEMICAL_CATALOG.find((c) => c.id === rxn.reactantBId);
    assert.ok(subA, `Missing substance A for ${rxn.id}`);
    assert.ok(subB, `Missing substance B for ${rxn.id}`);

    const spec = buildReactionMechanism(rxn, subA, subB);
    assert.equal(spec.hasReaction, true, `${rxn.id} should have reaction=true`);
    assert.ok(spec.atoms.length >= 5, `${rxn.id} should have atoms`);

    for (const bond of [...spec.oldBonds, ...spec.newBonds]) {
      assert.ok(
        bond.from >= 0 && bond.from < spec.atoms.length,
        `${rxn.id}: invalid bond.from=${bond.from}`,
      );
      assert.ok(
        bond.to >= 0 && bond.to < spec.atoms.length,
        `${rxn.id}: invalid bond.to=${bond.to}`,
      );
      assert.notEqual(bond.from, bond.to, `${rxn.id}: self-bond detected`);
    }

    const breakingCount = spec.oldBonds.filter((b) => !b.staysIntact).length;
    assert.ok(breakingCount >= 1, `${rxn.id} must have >=1 breaking bond`);
    assert.ok(spec.newBonds.length >= 1, `${rxn.id} must have >=1 forming bond`);
  }
});

test('evaluateMechanismBonds transitions cleanly from breaking old bonds to forming new bonds', () => {
  const rxn = LAB_REACTIONS.find((r) => r.id === 'cuso4_naoh')!;
  const subA = CHEMICAL_CATALOG.find((c) => c.id === rxn.reactantAId)!;
  const subB = CHEMICAL_CATALOG.find((c) => c.id === rxn.reactantBId)!;
  const spec = buildReactionMechanism(rxn, subA, subB);

  const atStart = evaluateMechanismBonds(spec, 0.05);
  const breakingAtStart = atStart.filter((b) => b.kind === 'breaking');
  const formingAtStart = atStart.filter((b) => b.kind === 'forming');
  assert.ok(breakingAtStart.every((b) => b.visible === true && b.opacity === 1));
  assert.ok(formingAtStart.every((b) => b.visible === false));

  const atBreak = evaluateMechanismBonds(spec, 0.4);
  assert.ok(
    atBreak.some((b) => b.kind === 'breaking' && b.visible && b.colorHex === '#DC2626'),
    'Breaking bonds should glow crimson red during cleavage phase',
  );

  const atForm = evaluateMechanismBonds(spec, 0.72);
  assert.ok(
    atForm.filter((b) => b.kind === 'breaking').every((b) => b.visible === false),
    'Broken bonds should disappear before formation finishes',
  );
  assert.ok(
    atForm.filter((b) => b.kind === 'forming').every((b) => b.visible === true && b.colorHex === '#059669'),
    'New bonds should grow in glowing emerald during formation phase',
  );

  const atEnd = evaluateMechanismBonds(spec, 1.0);
  assert.ok(atEnd.filter((b) => b.kind === 'forming').every((b) => b.visible === true && b.opacity === 1));
});

test('evaluateMechanismAtomPos and getMechanismStageLabel progress through all 4 stages', () => {
  const rxn = LAB_REACTIONS.find((r) => r.id === 'ch3cooh_c2h5oh')!;
  const subA = CHEMICAL_CATALOG.find((c) => c.id === rxn.reactantAId)!;
  const subB = CHEMICAL_CATALOG.find((c) => c.id === rxn.reactantBId)!;
  const spec = buildReactionMechanism(rxn, subA, subB);

  const posStart = evaluateMechanismAtomPos(spec.atoms[0], 0, 0, 0, spec.requiresHeat);
  const posEnd = evaluateMechanismAtomPos(spec.atoms[0], 1, 0, 0, spec.requiresHeat);
  assert.ok(Math.abs(posStart[0] - spec.atoms[0].startPos[0]) < 0.1);
  assert.ok(Math.abs(posEnd[0] - spec.atoms[0].endPos[0]) < 0.1);

  assert.equal(getMechanismStageLabel(spec, 0.1).stepNumber, 1);
  assert.equal(getMechanismStageLabel(spec, 0.4).stepNumber, 2);
  assert.equal(getMechanismStageLabel(spec, 0.7).stepNumber, 3);
  assert.equal(getMechanismStageLabel(spec, 0.95).stepNumber, 4);
});

test('non-reacting pair builds elastic collision fallback', () => {
  const nacl = CHEMICAL_CATALOG.find((c) => c.id === 'nacl')!;
  const hcl = CHEMICAL_CATALOG.find((c) => c.id === 'hcl')!;
  const spec = buildReactionMechanism(null, nacl, hcl);
  assert.equal(spec.hasReaction, false);
  assert.equal(spec.newBonds.length, 0);
  assert.ok(spec.oldBonds.every((b) => b.staysIntact));
});
