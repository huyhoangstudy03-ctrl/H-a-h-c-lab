import React, { useEffect, useMemo, useState } from 'react';
import {
  Atom,
  Beaker,
  BookmarkCheck,
  Cloud,
  FileDown,
  Flame,
  GitMerge,
  History,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  CHEMICAL_CATALOG,
  CPK_COLORS,
  findReactionForPair,
  LAB_REACTIONS,
  type LabReactionPreset,
} from '../data/chemicalsAndReactions';
import { calculateMolarMass, computeStoichiometry } from '../utils/chemistryEngine';
import { buildReactionMechanism } from '../utils/molecularMechanism';
import {
  deleteReactionRecord,
  fetchReactionHistory,
  persistReactionRecord,
  type ReactionHistoryEntry,
} from '../utils/historyStorage';
import { exportExperimentPdfReport } from '../utils/pdfReportGenerator';
import { Lab3DViewport, type ViewportMode } from './Lab3DViewport';

interface LabWorkspaceProps {
  user: User | null;
  initialReactionId?: string | null;
  onSignIn: () => void;
}

export const LabWorkspace: React.FC<LabWorkspaceProps> = ({
  user,
  initialReactionId,
  onSignIn,
}) => {
  const [viewportMode, setViewportMode] = useState<ViewportMode>('lab');
  const [substanceAId, setSubstanceAId] = useState<string>('cuso4');
  const [substanceBId, setSubstanceBId] = useState<string>('naoh');
  const [massAG, setMassAG] = useState<number>(15.96);
  const [massBG, setMassBG] = useState<number>(8.0);
  const [heated, setHeated] = useState<boolean>(false);
  const [presetGradeFilter, setPresetGradeFilter] = useState<'ALL' | 10 | 11 | 12>('ALL');

  const [selectedMoleculeId, setSelectedMoleculeId] = useState<string>('cuso4');
  const [isReacted, setIsReacted] = useState<boolean>(false);
  const [reactionTriggerSeq, setReactionTriggerSeq] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [historyList, setHistoryList] = useState<ReactionHistoryEntry[]>([]);
  const [historySearch, setHistorySearch] = useState<string>('');
  const [isSavingHistory, setIsSavingHistory] = useState<boolean>(false);

  useEffect(() => {
    if (initialReactionId) {
      const preset = LAB_REACTIONS.find((r) => r.id === initialReactionId);
      if (preset) {
        setSubstanceAId(preset.reactantAId);
        setSubstanceBId(preset.reactantBId);
        setMassAG(preset.reactantADefaultMassG);
        setMassBG(preset.reactantBDefaultMassG);
        setHeated(preset.requiresHeat);
        setIsReacted(false);
        setViewportMode('lab');
      }
    }
  }, [initialReactionId]);

  useEffect(() => {
    let active = true;
    void fetchReactionHistory().then((items) => {
      if (active) setHistoryList(items);
    });
    return () => {
      active = false;
    };
  }, [user]);

  const substanceA = useMemo(
    () => CHEMICAL_CATALOG.find((c) => c.id === substanceAId) ?? CHEMICAL_CATALOG[0],
    [substanceAId],
  );
  const substanceB = useMemo(
    () => CHEMICAL_CATALOG.find((c) => c.id === substanceBId) ?? CHEMICAL_CATALOG[1],
    [substanceBId],
  );

  const activeReaction: LabReactionPreset | null = useMemo(
    () => findReactionForPair(substanceAId, substanceBId),
    [substanceAId, substanceBId],
  );

  const visiblePresets = useMemo(
    () =>
      presetGradeFilter === 'ALL'
        ? LAB_REACTIONS
        : LAB_REACTIONS.filter((r) => r.grade === presetGradeFilter),
    [presetGradeFilter],
  );

  // Align masses order if user picked (B, A) instead of (A, B)
  const orientedMasses = useMemo(() => {
    if (!activeReaction) return { mA: massAG, mB: massBG, rA: substanceA, rB: substanceB };
    if (activeReaction.reactantAId === substanceAId) {
      return { mA: massAG, mB: massBG, rA: substanceA, rB: substanceB };
    }
    return { mA: massBG, mB: massAG, rA: substanceB, rB: substanceA };
  }, [activeReaction, substanceAId, substanceA, substanceB, massAG, massBG]);

  const stoichiometry = useMemo(() => {
    if (!activeReaction) {
      return computeStoichiometry(
        {
          formula: substanceA.formula,
          name: substanceA.name,
          coeff: 1,
          stateLabel: substanceA.defaultState,
          colorLabel: substanceA.defaultColorName,
        },
        {
          formula: substanceB.formula,
          name: substanceB.name,
          coeff: 1,
          stateLabel: substanceB.defaultState,
          colorLabel: substanceB.defaultColorName,
        },
        [],
        massAG,
        massBG,
        false,
      );
    }
    return computeStoichiometry(
      {
        formula: orientedMasses.rA.formula,
        name: orientedMasses.rA.name,
        coeff: activeReaction.reactantACoeff,
        stateLabel: orientedMasses.rA.defaultState,
        colorLabel: orientedMasses.rA.defaultColorName,
      },
      {
        formula: orientedMasses.rB.formula,
        name: orientedMasses.rB.name,
        coeff: activeReaction.reactantBCoeff,
        stateLabel: orientedMasses.rB.defaultState,
        colorLabel: orientedMasses.rB.defaultColorName,
      },
      activeReaction.products.map((p) => ({
        formula: p.formula,
        name: p.name,
        coeff: p.coeff,
        stateLabel: p.stateLabel,
        colorLabel: p.colorLabel,
      })),
      orientedMasses.mA,
      orientedMasses.mB,
      isReacted,
    );
  }, [activeReaction, orientedMasses, substanceA, substanceB, massAG, massBG, isReacted]);

  const handleSelectPreset = (preset: LabReactionPreset) => {
    setSubstanceAId(preset.reactantAId);
    setSubstanceBId(preset.reactantBId);
    setMassAG(preset.reactantADefaultMassG);
    setMassBG(preset.reactantBDefaultMassG);
    setHeated(preset.requiresHeat);
    setSelectedMoleculeId(preset.reactantAId);
    setIsReacted(false);
    setStatusMessage(null);
  };

  const handleMixAndReact = () => {
    if (substanceAId === substanceBId) {
      setStatusMessage('Vui lòng chọn 2 chất khác nhau để tiến hành trộn và quan sát phản ứng.');
      return;
    }
    if (massAG <= 0 || massBG <= 0) {
      setStatusMessage('Khối lượng hai chất tham gia phải lớn hơn 0 gam.');
      return;
    }
    setViewportMode('lab');
    setIsReacted(true);
    setReactionTriggerSeq((s) => s + 1);
    if (activeReaction?.requiresHeat && !heated) {
      setHeated(true);
    }
    setStatusMessage(
      activeReaction
        ? `Đã trộn và hoàn tất phản ứng: ${activeReaction.balancedEquation}`
        : `Đã trộn ${substanceA.displayFormula} và ${substanceB.displayFormula}: không xảy ra phản ứng hóa học ở điều kiện này.`,
    );
  };

  const handleResetLab = () => {
    setIsReacted(false);
    setStatusMessage(null);
  };

  const handleSaveToHistory = async () => {
    setIsSavingHistory(true);
    try {
      const record = await persistReactionRecord({
        reactionId: activeReaction?.id ?? `custom_${substanceA.id}_${substanceB.id}`,
        reactantAName: orientedMasses.rA.name,
        reactantAFormula: orientedMasses.rA.displayFormula,
        reactantAMassG: orientedMasses.mA,
        reactantBName: orientedMasses.rB.name,
        reactantBFormula: orientedMasses.rB.displayFormula,
        reactantBMassG: orientedMasses.mB,
        balancedEquation: activeReaction
          ? activeReaction.balancedEquation
          : `${substanceA.displayFormula} + ${substanceB.displayFormula} → Không phản ứng`,
        didReact: Boolean(activeReaction),
        colorChangeSummary: activeReaction
          ? activeReaction.colorAfterLabel
          : 'Hỗn hợp giữ nguyên màu sắc ban đầu của các chất trộn.',
        stateChangeSummary: activeReaction
          ? activeReaction.stateChangeLabel
          : 'Không có kết tủa hoặc khí mới sinh ra.',
        totalMassBeforeG: stoichiometry.totalMassBeforeG,
        totalMassAfterG: stoichiometry.totalMassAfterG,
        notes: activeReaction?.thermalNote,
      });
      setHistoryList((prev) => [record, ...prev]);
      setStatusMessage('Đã lưu kết quả thí nghiệm vào lịch sử tra cứu.');
    } catch {
      setStatusMessage('Đã lưu vào bộ nhớ trình duyệt (chưa đồng bộ được lên đám mây).');
    } finally {
      setIsSavingHistory(false);
    }
  };

  const handleExportPdf = () => {
    const filename = exportExperimentPdfReport({
      title: activeReaction
        ? activeReaction.title
        : `Thí nghiệm trộn ${substanceA.name} và ${substanceB.name}`,
      reactantAName: orientedMasses.rA.name,
      reactantAFormula: orientedMasses.rA.displayFormula,
      reactantAMassG: orientedMasses.mA,
      reactantBName: orientedMasses.rB.name,
      reactantBFormula: orientedMasses.rB.displayFormula,
      reactantBMassG: orientedMasses.mB,
      balancedEquation: activeReaction
        ? activeReaction.balancedEquation
        : `${substanceA.displayFormula} + ${substanceB.displayFormula} → Không xảy ra phản ứng`,
      didReact: Boolean(activeReaction),
      reactionType: activeReaction?.reactionType ?? 'Hỗn hợp vật lí (không phản ứng)',
      colorBefore: activeReaction
        ? activeReaction.colorBeforeLabel
        : `${substanceA.defaultColorName} + ${substanceB.defaultColorName}`,
      colorAfter: activeReaction ? activeReaction.colorAfterLabel : 'Không đổi màu đáng kể',
      stateChange: activeReaction
        ? activeReaction.stateChangeLabel
        : 'Không xuất hiện kết tủa hay bọt khí',
      thermalNote: activeReaction?.thermalNote ?? 'Nhiệt độ phòng (25°C)',
      observationDetail:
        activeReaction?.observationDetail ??
        'Hai chất không thỏa mãn điều kiện phản ứng trao đổi (tạo kết tủa, chất khí, chất điện li yếu) hoặc oxi hóa - khử nên chỉ tạo hỗn hợp cơ học.',
      stoichiometry,
    });
    setStatusMessage(`Đã xuất báo cáo thí nghiệm thành công: ${filename}`);
  };

  const handleDeleteHistory = async (id: string) => {
    await deleteReactionRecord(id);
    setHistoryList((prev) => prev.filter((item) => item.id !== id));
  };

  const handleLoadFromHistory = (entry: ReactionHistoryEntry) => {
    const preset = LAB_REACTIONS.find((r) => r.id === entry.reactionId);
    if (preset) {
      setSubstanceAId(preset.reactantAId);
      setSubstanceBId(preset.reactantBId);
      setMassAG(entry.reactantAMassG);
      setMassBG(entry.reactantBMassG);
      setHeated(preset.requiresHeat);
      setIsReacted(true);
      setReactionTriggerSeq((s) => s + 1);
      setViewportMode('lab');
      setStatusMessage(`Đã tải lại thí nghiệm: ${entry.balancedEquation}`);
    }
  };

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return historyList;
    return historyList.filter(
      (h) =>
        h.balancedEquation.toLowerCase().includes(q) ||
        h.reactantAName.toLowerCase().includes(q) ||
        h.reactantBName.toLowerCase().includes(q),
    );
  }, [historyList, historySearch]);

  const inspectedMolecule = useMemo(
    () => CHEMICAL_CATALOG.find((c) => c.id === selectedMoleculeId) ?? substanceA,
    [selectedMoleculeId, substanceA],
  );

  const mechanismSpec = useMemo(
    () => buildReactionMechanism(activeReaction, substanceA, substanceB),
    [activeReaction, substanceA, substanceB],
  );

  return (
    <div className="space-y-8">
      {/* Workspace Mode Header & Presets Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold text-sky-400">
            Phòng thí nghiệm ảo 3D ({CHEMICAL_CATALOG.length} hóa chất · {LAB_REACTIONS.length} phản ứng) &amp; Mô hình phân tử
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-50 text-balance">
            Mô phỏng Phản ứng Hóa học 3D Sắc nét
          </h1>
          <p className="mt-1 text-sm text-slate-400 max-w-2xl">
            Chọn chất tham gia và khối lượng để mô phỏng trộn hóa chất trong bình thí nghiệm 3D, quan sát cấu trúc phân tử không gian, tính toán bảo toàn khối lượng và xuất báo cáo PDF.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/90 p-1 self-start">
          <button
            type="button"
            onClick={() => setViewportMode('lab')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
              viewportMode === 'lab'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <Beaker className="h-3.5 w-3.5" />
            Phòng thí nghiệm trộn 3D
          </button>
          <button
            type="button"
            onClick={() => setViewportMode('mechanism')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
              viewportMode === 'mechanism'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <GitMerge className="h-3.5 w-3.5" />
            Tách &amp; Nối phân tử 3D
          </button>
          <button
            type="button"
            onClick={() => setViewportMode('molecule')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
              viewportMode === 'molecule'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <Atom className="h-3.5 w-3.5" />
            Mô hình phân tử 3D
          </button>
        </div>
      </div>

      {/* Main Split Stage: 3D Viewport (Left) + Control Console (Right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        <div className="lg:col-span-7 space-y-4">
          <Lab3DViewport
            mode={viewportMode}
            substanceA={substanceA}
            substanceB={substanceB}
            activeReaction={activeReaction}
            isReacted={isReacted}
            reactionTriggerSeq={reactionTriggerSeq}
            selectedMoleculeId={selectedMoleculeId}
            heated={heated}
            onModeChange={setViewportMode}
            onTriggerReaction={handleMixAndReact}
            onResetLab={handleResetLab}
          />

          {/* Quick Experiment Presets Strip */}
          <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-100">
                Thí nghiệm trọng tâm sách Kết nối tri thức ({visiblePresets.length})
              </h2>
              <div className="flex items-center gap-1">
                {(['ALL', 10, 11, 12] as const).map((g) => (
                  <button
                    key={String(g)}
                    type="button"
                    onClick={() => setPresetGradeFilter(g)}
                    className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                      presetGradeFilter === g
                        ? 'bg-sky-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {g === 'ALL' ? 'Tất cả' : `Lớp ${g}`}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[250px] overflow-y-auto pr-1">
              {visiblePresets.map((rxn) => {
                const isActive = activeReaction?.id === rxn.id;
                return (
                  <button
                    key={rxn.id}
                    type="button"
                    onClick={() => handleSelectPreset(rxn)}
                    className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                      isActive
                        ? 'border-sky-400 bg-sky-500/15 text-sky-100'
                        : 'border-slate-800 bg-slate-950/60 text-slate-200 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/25"
                        style={{ backgroundColor: rxn.liquidColorAfterHex }}
                      />
                      <span className="text-xs font-semibold font-mono truncate">
                        {rxn.balancedEquation.split('→')[0].split('⇌')[0].trim()}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400 truncate">
                      Lớp {rxn.grade} · {rxn.reactionType.split('(')[0].trim()}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Control Deck */}
        <div className="lg:col-span-5 space-y-4">
          {viewportMode === 'lab' ? (
            <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-50">
                  Thiết lập chất trộn &amp; khối lượng
                </h2>
                <button
                  type="button"
                  onClick={handleResetLab}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-sky-300"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Làm sạch bình
                </button>
              </div>

              {/* Reactant A */}
              <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="select-reactant-a"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-slate-200"
                  >
                    <span
                      className="h-3 w-3 rounded-full border border-white/30"
                      style={{ backgroundColor: substanceA.colorHex }}
                    />
                    Chất tham gia A (Cốc trái)
                  </label>
                  <span className="text-xs font-mono text-slate-400 tabular-nums">
                    M = {calculateMolarMass(substanceA.formula)} g/mol
                  </span>
                </div>
                <select
                  id="select-reactant-a"
                  value={substanceAId}
                  onChange={(e) => {
                    setSubstanceAId(e.target.value);
                    setIsReacted(false);
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none"
                >
                  {CHEMICAL_CATALOG.map((chem) => (
                    <option key={chem.id} value={chem.id}>
                      {chem.displayFormula} — {chem.name} ({chem.defaultState})
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-3">
                  <label htmlFor="mass-a-input" className="text-xs text-slate-400 whitespace-nowrap">
                    Khối lượng (g):
                  </label>
                  <input
                    id="mass-a-input"
                    type="number"
                    min={0.1}
                    max={500}
                    step={0.1}
                    value={massAG}
                    onChange={(e) => setMassAG(Math.max(0, Number(e.target.value)))}
                    className="w-28 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm font-mono tabular-nums text-sky-200"
                  />
                  <span className="text-xs font-mono text-slate-400 tabular-nums">
                    ≈ {(massAG / (calculateMolarMass(substanceA.formula) || 1)).toFixed(3)} mol
                  </span>
                </div>
              </div>

              {/* Reactant B */}
              <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="select-reactant-b"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-slate-200"
                  >
                    <span
                      className="h-3 w-3 rounded-full border border-white/30"
                      style={{ backgroundColor: substanceB.colorHex }}
                    />
                    Chất tham gia B (Cốc phải)
                  </label>
                  <span className="text-xs font-mono text-slate-400 tabular-nums">
                    M = {calculateMolarMass(substanceB.formula)} g/mol
                  </span>
                </div>
                <select
                  id="select-reactant-b"
                  value={substanceBId}
                  onChange={(e) => {
                    setSubstanceBId(e.target.value);
                    setIsReacted(false);
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none"
                >
                  {CHEMICAL_CATALOG.map((chem) => (
                    <option key={chem.id} value={chem.id}>
                      {chem.displayFormula} — {chem.name} ({chem.defaultState})
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-3">
                  <label htmlFor="mass-b-input" className="text-xs text-slate-400 whitespace-nowrap">
                    Khối lượng (g):
                  </label>
                  <input
                    id="mass-b-input"
                    type="number"
                    min={0.1}
                    max={500}
                    step={0.1}
                    value={massBG}
                    onChange={(e) => setMassBG(Math.max(0, Number(e.target.value)))}
                    className="w-28 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm font-mono tabular-nums text-sky-200"
                  />
                  <span className="text-xs font-mono text-slate-400 tabular-nums">
                    ≈ {(massBG / (calculateMolarMass(substanceB.formula) || 1)).toFixed(3)} mol
                  </span>
                </div>
              </div>

              {/* Condition Toggle */}
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-3.5 py-2.5">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <Flame className="h-4 w-4 text-amber-400" />
                  Đèn cồn / Gia nhiệt (t°)
                </span>
                <button
                  type="button"
                  onClick={() => setHeated((h) => !h)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    heated
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {heated ? 'Đang đun nóng' : 'Nhiệt độ phòng'}
                </button>
              </div>

              {/* Primary CTA */}
              <button
                type="button"
                onClick={handleMixAndReact}
                className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-sky-400 transition-colors"
              >
                Trộn &amp; Tiến hành phản ứng 3D
              </button>

              <button
                type="button"
                onClick={() => setViewportMode('mechanism')}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 transition-colors"
              >
                <GitMerge className="h-4 w-4" />
                Xem cơ chế tách &amp; nối liên kết phân tử 3D
              </button>

              {statusMessage && (
                <p className="rounded-xl border border-sky-500/30 bg-sky-950/30 px-3 py-2 text-xs text-sky-200">
                  {statusMessage}
                </p>
              )}

              {/* Quick Actions: Save History & Export PDF */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleSaveToHistory}
                  disabled={isSavingHistory}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap"
                >
                  <BookmarkCheck className="h-4 w-4 text-emerald-400" />
                  {isSavingHistory ? 'Đang lưu...' : 'Lưu lịch sử'}
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 whitespace-nowrap"
                >
                  <FileDown className="h-4 w-4" />
                  Xuất báo cáo PDF
                </button>
              </div>
            </div>
          ) : viewportMode === 'mechanism' ? (
            /* 3D Molecular Bond-Breaking & Bond-Forming Inspector */
            (() => {
              const mech = mechanismSpec;
              const uniqueElements = Array.from(new Set(mech.atoms.map((a) => a.element)));
              return (
                <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-emerald-400">
                        Mô phỏng cơ chế vi mô 3D
                      </p>
                      <h2 className="text-base font-bold text-slate-50 mt-0.5">{mech.title}</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setViewportMode('lab')}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700 whitespace-nowrap"
                    >
                      Về bình Lab 3D
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 font-mono text-sm font-bold text-amber-300">
                    {mech.equation}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{mech.mechanismSummary}</p>

                  <div className="space-y-2">
                    <div className="rounded-xl border border-sky-500/30 bg-sky-950/30 px-3 py-2">
                      <span className="text-xs font-bold text-sky-300">1. Tiếp cận (0–24%): </span>
                      <span className="text-xs text-slate-200">{mech.stages.approach}</span>
                    </div>
                    <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 px-3 py-2">
                      <span className="text-xs font-bold text-rose-300">
                        2. Tách liên kết cũ (24–52%):{' '}
                      </span>
                      <span className="text-xs text-slate-200">{mech.stages.breaking}</span>
                    </div>
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3 py-2">
                      <span className="text-xs font-bold text-emerald-300">
                        3. Nối liên kết mới (52–86%):{' '}
                      </span>
                      <span className="text-xs text-slate-200">{mech.stages.forming}</span>
                    </div>
                    <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-2">
                      <span className="text-xs font-bold text-amber-300">
                        4. Sản phẩm bền (86–100%):{' '}
                      </span>
                      <span className="text-xs text-slate-200">{mech.stages.complete}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800">
                    <p className="text-xs font-semibold text-slate-300 mb-1.5">
                      Nguyên tử tham gia trong mô hình ({mech.atoms.length} nguyên tử):
                    </p>
                    <div className="flex flex-wrap gap-2.5 text-xs text-slate-200">
                      {uniqueElements.map((el) => (
                        <span key={el} className="inline-flex items-center gap-1.5 font-mono">
                          <span
                            className="h-3 w-3 rounded-full border border-white/30"
                            style={{ backgroundColor: CPK_COLORS[el]?.color ?? '#64748B' }}
                          />
                          {el}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            /* 3D Molecule Inspector Controls */
            <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-5 space-y-4">
              <h2 className="text-base font-bold text-slate-50">
                Thư viện mô hình phân tử 3D (CPK)
              </h2>
              <div>
                <label
                  htmlFor="molecule-select"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  Chọn chất cần quan sát cấu trúc không gian
                </label>
                <select
                  id="molecule-select"
                  value={selectedMoleculeId}
                  onChange={(e) => setSelectedMoleculeId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none"
                >
                  {CHEMICAL_CATALOG.map((chem) => (
                    <option key={chem.id} value={chem.id}>
                      {chem.displayFormula} — {chem.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold text-slate-50">{inspectedMolecule.name}</span>
                  <span className="font-mono text-sm font-bold text-sky-400">
                    {inspectedMolecule.displayFormula}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Lớp {inspectedMolecule.grade} · {inspectedMolecule.category} · M ={' '}
                  {calculateMolarMass(inspectedMolecule.formula)} g/mol
                </p>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {inspectedMolecule.description}
                </p>
                <div className="pt-2 border-t border-slate-800">
                  <p className="text-xs font-semibold text-slate-300 mb-1.5">
                    Quy ước màu nguyên tử trong mô hình:
                  </p>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-200">
                    {Array.from(new Set(inspectedMolecule.atoms3D.map((a) => a.element))).map(
                      (el) => (
                        <span key={el} className="inline-flex items-center gap-1.5 font-mono">
                          <span
                            className="h-3 w-3 rounded-full border border-white/30"
                            style={{ backgroundColor: CPK_COLORS[el]?.color ?? '#64748B' }}
                          />
                          {el}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMoleculeId(substanceAId)}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                >
                  Xem chất A ({substanceA.displayFormula})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMoleculeId(substanceBId)}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                >
                  Xem chất B ({substanceB.displayFormula})
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Reaction Outcome Table */}
      <section className="rounded-2xl border border-slate-800 bg-[#0F172A] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-50">
              Bảng kết quả phản ứng, cân bằng phương trình &amp; biến đổi màu sắc – trạng thái
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isReacted
                ? 'Kết quả đo đạc sau khi trộn hai chất trong bình phản ứng 3D'
                : 'Dự báo định lượng trước khi trộn (nhấn "Trộn & Tiến hành phản ứng 3D" để kích hoạt mô phỏng)'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 font-mono text-sm font-bold text-amber-300">
            {activeReaction
              ? activeReaction.balancedEquation
              : `${substanceA.displayFormula} + ${substanceB.displayFormula} → Không phản ứng`}
          </div>
        </div>

        {/* Color & State Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs font-semibold text-slate-400">Màu sắc trước → sau phản ứng</p>
            <p className="mt-1.5 text-sm font-medium text-slate-100">
              {activeReaction
                ? `${activeReaction.colorBeforeLabel} → ${activeReaction.colorAfterLabel}`
                : `${substanceA.defaultColorName} + ${substanceB.defaultColorName} (không đổi màu)`}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs font-semibold text-slate-400">
              Trạng thái thay đổi (kết tủa / khí)
            </p>
            <p className="mt-1.5 text-sm font-medium text-slate-100">
              {activeReaction
                ? activeReaction.stateChangeLabel
                : 'Không xuất hiện kết tủa hay khí mới'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs font-semibold text-slate-400">
              Điều kiện &amp; Bảo toàn khối lượng
            </p>
            <p className="mt-1.5 text-sm font-mono font-bold text-emerald-400 tabular-nums">
              Σm trước: {stoichiometry.totalMassBeforeG.toFixed(2)} g = Σm sau:{' '}
              {stoichiometry.totalMassAfterG.toFixed(2)} g
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {activeReaction ? activeReaction.thermalNote : 'Nhiệt độ phòng'}
            </p>
          </div>
        </div>

        {/* Stoichiometry Data Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-xs font-semibold text-slate-300">
              <tr>
                <th className="px-4 py-3">Chất đã trộn / Sản phẩm</th>
                <th className="px-4 py-3">Vai trò</th>
                <th className="px-4 py-3 text-right">Khối lượng mol (M)</th>
                <th className="px-4 py-3 text-right">Số mol (mol)</th>
                <th className="px-4 py-3 text-right">Khối lượng (g)</th>
                <th className="px-4 py-3">Màu sắc &amp; Trạng thái cụ thể</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/40">
              <tr>
                <td className="px-4 py-3 font-medium text-slate-100">
                  {orientedMasses.rA.name}{' '}
                  <span className="font-mono text-sky-300">
                    ({orientedMasses.rA.displayFormula})
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-300">
                  Tham gia{' '}
                  {stoichiometry.limitingReactant === 'A'
                    ? '(Phản ứng hết)'
                    : stoichiometry.limitingReactant === 'B'
                      ? '(Còn dư)'
                      : ''}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">
                  {stoichiometry.reactantAMolarMass.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">
                  {stoichiometry.reactantAMolesInitial.toFixed(4)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-100">
                  {stoichiometry.reactantAMassInitialG.toFixed(2)} g
                  {isReacted && activeReaction && (
                    <span className="block text-xs text-slate-400">
                      Dư: {stoichiometry.reactantAMassRemainingG.toFixed(2)} g
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-300">
                  {orientedMasses.rA.defaultState} · {orientedMasses.rA.defaultColorName}
                </td>
              </tr>

              <tr>
                <td className="px-4 py-3 font-medium text-slate-100">
                  {orientedMasses.rB.name}{' '}
                  <span className="font-mono text-sky-300">
                    ({orientedMasses.rB.displayFormula})
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-300">
                  Tham gia{' '}
                  {stoichiometry.limitingReactant === 'B'
                    ? '(Phản ứng hết)'
                    : stoichiometry.limitingReactant === 'A'
                      ? '(Còn dư)'
                      : ''}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">
                  {stoichiometry.reactantBMolarMass.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">
                  {stoichiometry.reactantBMolesInitial.toFixed(4)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-100">
                  {stoichiometry.reactantBMassInitialG.toFixed(2)} g
                  {isReacted && activeReaction && (
                    <span className="block text-xs text-slate-400">
                      Dư: {stoichiometry.reactantBMassRemainingG.toFixed(2)} g
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-300">
                  {orientedMasses.rB.defaultState} · {orientedMasses.rB.defaultColorName}
                </td>
              </tr>

              {stoichiometry.productsProduced.map((prod) => (
                <tr key={prod.formula} className="bg-emerald-950/30">
                  <td className="px-4 py-3 font-medium text-slate-50">
                    {prod.name}{' '}
                    <span className="font-mono text-emerald-300">({prod.formula})</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-emerald-400">Sản phẩm tạo thành</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">
                    {prod.molarMass.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">
                    {prod.moles.toFixed(4)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-emerald-300">
                    {prod.massG.toFixed(2)} g
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    {prod.stateLabel} · {prod.colorLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {activeReaction && (
          <p className="text-sm text-slate-300 leading-relaxed">
            <span className="font-semibold text-sky-300">Giải thích hiện tượng: </span>
            {activeReaction.observationDetail}
          </p>
        )}
      </section>

      {/* Saved Reaction History Section */}
      <section className="rounded-2xl border border-slate-800 bg-[#0F172A] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <History className="h-5 w-5 text-sky-400" />
            <div>
              <h2 className="text-lg font-bold text-slate-50">
                Lịch sử các phản ứng đã thực hiện ({historyList.length})
              </h2>
              <p className="text-xs text-slate-400">
                {user
                  ? `Đang đồng bộ đám mây với tài khoản ${user.email}`
                  : 'Đang lưu cục bộ trên trình duyệt — đăng nhập Google để đồng bộ nhiều thiết bị'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Tìm phương trình, tên chất..."
                className="rounded-xl border border-slate-700 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
              />
            </div>
            {!user && (
              <button
                type="button"
                onClick={onSignIn}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/25 whitespace-nowrap"
              >
                <Cloud className="h-3.5 w-3.5" />
                Đồng bộ Cloud
              </button>
            )}
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-6 text-center text-sm text-slate-400">
            Chưa có phản ứng nào được lưu. Hãy thực hiện trộn chất và nhấn &ldquo;Lưu lịch sử&rdquo; để tra cứu nhanh về sau.
          </div>
        ) : (
          <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/50">
            {filteredHistory.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-900/60"
              >
                <div className="space-y-1">
                  <div className="font-mono text-sm font-bold text-amber-300">
                    {item.balancedEquation}
                  </div>
                  <div className="text-xs text-slate-300">
                    {item.reactantAName} ({item.reactantAMassG.toFixed(2)} g) + {item.reactantBName}{' '}
                    ({item.reactantBMassG.toFixed(2)} g) ·{' '}
                    <span className="text-slate-400">
                      {new Date(item.createdAtIso).toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">{item.stateChangeSummary}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleLoadFromHistory(item)}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700 whitespace-nowrap"
                  >
                    Nạp lại Lab 3D
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteHistory(item.id)}
                    aria-label={`Xóa lịch sử ${item.balancedEquation}`}
                    className="rounded-lg border border-rose-500/30 bg-rose-950/50 p-1.5 text-rose-300 hover:bg-rose-900/60"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
