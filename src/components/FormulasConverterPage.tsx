import React, { useMemo, useState } from 'react';
import { ArrowRight, Calculator, Repeat } from 'lucide-react';
import { CHEMISTRY_FORMULAS } from '../data/formulasAndConversions';
import {
  computeFormulaBridge,
  convertUnit,
  type FormulaBridgeMode,
  type UnitCategory,
} from '../utils/chemistryEngine';

const UNIT_OPTIONS: Record<UnitCategory, { label: string; units: { id: string; label: string }[] }> = {
  mass: {
    label: 'Khối lượng',
    units: [
      { id: 'mg', label: 'Miligam (mg)' },
      { id: 'g', label: 'Gam (g)' },
      { id: 'kg', label: 'Kilogam (kg)' },
      { id: 'tan', label: 'Tấn' },
    ],
  },
  volume: {
    label: 'Thể tích',
    units: [
      { id: 'mL', label: 'Mililít (mL / cm³)' },
      { id: 'L', label: 'Lít (L / dm³)' },
      { id: 'm3', label: 'Mét khối (m³)' },
    ],
  },
  pressure: {
    label: 'Áp suất',
    units: [
      { id: 'bar', label: 'Bar (chuẩn 2018)' },
      { id: 'atm', label: 'Atmosphere (atm)' },
      { id: 'kPa', label: 'Kilopascal (kPa)' },
      { id: 'mmHg', label: 'mmHg (Torr)' },
    ],
  },
  temperature: {
    label: 'Nhiệt độ',
    units: [
      { id: 'C', label: 'Độ Celsius (°C)' },
      { id: 'K', label: 'Kelvin (K)' },
    ],
  },
  concentration: {
    label: 'Nồng độ mol',
    units: [
      { id: 'mol/L', label: 'mol/L (M)' },
      { id: 'mmol/L', label: 'mmol/L (mM)' },
    ],
  },
};

