import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Flame,
  Lightbulb,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  analyzeCustomElectrolysis,
  analyzeCustomElectrolyte,
  applyMembraneOption,
  calculateDissociationPH,
  calculateElectrolysis,
  FARADAY_CONSTANT,
  GAS_VOLUME_DKC,
  KNOWN_ELECTROLYTES,
  PRESET_ELECTROLYSIS_CELLS,
  verifyBalancedEquation,
  type AnalyzedElectrolysisCell,
  type AnalyzedElectrolyte,
  type ElectrolysisModeType,
} from '../utils/chemistryEngine';
import { ChemicalKeyboard } from './ChemicalKeyboard';
import { ElectrolysisDissociationCanvas } from './ElectrolysisDissociationCanvas';

function gcdInt(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

const ELECTROLYSIS_SAMPLE_FORMULAS = ['CuSO4', 'AgNO3', 'NiSO4', 'CuCl2', 'KBr', 'NaCl', 'MgCl2', 'Al2O3'];
const ELECTROLYTE_SAMPLE_FORMULAS = ['H2SO4', 'HCl', 'CH3COOH', 'Ba(OH)2', 'NH3', 'FeCl3', 'Na2CO3', 'C2H5OH'];

export const ElectrolysisDissociationPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dissociation' | 'electrolysis'>('electrolysis');

  // Dissociation state
  const [selectedElectrolyteKey, setSelectedElectrolyteKey] = useState<string>('H2SO4');
  const [customElectrolyteData, setCustomElectrolyteData] = useState<AnalyzedElectrolyte | null>(null);
  const [electrolyteFormulaInput, setElectrolyteFormulaInput] = useState<string>('H2SO4');
  const [showDissocKeyboard, setShowDissocKeyboard] = useState<boolean>(false);
  const [molarity, setMolarity] = useState<number>(0.1);
  const dissocInputRef = useRef<HTMLInputElement | null>(null);

  // Dissociation equation balancing state
  const [dissocCoeffs, setDissocCoeffs] = useState<number[]>([1, 1, 1]);
  const [dissocFeedback, setDissocFeedback] = useState<{ status: 'idle' | 'ok' | 'err'; msg: string }>({
    status: 'idle',
    msg: '',
  });

  // Electrolysis state
  const [modeFilter, setModeFilter] = useState<'ALL' | ElectrolysisModeType>('ALL');
  const [selectedCellId, setSelectedCellId] = useState<string>('cuso4_aq');
  const [hasMembrane, setHasMembrane] = useState<boolean>(false);
  const [customCellData, setCustomCellData] = useState<AnalyzedElectrolysisCell | null>(null);
  const [electrolysisFormulaInput, setElectrolysisFormulaInput] = useState<string>('CuCl2');
  const [customElectrolysisMode, setCustomElectrolysisMode] = useState<ElectrolysisModeType>('aqueous');
  const [showElecKeyboard, setShowElecKeyboard] = useState<boolean>(false);
  const elecInputRef = useRef<HTMLInputElement | null>(null);

  const [currentAmp, setCurrentAmp] = useState<number>(5);
  const [durationSec, setDurationSec] = useState<number>(1930);

  // Electrolysis equation balancing state
  const [elecCoeffs, setElecCoeffs] = useState<number[]>([1, 1, 1, 1, 1]);
  const [elecFeedback, setElecFeedback] = useState<{ status: 'idle' | 'ok' | 'err'; msg: string }>({
    status: 'idle',
    msg: '',
  });

  const electrolyteList = useMemo(
    () =>
      Object.entries(KNOWN_ELECTROLYTES).map(([key, val]) => ({
        formula: key,
        ...val,
      })),
    [],
  );

  const activeElectrolyte: AnalyzedElectrolyte = useMemo(() => {
    if (customElectrolyteData) return customElectrolyteData;
    const found = electrolyteList.find((e) => e.formula === selectedElectrolyteKey);
    return found ?? electrolyteList[0];
  }, [customElectrolyteData, selectedElectrolyteKey, electrolyteList]);

  const filteredCells = useMemo(
    () =>
      modeFilter === 'ALL'
        ? PRESET_ELECTROLYSIS_CELLS
        : PRESET_ELECTROLYSIS_CELLS.filter((c) => c.modeType === modeFilter),
    [modeFilter],
  );

  const rawActiveCell: AnalyzedElectrolysisCell = useMemo(() => {
    if (customCellData) return customCellData;
    return (
      PRESET_ELECTROLYSIS_CELLS.find((c) => c.id === selectedCellId) ??
      PRESET_ELECTROLYSIS_CELLS[0]
    );
  }, [customCellData, selectedCellId]);

  const activeCell: AnalyzedElectrolysisCell = useMemo(
    () => applyMembraneOption(rawActiveCell, hasMembrane),
    [rawActiveCell, hasMembrane],
  );

  // Reset interactive equation coefficient boxes when active species changes
  useEffect(() => {
    const count = activeCell.equationReactants.length + activeCell.equationProducts.length;
    setElecCoeffs(Array(count).fill(1));
    setElecFeedback({ status: 'idle', msg: '' });
  }, [activeCell.id, activeCell.hasMembrane, activeCell.equationReactants.length, activeCell.equationProducts.length]);

  useEffect(() => {
    const count = activeElectrolyte.reactants.length + activeElectrolyte.products.length;
    setDissocCoeffs(Array(count).fill(1));
    setDissocFeedback({ status: 'idle', msg: '' });
  }, [activeElectrolyte.formula, activeElectrolyte.reactants.length, activeElectrolyte.products.length]);

  const phResult = useMemo(
    () =>
      calculateDissociationPH({
        type: activeElectrolyte.type,
        molarity,
        kaOrKb: activeElectrolyte.kaOrKb,
        stoichFactor: activeElectrolyte.stoichFactor,
      }),
    [activeElectrolyte, molarity],
  );

  const electrolysisResult = useMemo(
    () =>
      calculateElectrolysis({
        currentAmp,
        durationSec,
        cathodeProductMolarMass: activeCell.cathodeMolarMass,
        cathodeElectrons: activeCell.cathodeElectrons,
        cathodeIsGas: activeCell.cathodeIsGas,
        anodeProductMolarMass: activeCell.anodeMolarMass,
        anodeElectrons: activeCell.anodeElectrons,
        anodeIsGas: activeCell.anodeIsGas,
        anodeDissolves: activeCell.anodeDissolves,
        anodeReactsInSolution: activeCell.anodeReactsInSolution,
      }),
    [activeCell, currentAmp, durationSec],
  );

  // Handlers for Custom Chemical Keyboard & Analyzer
  const insertTokenToInput = (
    token: string,
    currentVal: string,
    setter: (v: string) => void,
    inputRef: React.RefObject<HTMLInputElement | null>,
  ) => {
    const cleanToken = token.trim();
    const el = inputRef.current;
    if (!el) {
      setter(currentVal + cleanToken);
      return;
    }
    const start = el.selectionStart ?? currentVal.length;
    const end = el.selectionEnd ?? currentVal.length;
    const nextVal = currentVal.slice(0, start) + cleanToken + currentVal.slice(end);
    setter(nextVal);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + cleanToken.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleAnalyzeCustomElectrolysis = (formulaOverride?: string, modeOverride?: ElectrolysisModeType) => {
    const raw = (formulaOverride ?? electrolysisFormulaInput).trim();
    if (!raw) return;
    const mode = modeOverride ?? customElectrolysisMode;
    const analyzed = analyzeCustomElectrolysis(raw, mode);
    setCustomCellData(analyzed);
  };

  const handleAnalyzeCustomElectrolyte = (formulaOverride?: string) => {
    const raw = (formulaOverride ?? electrolyteFormulaInput).trim();
    if (!raw) return;
    const analyzed = analyzeCustomElectrolyte(raw);
    setCustomElectrolyteData(analyzed);
  };

  const handleCheckElecBalance = () => {
    const rLen = activeCell.equationReactants.length;
    if (elecCoeffs.some((c) => !Number.isInteger(c) || c <= 0)) {
      setElecFeedback({ status: 'err', msg: 'Tất cả hệ số phải là số nguyên dương (≥ 1).' });
      return;
    }

    if (activeCell.modeType === 'electroplating') {
      const exact = activeCell.equationCoeffs.every((c, idx) => c === elecCoeffs[idx]);
      setElecFeedback(
        exact
          ? { status: 'ok', msg: 'Chính xác! Tỉ lệ điện cực tan (Anot tan = Catot bám) đã cân bằng chuẩn.' }
          : { status: 'err', msg: 'Trong mạ điện anot tan, 1 mol kim loại tan ở Anot tạo đúng 1 mol bám ở Catot (hệ số 1 : 1 : 1 : 1).' },
      );
      return;
    }

    const res = verifyBalancedEquation(
      activeCell.equationReactants,
      activeCell.equationProducts,
      elecCoeffs.slice(0, rLen),
      elecCoeffs.slice(rLen),
    );
    if (res.balanced && res.isMinimalRatio) {
      setElecFeedback({
        status: 'ok',
        msg: 'Chính xác! Phương trình điện phân đã cân bằng tối giản và bảo toàn electron.',
      });
    } else {
      setElecFeedback({
        status: 'err',
        msg: res.errorMessage ?? 'Số nguyên tử ở hai vế chưa bằng nhau, hãy kiểm tra lại.',
      });
    }
  };

  const handleCheckDissocBalance = () => {
    if (dissocCoeffs.some((c) => !Number.isInteger(c) || c <= 0)) {
      setDissocFeedback({ status: 'err', msg: 'Tất cả hệ số điện li phải là số nguyên dương (≥ 1).' });
      return;
    }
    const target = activeElectrolyte.solutionCoeffs;
    const g = dissocCoeffs.reduce((acc, v) => gcdInt(acc, v), dissocCoeffs[0]);
    const isSameRatio = target.every(
      (t, i) => t * dissocCoeffs[0] === dissocCoeffs[i] * target[0],
    );
    if (isSameRatio && g === 1) {
      setDissocFeedback({
        status: 'ok',
        msg: `Chính xác! Phương trình điện li ${activeElectrolyte.dissociationEquation} bảo toàn cả nguyên tử và điện tích.`,
      });
    } else if (isSameRatio && g > 1) {
      setDissocFeedback({
        status: 'err',
        msg: 'Tỉ lệ đúng nhưng hệ số chưa tối giản (hãy chia cho ước chung lớn nhất).',
      });
    } else {
      setDissocFeedback({
        status: 'err',
        msg: 'Chưa cân bằng số nguyên tử hoặc tổng điện tích giữa phân tử và các ion.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Main Sub-tab Switcher */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold text-sky-400">
            Chuyên đề Điện li (Lớp 11) &amp; Điện phân – Mạ điện (Lớp 12)
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-50 text-balance">
            Mô phỏng Điện Phân, Mạ Điện, Nóng Chảy &amp; Sự Điện Li
          </h1>
        </div>

        <div className="inline-flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/90 p-1 self-start">
          <button
            type="button"
            onClick={() => setActiveTab('electrolysis')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'electrolysis'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            Điện phân (Lớp 12)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dissociation')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'dissociation'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <Lightbulb className="h-3.5 w-3.5" />
            Sự điện li &amp; pH (Lớp 11)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Interactive Canvas + Equations + Balancing */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          <ElectrolysisDissociationCanvas
            activeTab={activeTab}
            activeCell={activeCell}
            currentAmp={currentAmp}
            durationSec={durationSec}
            electrolysisResult={electrolysisResult}
            activeElectrolyte={activeElectrolyte}
            phResult={phResult}
            molarity={molarity}
            hasMembrane={hasMembrane}
            onToggleMembrane={() => setHasMembrane((v) => !v)}
          />

          {activeTab === 'electrolysis' ? (
            <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-50">
                  Phương trình điện cực &amp; Thứ tự điện phân
                </h2>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                  {activeCell.modeType === 'molten' && <Flame className="h-3.5 w-3.5" />}
                  {activeCell.modeLabel}
                  {activeCell.modeType === 'aqueous' && (
                    <span className="ml-1 rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-300">
                      {hasMembrane ? 'Có màng ngăn' : 'Không màng ngăn'}
                    </span>
                  )}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-sky-500/30 bg-sky-950/25 p-3.5">
                  <p className="text-xs font-semibold text-sky-300">Tại Catot (-) — Quá trình khử</p>
                  <p className="mt-1 font-mono text-xs font-medium text-slate-100">
                    {activeCell.cathodeReaction}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/25 p-3.5">
                  <p className="text-xs font-semibold text-amber-300">Tại Anot (+) — Quá trình oxi hóa</p>
                  <p className="mt-1 font-mono text-xs font-medium text-slate-100">
                    {activeCell.anodeReaction}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-sm font-bold text-emerald-300">
                {activeCell.overallEquation}
              </div>
              {activeCell.secondaryReaction && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-2.5 text-xs text-amber-200">
                  <span className="font-semibold">Phản ứng phụ khi không có màng ngăn: </span>
                  <span className="font-mono">{activeCell.secondaryReaction}</span>
                </div>
              )}
              <p className="text-xs text-slate-300 leading-relaxed">{activeCell.note}</p>

              {/* Interactive Equation Balancing Practice inside Electrolysis */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-300">
                    <CheckCircle2 className="h-4 w-4" />
                    Luyện tập cân bằng phương trình điện phân
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setElecCoeffs([...activeCell.equationCoeffs]);
                      setElecFeedback({ status: 'ok', msg: 'Đã điền hệ số chuẩn cho phản ứng điện phân.' });
                    }}
                    className="text-xs font-semibold text-slate-400 hover:text-sky-300"
                  >
                    Xem đáp án
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {activeCell.equationReactants.map((r, i) => (
                    <React.Fragment key={`er_${i}`}>
                      {i > 0 && <span className="font-mono text-slate-500 font-bold">+</span>}
                      <input
                        type="number"
                        min={1}
                        max={20}
                        aria-label={`Hệ số điện phân ${r.display}`}
                        value={elecCoeffs[i] ?? 1}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          setElecCoeffs((prev) =>
                            prev.map((x, idx) => (idx === i ? (Number.isNaN(v) ? 0 : v) : x)),
                          );
                        }}
                        className="w-12 rounded-lg border border-slate-700 bg-slate-900 py-1 text-center font-mono text-sm font-bold text-sky-300 tabular-nums"
                      />
                      <span className="font-mono text-sm font-semibold text-slate-100">
                        {r.display}
                      </span>
                    </React.Fragment>
                  ))}

                  <span className="font-mono text-base font-bold text-sky-400 mx-1">→</span>

                  {activeCell.equationProducts.map((p, i) => {
                    const idx = activeCell.equationReactants.length + i;
                    return (
                      <React.Fragment key={`ep_${i}`}>
                        {i > 0 && <span className="font-mono text-slate-500 font-bold">+</span>}
                        <input
                          type="number"
                          min={1}
                          max={20}
                          aria-label={`Hệ số điện phân ${p.display}`}
                          value={elecCoeffs[idx] ?? 1}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            setElecCoeffs((prev) =>
                              prev.map((x, j) => (j === idx ? (Number.isNaN(v) ? 0 : v) : x)),
                            );
                          }}
                          className="w-12 rounded-lg border border-slate-700 bg-slate-900 py-1 text-center font-mono text-sm font-bold text-emerald-300 tabular-nums"
                        />
                        <span className="font-mono text-sm font-semibold text-slate-100">
                          {p.display}
                        </span>
                      </React.Fragment>
                    );
                  })}

                  <button
                    type="button"
                    onClick={handleCheckElecBalance}
                    className="ml-auto rounded-lg bg-sky-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400"
                    data-testid="check-elec-balance-btn"
                  >
                    Kiểm tra cân bằng
                  </button>
                </div>

                {elecFeedback.status !== 'idle' && (
                  <p
                    className={`text-xs font-medium ${
                      elecFeedback.status === 'ok' ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {elecFeedback.msg}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-5 space-y-4">
              <h2 className="text-base font-bold text-slate-50">
                Phương trình điện li &amp; Thuyết Brønsted–Lowry
              </h2>
              <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-sm font-bold text-sky-300">
                {activeElectrolyte.dissociationEquation}
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{activeElectrolyte.description}</p>

              {/* Interactive Equation Balancing Practice inside Dissociation */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-300">
                    <CheckCircle2 className="h-4 w-4" />
                    Luyện tập cân bằng phương trình điện li (bảo toàn nguyên tử &amp; điện tích)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDissocCoeffs([...activeElectrolyte.solutionCoeffs]);
                      setDissocFeedback({ status: 'ok', msg: 'Đã điền hệ số điện li chuẩn.' });
                    }}
                    className="text-xs font-semibold text-slate-400 hover:text-sky-300"
                  >
                    Xem đáp án
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {activeElectrolyte.reactants.map((r, i) => (
                    <React.Fragment key={`dr_${i}`}>
                      {i > 0 && <span className="font-mono text-slate-500 font-bold">+</span>}
                      <input
                        type="number"
                        min={1}
                        max={20}
                        aria-label={`Hệ số điện li ${r.display}`}
                        value={dissocCoeffs[i] ?? 1}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          setDissocCoeffs((prev) =>
                            prev.map((x, idx) => (idx === i ? (Number.isNaN(v) ? 0 : v) : x)),
                          );
                        }}
                        className="w-12 rounded-lg border border-slate-700 bg-slate-900 py-1 text-center font-mono text-sm font-bold text-sky-300 tabular-nums"
                      />
                      <span className="font-mono text-sm font-semibold text-slate-100">
                        {r.display}
                      </span>
                    </React.Fragment>
                  ))}

                  <span className="font-mono text-base font-bold text-sky-400 mx-1">→</span>

                  {activeElectrolyte.products.map((p, i) => {
                    const idx = activeElectrolyte.reactants.length + i;
                    return (
                      <React.Fragment key={`dp_${i}`}>
                        {i > 0 && <span className="font-mono text-slate-500 font-bold">+</span>}
                        <input
                          type="number"
                          min={1}
                          max={20}
                          aria-label={`Hệ số ion ${p.display}`}
                          value={dissocCoeffs[idx] ?? 1}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            setDissocCoeffs((prev) =>
                              prev.map((x, j) => (j === idx ? (Number.isNaN(v) ? 0 : v) : x)),
                            );
                          }}
                          className="w-12 rounded-lg border border-slate-700 bg-slate-900 py-1 text-center font-mono text-sm font-bold text-emerald-300 tabular-nums"
                        />
                        <span className="font-mono text-sm font-semibold text-slate-100">
                          {p.display}
                        </span>
                      </React.Fragment>
                    );
                  })}

                  <button
                    type="button"
                    onClick={handleCheckDissocBalance}
                    className="ml-auto rounded-lg bg-sky-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400"
                    data-testid="check-dissoc-balance-btn"
                  >
                    Kiểm tra cân bằng
                  </button>
                </div>

                {dissocFeedback.status !== 'idle' && (
                  <p
                    className={`text-xs font-medium ${
                      dissocFeedback.status === 'ok' ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {dissocFeedback.msg}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Controls, Custom Substance Input & Faraday/pH Readouts */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          {activeTab === 'electrolysis' ? (
            <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-5 space-y-4">
              <h2 className="text-base font-bold text-slate-50">
                Chọn chế độ, Nhập chất &amp; Thông số Faraday
              </h2>

              {/* Mode Filter */}
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ['ALL', 'Tất cả'],
                    ['aqueous', 'ĐP Dung dịch'],
                    ['electroplating', 'Mạ điện (Anot tan)'],
                    ['molten', 'ĐP Nóng chảy'],
                  ] as const
                ).map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setModeFilter(m);
                      if (m !== 'ALL') {
                        setCustomElectrolysisMode(m);
                        const first = PRESET_ELECTROLYSIS_CELLS.find((c) => c.modeType === m);
                        if (first) {
                          setSelectedCellId(first.id);
                          setCustomCellData(null);
                          if (first.id === 'nacl_aq') setHasMembrane(true);
                        }
                      }
                    }}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      modeFilter === m
                        ? 'bg-sky-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Preset Dropdown */}
              <div>
                <label
                  htmlFor="electrolysis-cell-select"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  Chọn nhanh hệ điện phân chuẩn ({filteredCells.length} hệ)
                </label>
                <select
                  id="electrolysis-cell-select"
                  value={customCellData ? '__custom__' : selectedCellId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedCellId(id);
                    setCustomCellData(null);
                    if (id === 'nacl_aq') setHasMembrane(true);
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 focus:border-sky-400 focus:outline-none"
                >
                  {customCellData && (
                    <option value="__custom__">Tùy chỉnh: {customCellData.title}</option>
                  )}
                  {filteredCells.map((cell) => (
                    <option key={cell.id} value={cell.id}>
                      {cell.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Porous Membrane Toggle for Aqueous Electrolysis */}
              {activeCell.modeType === 'aqueous' && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-300">
                      <Shield className="h-3.5 w-3.5" />
                      Màng ngăn xốp giữa 2 điện cực
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setHasMembrane(true)}
                      data-testid="membrane-on-btn"
                      aria-pressed={hasMembrane}
                      className={`rounded-lg py-1.5 px-2 text-xs font-semibold border transition-colors ${
                        hasMembrane
                          ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                          : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Có màng ngăn
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasMembrane(false)}
                      data-testid="membrane-off-btn"
                      aria-pressed={!hasMembrane}
                      className={`rounded-lg py-1.5 px-2 text-xs font-semibold border transition-colors ${
                        !hasMembrane
                          ? 'border-amber-400 bg-amber-500/15 text-amber-200'
                          : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Không màng ngăn
                    </button>
                  </div>
                </div>
              )}

              {/* Custom Electrolysis Substance Analyzer + Keyboard */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    Nhập chất bất kỳ để mô phỏng điện phân
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowElecKeyboard((s) => !s)}
                    className="text-[11px] font-semibold text-slate-400 hover:text-sky-300"
                  >
                    {showElecKeyboard ? 'Ẩn bàn phím' : 'Mở bàn phím'}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ['aqueous', 'Dung dịch'],
                      ['electroplating', 'Mạ điện'],
                      ['molten', 'Nóng chảy'],
                    ] as const
                  ).map(([mode, lbl]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setCustomElectrolysisMode(mode)}
                      className={`rounded-md py-1 text-[11px] font-semibold border ${
                        customElectrolysisMode === mode
                          ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                          : 'border-slate-700 bg-slate-900 text-slate-400'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    ref={elecInputRef}
                    type="text"
                    aria-label="Nhập công thức chất điện phân"
                    value={electrolysisFormulaInput}
                    onChange={(e) => setElectrolysisFormulaInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAnalyzeCustomElectrolysis();
                    }}
                    placeholder="vd: KBr, CuCl2, ZnSO4, CaCl2..."
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-sky-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
                    data-testid="custom-electrolysis-input"
                  />
                  <button
                    type="button"
                    onClick={() => handleAnalyzeCustomElectrolysis()}
                    className="rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 whitespace-nowrap"
                    data-testid="analyze-electrolysis-btn"
                  >
                    Mô phỏng chất
                  </button>
                </div>

                <div className="flex flex-wrap gap-1">
                  {ELECTROLYSIS_SAMPLE_FORMULAS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => {
                        setElectrolysisFormulaInput(f);
                        handleAnalyzeCustomElectrolysis(f);
                      }}
                      className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-slate-300 hover:border-sky-400 hover:text-sky-200"
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {showElecKeyboard && (
                  <ChemicalKeyboard
                    showOperators={false}
                    onInsert={(tok) =>
                      insertTokenToInput(
                        tok,
                        electrolysisFormulaInput,
                        setElectrolysisFormulaInput,
                        elecInputRef,
                      )
                    }
                    onBackspace={() => setElectrolysisFormulaInput((p) => p.slice(0, -1))}
                    onClear={() => setElectrolysisFormulaInput('')}
                  />
                )}
              </div>

              {/* Current & Duration Sliders */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label htmlFor="amp-input" className="font-semibold text-slate-300">
                      Cường độ dòng điện I (Ampe)
                    </label>
                    <span className="font-mono font-bold text-sky-300 tabular-nums">{currentAmp} A</span>
                  </div>
                  <input
                    id="amp-input"
                    type="range"
                    min={0.5}
                    max={25}
                    step={0.5}
                    value={currentAmp}
                    onChange={(e) => setCurrentAmp(Number(e.target.value))}
                    className="w-full accent-sky-400"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label htmlFor="time-input" className="font-semibold text-slate-300">
                      Thời gian điện phân t (giây)
                    </label>
                    <span className="font-mono font-bold text-sky-300 tabular-nums">
                      {durationSec} s ({(durationSec / 60).toFixed(1)} phút)
                    </span>
                  </div>
                  <input
                    id="time-input"
                    type="number"
                    min={10}
                    max={36000}
                    step={10}
                    value={durationSec}
                    onChange={(e) => setDurationSec(Math.max(1, Number(e.target.value)))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-sky-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Faraday Numeric Output */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-2.5">
                <p className="text-xs font-semibold text-slate-400">
                  Tính toán Faraday: m = (A · I · t) / (n · {FARADAY_CONSTANT})
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="block text-xs text-slate-400">Điện lượng Q</span>
                    <span className="font-mono font-bold text-slate-100 tabular-nums">
                      {electrolysisResult.chargeCoulombs.toFixed(0)} C
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-400">Số mol e trao đổi</span>
                    <span className="font-mono font-bold text-slate-100 tabular-nums">
                      {electrolysisResult.electronMoles.toFixed(4)} mol
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-400">
                      Tại Catot ({activeCell.cathodeProductName})
                    </span>
                    <span
                      className="font-mono font-bold text-sky-300 tabular-nums"
                      data-testid="cathode-mass-output"
                    >
                      {electrolysisResult.cathodeMassG.toFixed(2)} g
                      {activeCell.cathodeIsGas && ` (${electrolysisResult.cathodeGasLiters.toFixed(2)} L)`}
                    </span>
                    <span className="block text-[11px] font-mono tabular-nums mt-0.5 text-emerald-300 whitespace-nowrap">
                      {electrolysisResult.cathodeElectrodeDeltaG > 0.001
                        ? `▲ Catot tăng: +${electrolysisResult.cathodeElectrodeDeltaG.toFixed(2)} g`
                        : '• Catot: ±0.00 g (thoát khí)'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-400">
                      Tại Anot ({activeCell.anodeProductName})
                    </span>
                    <span className="font-mono font-bold text-amber-300 tabular-nums">
                      {electrolysisResult.anodeMassG.toFixed(2)} g
                      {activeCell.anodeIsGas &&
                        !activeCell.anodeReactsInSolution &&
                        ` (${electrolysisResult.anodeGasLiters.toFixed(2)} L đkc)`}
                    </span>
                    <span
                      className={`block text-[11px] font-mono tabular-nums mt-0.5 whitespace-nowrap ${
                        activeCell.anodeDissolves ? 'text-rose-300' : 'text-amber-200/90'
                      }`}
                    >
                      {activeCell.anodeDissolves
                        ? `▼ Anot giảm: -${Math.abs(electrolysisResult.anodeElectrodeDeltaG).toFixed(2)} g`
                        : activeCell.anodeReactsInSolution
                          ? '• Giữ lại dd (tạo Javel)'
                          : `▼ Khí thoát: -${electrolysisResult.anodeMassG.toFixed(2)} g`}
                    </span>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 flex items-center justify-between text-xs font-mono tabular-nums">
                  <span className="text-slate-400">Biến thiên khối lượng dung dịch:</span>
                  <span
                    className={
                      Math.abs(electrolysisResult.solutionDeltaG) < 0.005
                        ? 'font-bold text-emerald-300'
                        : 'font-bold text-rose-300'
                    }
                  >
                    {Math.abs(electrolysisResult.solutionDeltaG) < 0.005
                      ? '±0.00 g (Không đổi)'
                      : `${electrolysisResult.solutionDeltaG.toFixed(2)} g (Giảm)`}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Thể tích khí tính ở điều kiện chuẩn (25°C, 1 bar): V = n × {GAS_VOLUME_DKC} L.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-5 space-y-4">
              <h2 className="text-base font-bold text-slate-50">
                Thiết lập chất điện li, Nhập chất &amp; Đo pH
              </h2>

              <div>
                <label
                  htmlFor="electrolyte-select"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  Chọn chất tan ({electrolyteList.length} chất chuẩn)
                </label>
                <select
                  id="electrolyte-select"
                  value={customElectrolyteData ? '__custom__' : selectedElectrolyteKey}
                  onChange={(e) => {
                    setSelectedElectrolyteKey(e.target.value);
                    setElectrolyteFormulaInput(e.target.value);
                    setCustomElectrolyteData(null);
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 focus:border-sky-400 focus:outline-none"
                >
                  {customElectrolyteData && (
                    <option value="__custom__">
                      Tùy chỉnh: {customElectrolyteData.displayFormula} — {customElectrolyteData.name}
                    </option>
                  )}
                  {electrolyteList.map((el) => (
                    <option key={el.formula} value={el.formula}>
                      {el.displayFormula} — {el.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Electrolyte Input + Keyboard */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    Hoặc nhập công thức chất cần điện li
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDissocKeyboard((s) => !s)}
                    className="text-[11px] font-semibold text-slate-400 hover:text-sky-300"
                  >
                    {showDissocKeyboard ? 'Ẩn bàn phím' : 'Mở bàn phím'}
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    ref={dissocInputRef}
                    type="text"
                    aria-label="Nhập công thức chất điện li"
                    value={electrolyteFormulaInput}
                    onChange={(e) => setElectrolyteFormulaInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAnalyzeCustomElectrolyte();
                    }}
                    placeholder="vd: H2SO4, Ba(OH)2, HF, FeCl3..."
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-sky-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
                    data-testid="custom-electrolyte-input"
                  />
                  <button
                    type="button"
                    onClick={() => handleAnalyzeCustomElectrolyte()}
                    className="rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 whitespace-nowrap"
                    data-testid="analyze-electrolyte-btn"
                  >
                    Phân tích chất
                  </button>
                </div>

                <div className="flex flex-wrap gap-1">
                  {ELECTROLYTE_SAMPLE_FORMULAS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => {
                        setElectrolyteFormulaInput(f);
                        handleAnalyzeCustomElectrolyte(f);
                      }}
                      className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-slate-300 hover:border-sky-400 hover:text-sky-200"
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {showDissocKeyboard && (
                  <ChemicalKeyboard
                    showOperators={false}
                    onInsert={(tok) =>
                      insertTokenToInput(
                        tok,
                        electrolyteFormulaInput,
                        setElectrolyteFormulaInput,
                        dissocInputRef,
                      )
                    }
                    onBackspace={() => setElectrolyteFormulaInput((p) => p.slice(0, -1))}
                    onClear={() => setElectrolyteFormulaInput('')}
                  />
                )}
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor="molarity-input" className="font-semibold text-slate-300">
                    Nồng độ mol ban đầu (C_M)
                  </label>
                  <span className="font-mono font-bold text-sky-300 tabular-nums">{molarity} M</span>
                </div>
                <input
                  id="molarity-input"
                  type="number"
                  min={0.0001}
                  max={2}
                  step={0.01}
                  value={molarity}
                  onChange={(e) => setMolarity(Math.max(0.0001, Number(e.target.value)))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono tabular-nums text-slate-100 focus:border-sky-400 focus:outline-none"
                />
              </div>

              {/* pH Scale Bar */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-slate-400">Giá trị pH đo được</span>
                  <span className="font-mono text-2xl font-bold text-slate-50 tabular-nums">
                    pH = {phResult.pH.toFixed(2)}
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-gradient-to-r from-rose-600 via-emerald-500 to-indigo-600 relative">
                  <div
                    className="absolute -top-1 h-5 w-1.5 rounded bg-white border border-slate-950"
                    style={{
                      left: `calc(${Math.min(100, Math.max(0, (phResult.pH / 14) * 100))}% - 3px)`,
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                  <div>
                    <span className="text-slate-400 block">Độ điện li α</span>
                    <span className="font-mono font-semibold text-emerald-300 tabular-nums">
                      {phResult.alphaPercent.toFixed(2)}% ({phResult.conductivityLevel})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Nồng độ [H⁺]</span>
                    <span className="font-mono font-semibold text-sky-300 tabular-nums">
                      {phResult.hPlusM.toExponential(2)} M
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Reference Card: Electrode Discharge Order */}
          <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-5 space-y-2">
            <h3 className="text-sm font-bold text-slate-50">
              Quy tắc thứ tự điện phân dung dịch &amp; Mạ điện
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong className="text-sky-300">Catot (-):</strong> Ion kim loại sau Al (Ag⁺ &gt; Fe³⁺
              &gt; Cu²⁺ &gt; H⁺ &gt; Pb²⁺ &gt; Fe²⁺ &gt; Zn²⁺) bị khử trước; nếu hết sẽ điện phân
              H₂O sinh H₂ và OH⁻.
            </p>
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong className="text-amber-300">Anot (+):</strong> Nếu là điện cực trơ: anion gốc
              không oxi (I⁻ &gt; Br⁻ &gt; Cl⁻) bị oxi hóa trước, sau đó đến H₂O → O₂ + 4H⁺. Nếu là{' '}
              <strong className="text-emerald-300">Anot tan (Mạ điện)</strong>: kim loại làm cực dương
              tan trực tiếp thành ion bù vào dung dịch.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
