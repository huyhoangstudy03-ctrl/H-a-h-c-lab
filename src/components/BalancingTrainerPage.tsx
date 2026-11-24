import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpenCheck,
  CheckCircle2,
  HelpCircle,
  ListChecks,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { EQUATIONS_LIBRARY, type EquationEntry } from '../data/equationsLibrary';
import {
  solveChemicalEquation,
  verifyBalancedEquation,
  type SolvedEquationResult,
} from '../utils/chemistryEngine';
import {
  fetchBalancingProgress,
  saveBalancingProgress,
  type BalancingProgressEntry,
} from '../utils/historyStorage';
import { ChemicalKeyboard } from './ChemicalKeyboard';

const QUICK_CUSTOM_SAMPLES = [
  'CuSO4 + NaOH -> Cu(OH)2 + Na2SO4',
  'FeS2 + O2 -> Fe2O3 + SO2',
  'Cu + HNO3 -> Cu(NO3)2 + NO2 + H2O',
  'KMnO4 + HCl -> KCl + MnCl2 + Cl2 + H2O',
  'Al + Fe3O4 -> Al2O3 + Fe',
];

const IMMUTABLE_RULES = [
  {
    code: 'Quy luật 1',
    title: 'Bảo toàn nguyên tố & khối lượng',
    desc: 'Số nguyên tử của mỗi nguyên tố ở vế chất tham gia bắt buộc bằng đúng số nguyên tử của nguyên tố đó ở vế sản phẩm (Định luật bảo toàn khối lượng Lomonosov – Lavoisier).',
  },
  {
    code: 'Quy luật 2',
    title: 'Tuyệt đối không sửa chỉ số chân',
    desc: 'Chỉ được đặt và thay đổi hệ số đứng TRƯỚC công thức hóa học (vd: 2H₂O). Tuyệt đối không đổi chỉ số chân (vd: không sửa H₂O thành H₂O₂) vì sẽ biến thành chất khác.',
  },
  {
    code: 'Quy luật 3',
    title: 'Hệ số nguyên dương tối giản (ƯCLN = 1)',
    desc: 'Sau khi hai vế bằng nhau, nếu toàn bộ hệ số cùng chia hết cho một số > 1 thì phải rút gọn về bộ số nguyên dương nhỏ nhất. Nếu có phân số (vd: 11/2 O₂), nhân cả 2 vế với mẫu số.',
  },
  {
    code: 'Quy luật 4',
    title: 'Thứ tự ưu tiên chuẩn: Kim loại → Phi kim → H → O',
    desc: 'Luôn cân bằng nguyên tố kim loại trước, tiếp theo là phi kim (hoặc gốc axit), sau đó tới Hiđro (H) và cuối cùng dùng Oxi (O) để kiểm tra chéo hai vế.',
  },
  {
    code: 'Quy luật 5',
    title: 'Bảo toàn nhóm nguyên tử giữ nguyên',
    desc: 'Các gốc axit hoặc nhóm như SO₄, NO₃, CO₃, PO₄, OH nếu đi nguyên vẹn từ trái sang phải (không bị phân hủy) thì coi cả nhóm như 1 "đơn vị" để cân bằng cực nhanh.',
  },
  {
    code: 'Quy luật 6',
    title: 'Thăng bằng Electron (Oxi hóa – Khử)',
    desc: 'Với phản ứng có sự thay đổi số oxi hóa, Tổng số mol electron chất khử nhường luôn bằng đúng Tổng số mol electron chất oxi hóa nhận (Σe nhường = Σe nhận).',
  },
];