export const FormulasConverterPage: React.FC = () => {
  const [topicFilter, setTopicFilter] = useState<string>('Tất cả');

  const [unitCat, setUnitCat] = useState<UnitCategory>('mass');
  const [unitVal, setUnitVal] = useState<number>(250);
  const [fromUnit, setFromUnit] = useState<string>('g');
  const [toUnit, setToUnit] = useState<string>('kg');

  const [bridgeMode, setBridgeMode] = useState<FormulaBridgeMode>('mass_to_gas_dkc');
  const [bridgeInputs, setBridgeInputs] = useState<Record<string, number>>({
    m: 6.5,
    M: 65.38,
    ratio: 1,
    cPercent: 9.8,
    D: 1.06,
    cM: 0.5,
    vMl: 200,
    I: 5,
    t: 1930,
    A: 63.55,
    n: 2,
    V: 2.479,
  });

  const topics = useMemo(
    () => ['Tất cả', ...Array.from(new Set(CHEMISTRY_FORMULAS.map((f) => f.topic)))],
    [],
  );

  const filteredFormulas = useMemo(
    () =>
      topicFilter === 'Tất cả'
        ? CHEMISTRY_FORMULAS
        : CHEMISTRY_FORMULAS.filter((f) => f.topic === topicFilter),
    [topicFilter],
  );

  const convertedUnitResult = useMemo(
    () => convertUnit(unitCat, unitVal, fromUnit, toUnit),
    [unitCat, unitVal, fromUnit, toUnit],
  );

  const bridgeResult = useMemo(
    () => computeFormulaBridge(bridgeMode, bridgeInputs),
    [bridgeMode, bridgeInputs],
  );

  const handleCategoryChange = (cat: UnitCategory) => {
    setUnitCat(cat);
    const list = UNIT_OPTIONS[cat].units;
    setFromUnit(list[0].id);
    setToUnit(list[1]?.id ?? list[0].id);
  };

  const updateBridgeInput = (key: string, val: number) => {
    setBridgeInputs((prev) => ({ ...prev, [key]: val }));
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold text-sky-400">
          Công cụ tính toán &amp; Liên hệ công thức Hóa học
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-50">
          Tổng hợp Công thức, Quy đổi Đơn vị &amp; Cầu nối Công thức
        </h1>
        <p className="mt-1 text-sm text-slate-400 max-w-3xl">
          Tra cứu toàn bộ công thức tính hóa học phổ thông (theo chuẩn đkc 24,79 L/mol mới), quy đổi đơn vị đo lường và xem chi tiết từng bước chuyển đổi giữa các công thức liên hệ với nhau.
        </p>
      </div>

      {/* Top Interactive Split: Formula Bridge (Left 7) + Unit Converter (Right 5) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Step-by-Step Formula Bridge */}
        <section className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#0F172A] p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <Calculator className="h-5 w-5 text-sky-400" />
            <h2 className="text-lg font-bold text-slate-50">
              Quy đổi liên hệ giữa các công thức (Từng bước giải)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(
              [
                ['mass_to_gas_dkc', 'Khối lượng (m) → Mol (n) → Thể tích khí đkc (V)'],
                ['cpercent_to_cm', 'Nồng độ % (C%) + Khối lượng riêng (D) → C_M'],
                ['cm_to_mass', 'Nồng độ mol (C_M) + Thể tích (V) → Khối lượng (m)'],
                ['faraday_to_mass', 'Cường độ (I) + Thời gian (t) → Mol e → m kim loại'],
                ['gas_to_molecules', 'Thể tích khí đkc (V) → Mol (n) → Số phân tử (N)'],
              ] as [FormulaBridgeMode, string][]
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setBridgeMode(mode)}
                className={`rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                  bridgeMode === mode
                    ? 'border-sky-400 bg-sky-500/15 text-sky-200'
                    : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Dynamic Inputs for Selected Bridge */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            {bridgeMode === 'mass_to_gas_dkc' && (
              <>
                <label className="block text-xs font-medium text-slate-300">
                  Khối lượng chất m (g)
                  <input
                    type="number"
                    step={0.1}
                    value={bridgeInputs.m}
                    onChange={(e) => updateBridgeInput('m', Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-sm text-sky-200"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-300">
                  Khối lượng mol M (g/mol)
                  <input
                    type="number"
                    step={0.01}
                    value={bridgeInputs.M}
                    onChange={(e) => updateBridgeInput('M', Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-sm text-sky-200"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-300">
                  Hệ số tỉ lệ mol khí (k)
                  <input
                    type="number"
                    step={0.5}
                    value={bridgeInputs.ratio}
                    onChange={(e) => updateBridgeInput('ratio', Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-sm text-sky-200"
                  />
                </label>
              </>
            )}

            {bridgeMode === 'cpercent_to_cm' && (
              <>
                <label className="block text-xs font-medium text-slate-300">
                  Nồng độ phần trăm C%
                  <input
                    type="number"
                    step={0.1}
                    value={bridgeInputs.cPercent}
                    onChange={(e) => updateBridgeInput('cPercent', Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-sm text-sky-200"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-300">
                  Khối lượng riêng D (g/mL)
                  <input
                    type="number"
                    step={0.01}
                    value={bridgeInputs.D}
                    onChange={(e) => updateBridgeInput('D', Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-sm text-sky-200"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-300">
                  Khối lượng mol M (g/mol)
                  <input
                    type="number"
                    step={0.01}
                    value={bridgeInputs.M}
                    onChange={(e) => updateBridgeInput('M', Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-sm text-sky-200"
                  />
                </label>
              </>
            )}

            {bridgeMode === 'cm_to_mass' && (
              <>
                <label className="block text-xs font-medium text-slate-300">
                  Nồng độ mol C_M (mol/L)
                  <input
                    type="number"
                    step={0.05}
                    value={bridgeInputs.cM}
                    onChange={(e) => updateBridgeInput('cM', Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-sm text-sky-200"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-300">
                  Thể tích V (mL)
                  <input
                    type="number"
                    step={10}
                    value={bridgeInputs.vMl}
                    onChange={(e) => updateBridgeInput('vMl', Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-sm text-sky-200"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-300">
                  Khối lượng mol M (g/mol)
                  <input
                    type="number"
                    step={0.1}
                    value={bridgeInputs.M}
                    onChange={(e) => updateBridgeInput('M', Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-sm text-sky-200"
                  />
                </label>
              </>
            )}

            {bridgeMode === 'faraday_to_mass' && (
              <>
                <label className="block text-xs font-medium text-slate-300">
                  Cường độ dòng điện I (A)
                  <input
                    type="number"
                    step={0.5}
                    value={bridgeInputs.I}
                    onChange={(e) => updateBridgeInput('I', Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-sm text-sky-200"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-300">
                  Thời gian t (giây)
                  <input
                    type="number"
                    step={10}
                    value={bridgeInputs.t}
                    onChange={(e) => updateBridgeInput('t', Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-sm text-sky-200"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs font-medium text-slate-300">
                    NTK A
                    <input
                      type="number"
                      step={0.1}
                      value={bridgeInputs.A}
                      onChange={(e) => updateBridgeInput('A', Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-sm text-sky-200"
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-300">
                    Hóa trị n
                    <input
                      type="number"
                      min={1}
                      max={4}
                      value={bridgeInputs.n}
                      onChange={(e) => updateBridgeInput('n', Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-sm text-sky-200"
                    />
                  </label>
                </div>
              </>
            )}

            {bridgeMode === 'gas_to_molecules' && (
              <label className="block text-xs font-medium text-slate-300 sm:col-span-3">
                Thể tích khí ở đkc (25°C, 1 bar) — V (L)
                <input
                  type="number"
                  step={0.1}
                  value={bridgeInputs.V}
                  onChange={(e) => updateBridgeInput('V', Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-sm text-sky-200"
                />
              </label>
            )}
          </div>

          {/* Step-by-Step Output */}
          <div className="space-y-3">
            {bridgeResult.steps.map((step) => (
              <div
                key={step.stepNumber}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3"
              >
                <div>
                  <div className="text-xs font-semibold text-sky-400">
                    Bước {step.stepNumber}: {step.title}
                  </div>
                  <div className="mt-1 font-mono text-xs text-slate-300">
                    {step.formulaText} &nbsp;⇒&nbsp; {step.substitutionText}
                  </div>
                </div>
                <div className="font-mono text-sm font-bold text-emerald-300 tabular-nums whitespace-nowrap">
                  = {step.resultText}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-sky-500/35 bg-sky-950/35 px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-sky-200">{bridgeResult.targetLabel}</span>
            <span
              className="font-mono text-lg font-bold text-amber-300 tabular-nums"
              data-testid="bridge-final-result"
            >
              {bridgeResult.targetValue > 1e6
                ? bridgeResult.targetValue.toExponential(3)
                : bridgeResult.targetValue.toFixed(3)}{' '}
              {bridgeResult.targetUnit}
            </span>
          </div>
        </section>

        {/* Unit Converter */}
        <section className="lg:col-span-5 rounded-2xl border border-slate-800 bg-[#0F172A] p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <Repeat className="h-5 w-5 text-sky-400" />
            <h2 className="text-lg font-bold text-slate-50">Quy đổi đơn vị Hóa học chuẩn</h2>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(UNIT_OPTIONS) as UnitCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryChange(cat)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  unitCat === cat
                    ? 'bg-sky-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {UNIT_OPTIONS[cat].label}
              </button>
            ))}
          </div>

          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <label className="block text-xs font-semibold text-slate-300">
              Giá trị cần đổi
              <input
                type="number"
                value={unitVal}
                onChange={(e) => setUnitVal(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-base font-semibold text-sky-200 tabular-nums"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-end gap-2">
              <label className="block text-xs font-semibold text-slate-300">
                Từ đơn vị
                <select
                  value={fromUnit}
                  onChange={(e) => setFromUnit(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-2 text-sm text-slate-100"
                >
                  {UNIT_OPTIONS[unitCat].units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>

              <ArrowRight className="hidden sm:block h-4 w-4 text-slate-400 mb-2.5" />

              <label className="block text-xs font-semibold text-slate-300">
                Sang đơn vị
                <select
                  value={toUnit}
                  onChange={(e) => setToUnit(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-2 text-sm text-slate-100"
                >
                  {UNIT_OPTIONS[unitCat].units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-sky-500/35 bg-sky-950/35 p-4">
            <p className="text-xs font-semibold text-sky-300">Kết quả quy đổi chính xác</p>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-50 tabular-nums">
              {Number.isInteger(convertedUnitResult)
                ? convertedUnitResult
                : Number(convertedUnitResult.toPrecision(6))}{' '}
              <span className="text-sm font-semibold text-sky-300">{toUnit}</span>
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-xs text-slate-300 space-y-1.5">
            <p className="font-semibold text-slate-100">Ghi nhớ quy đổi nhanh:</p>
            <p>· 1 dm³ = 1 lít = 1000 mL = 1000 cm³; 1 m³ = 1000 L</p>
            <p>· Nhiệt độ tuyệt đối: T (K) = t (°C) + 273,15</p>
            <p>· Điều kiện chuẩn (đkc GDPT 2018): 25°C (298,15 K), 1 bar → V = 24,79·n</p>
            <p>· 1 atm = 1,01325 bar = 760 mmHg = 101,325 kPa</p>
          </div>
        </section>
      </div>

      {/* Complete Chemistry Formulas Encyclopedia */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold text-slate-50">Kho Công thức Hóa học Phổ thông</h2>
          <div className="flex flex-wrap gap-1.5">
            {topics.map((tp) => (
              <button
                key={tp}
                type="button"
                onClick={() => setTopicFilter(tp)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  topicFilter === tp
                    ? 'bg-sky-500 text-slate-950'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {tp}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFormulas.map((formula) => (
            <div
              key={formula.id}
              className="rounded-2xl border border-slate-800 bg-[#0F172A] p-5 flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="text-xs text-sky-400 font-medium">
                  {formula.topic} · {formula.grade}
                </div>
                <h3 className="mt-1 text-base font-bold text-slate-50">{formula.title}</h3>
                <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 font-mono text-sm font-bold text-amber-300">
                  {formula.equation}
                </div>
                <p className="mt-3 text-xs text-slate-300 leading-relaxed">{formula.variables}</p>
              </div>
              <p className="pt-2 border-t border-slate-800 text-xs text-slate-400">
                {formula.note}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