export const BalancingTrainerPage: React.FC = () => {
  const [subTab, setSubTab] = useState<'practice' | 'library' | 'guide'>('practice');
  const [difficultyFilter, setDifficultyFilter] = useState<'ALL' | 'Cơ bản' | 'Trung bình' | 'Nâng cao'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Auto-balancer custom equation state
  const [customEquationInput, setCustomEquationInput] = useState<string>(
    'CuSO4 + NaOH -> Cu(OH)2 + Na2SO4',
  );
  const [solvedResult, setSolvedResult] = useState<SolvedEquationResult>(() =>
    solveChemicalEquation('CuSO4 + NaOH -> Cu(OH)2 + Na2SO4'),
  );
  const [showKeyboard, setShowKeyboard] = useState<boolean>(true);
  const customInputRef = useRef<HTMLInputElement | null>(null);

  // Interactive practice state
  const [selectedEqId, setSelectedEqId] = useState<string>(EQUATIONS_LIBRARY[0].id);
  const [coeffInputs, setCoeffInputs] = useState<number[]>([1, 1, 1]);
  const [revealedHints, setRevealedHints] = useState<number>(0);
  const [feedback, setFeedback] = useState<{
    status: 'idle' | 'success' | 'warning' | 'error';
    message: string;
    diffs?: Record<string, { left: number; right: number }>;
  }>({ status: 'idle', message: '' });

  const [progressMap, setProgressMap] = useState<Record<string, BalancingProgressEntry>>({});
  const [expandedLibraryHints, setExpandedLibraryHints] = useState<Record<string, number>>({});

  useEffect(() => {
    void fetchBalancingProgress().then(setProgressMap);
  }, []);

  const handleSolveCustomEquation = (inputOverride?: string) => {
    const raw = inputOverride ?? customEquationInput;
    const res = solveChemicalEquation(raw);
    setSolvedResult(res);
  };

  const handleKeyboardInsert = (token: string) => {
    const el = customInputRef.current;
    if (!el) {
      setCustomEquationInput((prev) => prev + token);
      return;
    }
    const start = el.selectionStart ?? customEquationInput.length;
    const end = el.selectionEnd ?? customEquationInput.length;
    const nextVal =
      customEquationInput.slice(0, start) + token + customEquationInput.slice(end);
    setCustomEquationInput(nextVal);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleKeyboardBackspace = () => {
    const el = customInputRef.current;
    if (!el) {
      setCustomEquationInput((prev) => prev.slice(0, -1));
      return;
    }
    const start = el.selectionStart ?? customEquationInput.length;
    const end = el.selectionEnd ?? customEquationInput.length;
    if (start !== end) {
      const nextVal = customEquationInput.slice(0, start) + customEquationInput.slice(end);
      setCustomEquationInput(nextVal);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start, start);
      });
    } else if (start > 0) {
      const nextVal =
        customEquationInput.slice(0, start - 1) + customEquationInput.slice(start);
      setCustomEquationInput(nextVal);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start - 1, start - 1);
      });
    }
  };

  const handleKeyboardClear = () => {
    setCustomEquationInput('');
    customInputRef.current?.focus();
  };

  const filteredEquations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return EQUATIONS_LIBRARY.filter((eq) => {
      if (difficultyFilter !== 'ALL' && eq.difficulty !== difficultyFilter) return false;
      if (!q) return true;
      const text =
        eq.reactants.map((r) => r.display).join(' ') +
        ' ' +
        eq.products.map((p) => p.display).join(' ') +
        ' ' +
        eq.category;
      return text.toLowerCase().includes(q);
    });
  }, [difficultyFilter, searchQuery]);

  const activeEquation: EquationEntry = useMemo(
    () => EQUATIONS_LIBRARY.find((e) => e.id === selectedEqId) ?? EQUATIONS_LIBRARY[0],
    [selectedEqId],
  );

  const selectEquation = (eq: EquationEntry) => {
    setSelectedEqId(eq.id);
    const totalTerms = eq.reactants.length + eq.products.length;
    setCoeffInputs(Array(totalTerms).fill(1));
    setRevealedHints(0);
    setFeedback({ status: 'idle', message: '' });
  };

  const handleCoeffChange = (idx: number, raw: string) => {
    const val = parseInt(raw, 10);
    setCoeffInputs((prev) => prev.map((v, i) => (i === idx ? (Number.isNaN(val) ? 0 : val) : v)));
  };

  const handleCheckBalance = async () => {
    const rLen = activeEquation.reactants.length;
    const rCoeffs = coeffInputs.slice(0, rLen);
    const pCoeffs = coeffInputs.slice(rLen);

    const check = verifyBalancedEquation(
      activeEquation.reactants,
      activeEquation.products,
      rCoeffs,
      pCoeffs,
    );

    if (!check.validInputs) {
      setFeedback({ status: 'error', message: check.errorMessage || 'Hệ số không hợp lệ.' });
      return;
    }

    if (check.balanced && check.isMinimalRatio) {
      setFeedback({
        status: 'success',
        message: 'Chính xác! Số nguyên tử mọi nguyên tố ở hai vế đã bằng nhau và hệ số đã tối giản.',
        diffs: check.elementDiffs,
      });
      const updated = await saveBalancingProgress(activeEquation.id, true);
      setProgressMap(updated);
    } else if (check.balanced && !check.isMinimalRatio) {
      setFeedback({
        status: 'warning',
        message: check.errorMessage || 'Hệ số chưa tối giản.',
        diffs: check.elementDiffs,
      });
      const updated = await saveBalancingProgress(activeEquation.id, false);
      setProgressMap(updated);
    } else {
      setFeedback({
        status: 'error',
        message: check.errorMessage || 'Hai vế chưa cân bằng.',
        diffs: check.elementDiffs,
      });
      const updated = await saveBalancingProgress(activeEquation.id, false);
      setProgressMap(updated);
    }
  };

  const handleApplySolution = () => {
    setCoeffInputs([...activeEquation.solutionCoeffs]);
    setRevealedHints(activeEquation.hints.length);
    setFeedback({
      status: 'success',
      message: 'Đã điền đáp án chuẩn. Hãy xem các bước gợi ý bên dưới để nắm vững phương pháp.',
    });
  };

  const solvedCount = Object.values(progressMap).filter((p) => p.solved).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold text-sky-400">
            Rèn luyện &amp; Giải nhanh Phương trình Hóa học · Đã hoàn thành {solvedCount}/{EQUATIONS_LIBRARY.length} bài
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-50">
            Cân bằng Phương trình, Giải tự động &amp; Quy luật chuẩn
          </h1>
        </div>

        <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/90 p-1 self-start">
          <button
            type="button"
            onClick={() => setSubTab('practice')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
              subTab === 'practice'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Giải tự động &amp; Luyện tập
          </button>
          <button
            type="button"
            onClick={() => setSubTab('library')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
              subTab === 'library'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <ListChecks className="h-3.5 w-3.5" />
            Kho {EQUATIONS_LIBRARY.length} phản ứng
          </button>
          <button
            type="button"
            onClick={() => setSubTab('guide')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
              subTab === 'guide'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <BookOpenCheck className="h-3.5 w-3.5" />
            Các bước &amp; Quy luật cân bằng
          </button>
        </div>
      </div>

      {subTab === 'practice' && (
        <div className="space-y-6">
          {/* Auto-Balancer Section with Chemical Keyboard */}
          <section className="rounded-2xl border border-slate-800 bg-[#0F172A] p-5 sm:p-6 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400">
                  <Sparkles className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-50">
                    Cân bằng Phương trình Bất kỳ (Tìm đáp án chính xác nhất)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Nhập chất tham gia và sản phẩm hoặc chạm bàn phím hóa học bên dưới (vd: CuSO4 + NaOH -&gt; Cu(OH)2 + Na2SO4)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyboard((s) => !s)}
                className="self-start sm:self-auto rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              >
                {showKeyboard ? 'Thu gọn bàn phím hóa học' : 'Mở bàn phím hóa học'}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                ref={customInputRef}
                type="text"
                aria-label="Nhập phương trình hóa học cần cân bằng"
                value={customEquationInput}
                onChange={(e) => setCustomEquationInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSolveCustomEquation();
                }}
                placeholder="Ví dụ: FeS2 + O2 -> Fe2O3 + SO2"
                className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-sm sm:text-base font-medium text-sky-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
                data-testid="custom-equation-input"
              />
              <button
                type="button"
                onClick={() => handleSolveCustomEquation()}
                className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-sky-400 transition-colors whitespace-nowrap"
                data-testid="solve-custom-equation-btn"
              >
                Cân bằng tự động
              </button>
            </div>

            {/* Quick sample buttons */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-400 mr-1">Thử nhanh:</span>
              {QUICK_CUSTOM_SAMPLES.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => {
                    setCustomEquationInput(sample);
                    handleSolveCustomEquation(sample);
                  }}
                  className="rounded-lg border border-slate-700/80 bg-slate-900 px-2.5 py-1 font-mono text-[11px] text-slate-300 hover:border-sky-500/50 hover:text-sky-300 transition-colors"
                >
                  {sample}
                </button>
              ))}
            </div>

            {showKeyboard && (
              <ChemicalKeyboard
                onInsert={handleKeyboardInsert}
                onBackspace={handleKeyboardBackspace}
                onClear={handleKeyboardClear}
                showOperators
              />
            )}

            {/* Exact Auto-Balancer Output */}
            {solvedResult.success ? (
              <div
                className="rounded-xl border border-emerald-500/35 bg-emerald-950/30 p-4 space-y-3"
                data-testid="auto-balance-result"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-emerald-300">
                    Đáp án cân bằng tối giản chính xác:
                  </span>
                  <div className="flex flex-wrap gap-2 font-mono text-xs text-emerald-200">
                    {Object.entries(solvedResult.elementCounts).map(([el, count]) => (
                      <span
                        key={el}
                        className="rounded-md border border-emerald-500/30 bg-emerald-950/60 px-2 py-0.5 tabular-nums"
                      >
                        {el}: {count} = {count} ✓
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-950/90 border border-slate-800 px-4 py-3 font-mono text-base sm:text-lg font-bold text-amber-300">
                  {solvedResult.balancedText}
                </div>
                <div className="space-y-1.5 text-xs text-slate-300 leading-relaxed">
                  {solvedResult.steps.map((st, i) => (
                    <p key={i}>{st}</p>
                  ))}
                </div>
              </div>
            ) : (
              <div
                className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-sm text-rose-200"
                data-testid="auto-balance-error"
              >
                {solvedResult.error}
              </div>
            )}
          </section>

          {/* Interactive Practice Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Equation Selector */}
            <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-[#0F172A] p-4 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {(['ALL', 'Cơ bản', 'Trung bình', 'Nâng cao'] as const).map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setDifficultyFilter(diff)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      difficultyFilter === diff
                        ? 'bg-sky-500 text-slate-950'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {diff === 'ALL' ? 'Tất cả' : diff}
                  </button>
                ))}
              </div>

              <div className="divide-y divide-slate-800 max-h-[460px] overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50">
                {filteredEquations.map((eq) => {
                  const isSelected = eq.id === activeEquation.id;
                  const isSolved = progressMap[eq.id]?.solved;
                  return (
                    <button
                      key={eq.id}
                      type="button"
                      onClick={() => selectEquation(eq)}
                      className={`w-full px-3.5 py-3 text-left transition-colors ${
                        isSelected
                          ? 'bg-sky-500/15 border-l-2 border-l-sky-400'
                          : 'hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                        <span>Lớp {eq.grade} · {eq.difficulty}</span>
                        {isSolved && (
                          <span className="font-semibold text-emerald-400">✓ Đã hoàn thành</span>
                        )}
                      </div>
                      <div className="mt-1 font-mono text-xs font-semibold text-slate-100">
                        {eq.reactants.map((r) => r.display).join(' + ')} →{' '}
                        {eq.products.map((p) => p.display).join(' + ')}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Interactive Balancing Stage */}
            <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#0F172A] p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <span className="text-xs font-semibold text-sky-400">
                    {activeEquation.category} · {activeEquation.methodName}
                  </span>
                  <h2 className="text-lg font-bold text-slate-50">
                    Tự điền hệ số nguyên tối giản vào ô trống
                  </h2>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Điều kiện: {activeEquation.condition}
                </span>
              </div>

              {/* Interactive Coefficients Row */}
              <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-950/80 p-5">
                {activeEquation.reactants.map((r, idx) => (
                  <React.Fragment key={`r_${idx}`}>
                    {idx > 0 && <span className="font-mono text-lg font-bold text-slate-500">+</span>}
                    <div className="inline-flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        max={99}
                        aria-label={`Hệ số ${r.display}`}
                        value={coeffInputs[idx] ?? 1}
                        onChange={(e) => handleCoeffChange(idx, e.target.value)}
                        className="w-14 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-center font-mono text-base font-bold text-sky-300 tabular-nums focus:border-sky-400 focus:outline-none"
                      />
                      <span className="font-mono text-lg font-semibold text-slate-100">
                        {r.display}
                      </span>
                    </div>
                  </React.Fragment>
                ))}

                <span className="mx-1 font-mono text-xl font-bold text-sky-400">→</span>

                {activeEquation.products.map((p, idx) => {
                  const cIdx = activeEquation.reactants.length + idx;
                  return (
                    <React.Fragment key={`p_${idx}`}>
                      {idx > 0 && (
                        <span className="font-mono text-lg font-bold text-slate-500">+</span>
                      )}
                      <div className="inline-flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          max={99}
                          aria-label={`Hệ số ${p.display}`}
                          value={coeffInputs[cIdx] ?? 1}
                          onChange={(e) => handleCoeffChange(cIdx, e.target.value)}
                          className="w-14 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-center font-mono text-base font-bold text-emerald-300 tabular-nums focus:border-emerald-400 focus:outline-none"
                        />
                        <span className="font-mono text-lg font-semibold text-slate-100">
                          {p.display}
                        </span>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleCheckBalance()}
                  className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-sky-400 transition-colors"
                >
                  Kiểm tra đáp án
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRevealedHints((h) => Math.min(activeEquation.hints.length, h + 1))
                  }
                  disabled={revealedHints >= activeEquation.hints.length}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50"
                >
                  <HelpCircle className="h-4 w-4 text-amber-400" />
                  Gợi ý bước tiếp ({revealedHints}/{activeEquation.hints.length})
                </button>
                <button
                  type="button"
                  onClick={handleApplySolution}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Xem đáp án chuẩn
                </button>
              </div>

              {/* Validation Feedback */}
              {feedback.status !== 'idle' && (
                <div
                  className={`rounded-xl border p-4 text-sm ${
                    feedback.status === 'success'
                      ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
                      : feedback.status === 'warning'
                        ? 'border-amber-500/40 bg-amber-950/40 text-amber-200'
                        : 'border-rose-500/40 bg-rose-950/40 text-rose-200'
                  }`}
                  data-testid="balancing-feedback"
                >
                  <p className="font-semibold">{feedback.message}</p>
                  {feedback.diffs && (
                    <div className="mt-2.5 flex flex-wrap gap-3 font-mono text-xs">
                      {Object.entries(feedback.diffs).map(([el, counts]) => (
                        <span
                          key={el}
                          className={
                            counts.left === counts.right
                              ? 'text-emerald-300'
                              : 'text-rose-300 font-bold'
                          }
                        >
                          {el}: {counts.left} = {counts.right}{' '}
                          {counts.left === counts.right ? '✓' : '✗'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Progressive Step-by-Step Hints */}
              {revealedHints > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2.5">
                  <p className="text-xs font-bold text-sky-400">Hướng dẫn giải từng bước:</p>
                  {activeEquation.hints.slice(0, revealedHints).map((hint, i) => (
                    <p key={i} className="text-sm text-slate-300 leading-relaxed">
                      {hint}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {subTab === 'library' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm w-full">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm phương trình (vd: Cu, HNO3, KMnO4, FeS2...)"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['ALL', 'Cơ bản', 'Trung bình', 'Nâng cao'] as const).map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setDifficultyFilter(diff)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    difficultyFilter === diff
                      ? 'bg-sky-500 text-slate-950'
                      : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {diff === 'ALL' ? 'Tất cả' : diff}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredEquations.map((eq) => {
              const rLen = eq.reactants.length;
              const formattedLeft = eq.reactants
                .map((r, i) => `${eq.solutionCoeffs[i] > 1 ? eq.solutionCoeffs[i] : ''}${r.display}`)
                .join(' + ');
              const formattedRight = eq.products
                .map(
                  (p, i) =>
                    `${eq.solutionCoeffs[rLen + i] > 1 ? eq.solutionCoeffs[rLen + i] : ''}${p.display}`,
                )
                .join(' + ');
              const shownSteps = expandedLibraryHints[eq.id] ?? 0;

              return (
                <div
                  key={eq.id}
                  className="rounded-2xl border border-slate-800 bg-[#0F172A] p-5 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      Lớp {eq.grade} · {eq.category}
                    </span>
                    <span className="font-semibold text-sky-300">{eq.difficulty}</span>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 font-mono text-sm font-semibold text-amber-300">
                    {formattedLeft} → {formattedRight}
                  </div>
                  <div className="text-xs text-slate-400">
                    Phương pháp: <strong className="text-slate-200">{eq.methodName}</strong> · Điều
                    kiện: {eq.condition}
                  </div>

                  {shownSteps > 0 && (
                    <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3 space-y-1.5 text-xs text-slate-300">
                      {eq.hints.slice(0, shownSteps).map((h, idx) => (
                        <p key={idx}>{h}</p>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedLibraryHints((prev) => ({
                          ...prev,
                          [eq.id]: shownSteps >= eq.hints.length ? 0 : eq.hints.length,
                        }))
                      }
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                    >
                      {shownSteps >= eq.hints.length
                        ? 'Ẩn gợi ý giải'
                        : 'Xem gợi ý từng bước giải'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        selectEquation(eq);
                        setSubTab('practice');
                      }}
                      className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400"
                    >
                      Tự luyện cân bằng
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {subTab === 'guide' && (
        <div className="space-y-6">
          {/* Section 1: 6 Immutable Balancing Laws */}
          <section className="rounded-2xl border border-slate-800 bg-[#0F172A] p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <div>
                <h2 className="text-lg font-bold text-slate-50">
                  6 Quy luật bất biến để cân bằng mọi phương trình luôn đúng
                </h2>
                <p className="text-xs text-slate-400">
                  Nắm chắc 6 nguyên tắc nền tảng trước khi đặt hệ số
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {IMMUTABLE_RULES.map((rule) => (
                <div
                  key={rule.code}
                  className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-1.5"
                >
                  <span className="text-xs font-bold text-sky-400">{rule.code}</span>
                  <h3 className="text-sm font-bold text-slate-100">{rule.title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{rule.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 2: Detailed Step-by-step Methods */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-6 space-y-3">
              <p className="text-xs font-semibold text-sky-400">Phương pháp 1 · Nhẩm nhanh Chẵn – Lẻ</p>
              <h2 className="text-lg font-bold text-slate-50">
                Làm chẵn nguyên tử lẻ &amp; Kim loại → Phi kim → H → O
              </h2>
              <ol className="space-y-2 text-sm text-slate-300 list-decimal pl-4">
                <li>Viết đúng công thức chất tham gia và sản phẩm, tuyệt đối không đổi chỉ số chân.</li>
                <li>Quan sát nguyên tố có số nguyên tử một bên chẵn, một bên lẻ (vd: O₂ có 2 O, Fe₂O₃ có 3 O). Nhân 2 vào chất có số lẻ (2Fe₂O₃ = 6 O) để làm chẵn.</li>
                <li>Cân bằng theo thứ tự: Kim loại (Fe) → Phi kim khác (S, C, N, P, Cl) → Hiđro (H) → Oxi (O).</li>
              </ol>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 text-xs space-y-1">
                <p className="font-semibold text-amber-300">Ví dụ minh họa: Fe + O₂ → Fe₃O₄</p>
                <p className="text-slate-300">Bước 1: Oxi bên trái 2, bên phải 4 → đặt hệ số 2 trước O₂ (2 × 2 = 4 O).</p>
                <p className="text-slate-300">Bước 2: Sắt bên phải có 3 Fe → đặt hệ số 3 trước Fe.</p>
                <p className="font-mono font-bold text-emerald-300">Kết quả: 3Fe + 2O₂ → Fe₃O₄</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-6 space-y-3">
              <p className="text-xs font-semibold text-sky-400">Phương pháp 2 · Nhóm nguyên tử</p>
              <h2 className="text-lg font-bold text-slate-50">
                Cân bằng theo gốc axit &amp; nhóm hiđroxit nguyên vẹn
              </h2>
              <ol className="space-y-2 text-sm text-slate-300 list-decimal pl-4">
                <li>Nhận diện nhóm nguyên tử giữ nguyên cấu trúc qua phản ứng: (SO₄), (NO₃), (PO₄), (CO₃), (OH).</li>
                <li>Xem cả nhóm như một đơn vị để tìm bội chung nhỏ nhất giữa hai vế.</li>
                <li>Điền hệ số vào chất chứa nhiều nhóm nhất trước, sau đó suy ngược lại kim loại và nước (H₂O coi như H–OH khi trung hòa).</li>
              </ol>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 text-xs space-y-1">
                <p className="font-semibold text-amber-300">
                  Ví dụ: Al₂(SO₄)₃ + NaOH → Al(OH)₃↓ + Na₂SO₄
                </p>
                <p className="text-slate-300">Bước 1: Có 3 nhóm SO₄ bên trái → đặt 3 trước Na₂SO₄.</p>
                <p className="text-slate-300">Bước 2: Có 2 Al bên trái → đặt 2 trước Al(OH)₃; từ 3Na₂SO₄ có 6 Na → đặt 6 trước NaOH.</p>
                <p className="font-mono font-bold text-emerald-300">
                  Kết quả: Al₂(SO₄)₃ + 6NaOH → 2Al(OH)₃↓ + 3Na₂SO₄
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-6 space-y-3">
              <p className="text-xs font-semibold text-sky-400">Phương pháp 3 · Trọng tâm Lớp 10–12</p>
              <h2 className="text-lg font-bold text-slate-50">
                4 Bước Thăng bằng Electron (Oxi hóa – Khử)
              </h2>
              <ol className="space-y-2 text-sm text-slate-300 list-decimal pl-4">
                <li>
                  <strong className="text-slate-100">Bước 1 (Xác định số oxi hóa):</strong> Tìm các nguyên tố thay đổi số oxi hóa (Khử tăng – Oxi hóa giảm).
                </li>
                <li>
                  <strong className="text-slate-100">Bước 2 (Viết bán phản ứng):</strong> Viết quá trình nhường electron và quá trình nhận electron; nhớ nhân đủ chỉ số chân nếu chất là phân tử (vd: Cl₂, Fe₂, N₂O).
                </li>
                <li>
                  <strong className="text-slate-100">Bước 3 (Thăng bằng e):</strong> Tìm BCNN của số e nhường và nhận để có bộ hệ số sao cho Σe nhường = Σe nhận.
                </li>
                <li>
                  <strong className="text-slate-100">Bước 4 (Điền &amp; cân bằng môi trường):</strong> Đặt hệ số vào sản phẩm khử/oxi hóa → cân bằng kim loại → cộng tổng gốc axit/môi trường → cân bằng H và kiểm tra O.
                </li>
              </ol>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 text-xs space-y-1">
                <p className="font-semibold text-amber-300">
                  Ví dụ chuẩn: Cu + HNO₃ → Cu(NO₃)₂ + NO↑ + H₂O
                </p>
                <p className="text-slate-300">Cu⁰ → Cu⁺² + 2e (×3) &nbsp;|&nbsp; N⁺⁵ + 3e → N⁺² (×2)</p>
                <p className="text-slate-300">Đặt 3 Cu(NO₃)₂ và 2 NO → tổng N bên phải = 3×2 + 2 = 8 → đặt 8 HNO₃ và 4 H₂O.</p>
                <p className="font-mono font-bold text-emerald-300">
                  Kết quả: 3Cu + 8HNO₃ → 3Cu(NO₃)₂ + 2NO↑ + 4H₂O
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-6 space-y-3">
              <p className="text-xs font-semibold text-sky-400">Phương pháp 4 · Tự kiểm tra &amp; Đại số</p>
              <h2 className="text-lg font-bold text-slate-50">
                Phương pháp Đại số &amp; Checklist 4 bước không bao giờ sai
              </h2>
              <ol className="space-y-2 text-sm text-slate-300 list-decimal pl-4">
                <li>
                  <strong className="text-slate-100">Đặt ẩn:</strong> Gán <span className="font-mono text-sky-300">a, b, c, d...</span> cho từng chất, chọn 1 ẩn bằng 1 rồi lập phương trình bảo toàn cho từng nguyên tố.
                </li>
                <li>
                  <strong className="text-slate-100">Với phản ứng có 2 chất oxi hóa/tạo khí hỗn hợp:</strong> Như FeS₂ + O₂ hoặc KMnO₄ + HCl, dùng bảo toàn nguyên tố từng bước hoặc ô Giải tự động ở tab đầu tiên.
                </li>
              </ol>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/25 p-3.5 text-xs space-y-1.5">
                <p className="font-semibold text-emerald-300">Checklist 4 bước kiểm tra sau khi cân bằng:</p>
                <p className="text-slate-200">1. Kiểm tra lại số nguyên tử nguyên tố cuối cùng (thường là Oxi).</p>
                <p className="text-slate-200">2. Đảm bảo không còn hệ số phân số hay số âm.</p>
                <p className="text-slate-200">3. Kiểm tra ƯCLN của tất cả hệ số phải bằng 1.</p>
                <p className="text-slate-200">4. Nếu là phương trình ion rút gọn: kiểm tra thêm Tổng điện tích trái = Tổng điện tích phải.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
