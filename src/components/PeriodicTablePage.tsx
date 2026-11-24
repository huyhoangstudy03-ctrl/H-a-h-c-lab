import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  CATEGORY_STYLES,
  PERIODIC_ELEMENTS,
  type ElementCategory,
  type PeriodicElement,
} from '../data/periodicTableData';

type HeatmapMode = 'category' | 'electronegativity' | 'mass' | 'radius';

export const PeriodicTablePage: React.FC = () => {
  const [selectedNumber, setSelectedNumber] = useState<number>(29); // Cu default
  const [categoryFilter, setCategoryFilter] = useState<ElementCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [heatmap, setHeatmap] = useState<HeatmapMode>('category');

  const selectedElement: PeriodicElement = useMemo(
    () => PERIODIC_ELEMENTS.find((e) => e.number === selectedNumber) ?? PERIODIC_ELEMENTS[0],
    [selectedNumber],
  );

  const categories = useMemo(
    () => Array.from(new Set(PERIODIC_ELEMENTS.map((e) => e.category))) as ElementCategory[],
    [],
  );

  const matchesElement = (el: PeriodicElement) => {
    if (categoryFilter !== 'ALL' && el.category !== categoryFilter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      el.symbol.toLowerCase().includes(q) ||
      el.name.toLowerCase().includes(q) ||
      String(el.number) === q
    );
  };

  const getHeatmapInlineStyle = (el: PeriodicElement): React.CSSProperties | undefined => {
    if (heatmap === 'category') return undefined;
    if (heatmap === 'electronegativity') {
      if (el.electronegativity === null) return { backgroundColor: '#1E293B', color: '#94A3B8' };
      const ratio = (el.electronegativity - 0.7) / 3.3;
      const alpha = Math.min(0.92, Math.max(0.18, ratio * 0.92));
      return { backgroundColor: `rgba(14, 165, 233, ${alpha})`, color: '#F8FAFC' };
    }
    if (heatmap === 'mass') {
      const ratio = Math.min(1, el.mass / 294);
      const alpha = Math.max(0.18, ratio * 0.9);
      return { backgroundColor: `rgba(16, 185, 129, ${alpha})`, color: '#F8FAFC' };
    }
    if (heatmap === 'radius') {
      if (el.radiusPm === null) return { backgroundColor: '#1E293B', color: '#94A3B8' };
      const ratio = el.radiusPm / 298;
      const alpha = Math.max(0.18, ratio * 0.92);
      return { backgroundColor: `rgba(245, 158, 11, ${alpha})`, color: '#F8FAFC' };
    }
    return undefined;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold text-sky-400">
            118 Nguyên tố Hóa học · Cấu hình electron &amp; Quy luật tuần hoàn
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-50">
            Bảng Tuần Hoàn Tương Tác
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm Kí hiệu, Tên, Z..."
              className="rounded-xl border border-slate-700 bg-slate-900 pl-8 pr-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
            />
          </div>

          <select
            aria-label="Chế độ tô màu bản đồ nhiệt"
            value={heatmap}
            onChange={(e) => setHeatmap(e.target.value as HeatmapMode)}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 focus:border-sky-400 focus:outline-none"
          >
            <option value="category">Màu theo phân loại nhóm</option>
            <option value="electronegativity">Bản đồ độ âm điện (Pauling)</option>
            <option value="radius">Bản đồ bán kính nguyên tử (pm)</option>
            <option value="mass">Bản đồ nguyên tử khối</option>
          </select>
        </div>
      </div>

      {/* Category Filter Strip */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setCategoryFilter('ALL')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
            categoryFilter === 'ALL'
              ? 'bg-sky-500 text-slate-950'
              : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
          }`}
        >
          Tất cả 118 nguyên tố
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              categoryFilter === cat
                ? 'bg-sky-500 text-slate-950'
                : `${CATEGORY_STYLES[cat].bg} border ${CATEGORY_STYLES[cat].border} ${CATEGORY_STYLES[cat].text}`
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* 18-Column Periodic Table Grid */}
        <div className="xl:col-span-9 rounded-2xl border border-slate-800 bg-[#0F172A] p-3 sm:p-4 overflow-x-auto">
          <div
            className="grid gap-1 min-w-[820px]"
            style={{
              gridTemplateColumns: 'repeat(18, minmax(0, 1fr))',
              gridTemplateRows: 'repeat(10, minmax(48px, auto))',
            }}
          >
            {PERIODIC_ELEMENTS.map((el) => {
              const matched = matchesElement(el);
              const isSelected = el.number === selectedNumber;
              const styleDef = CATEGORY_STYLES[el.category];
              const inlineStyle = getHeatmapInlineStyle(el);

              return (
                <button
                  key={el.number}
                  type="button"
                  onClick={() => setSelectedNumber(el.number)}
                  style={{
                    gridColumnStart: el.xpos,
                    gridRowStart: el.ypos,
                    ...inlineStyle,
                  }}
                  aria-label={`Nguyên tố ${el.number} ${el.symbol} ${el.name}`}
                  className={`relative rounded-md border p-1 text-left transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-sky-400 ${
                    heatmap === 'category'
                      ? `${styleDef.bg} ${styleDef.border} ${styleDef.text}`
                      : 'border-slate-700'
                  } ${isSelected ? 'ring-2 ring-sky-400 z-10' : ''} ${
                    matched ? 'opacity-100' : 'opacity-25'
                  }`}
                >
                  <div className="flex items-center justify-between text-[9px] font-mono leading-none opacity-85">
                    <span>{el.number}</span>
                  </div>
                  <div className="mt-0.5 text-sm font-bold leading-tight text-center">{el.symbol}</div>
                  <div className="text-[8px] truncate text-center opacity-80">{el.mass}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Element Inspector + Bohr Shell SVG */}
        <aside className="xl:col-span-3 rounded-2xl border border-slate-800 bg-[#0F172A] p-5 space-y-4">
          <div className="flex items-start justify-between border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs font-semibold text-sky-400">{selectedElement.category}</span>
              <h2 className="mt-0.5 text-2xl font-bold text-slate-50">
                {selectedElement.name}{' '}
                <span className="font-mono text-sky-300">({selectedElement.symbol})</span>
              </h2>
              <p className="text-xs font-mono text-slate-400 mt-0.5">
                Z = {selectedElement.number} · Khối lượng: {selectedElement.mass} amu
              </p>
            </div>
          </div>

          {/* Bohr Shell SVG Diagram */}
          <div className="flex flex-col items-center rounded-xl border border-slate-800 bg-[#070D19] p-4">
            <svg
              viewBox="-110 -110 220 220"
              className="w-44 h-44"
              aria-label={`Mô hình lớp electron của ${selectedElement.symbol}`}
            >
              <circle cx="0" cy="0" r="14" fill="#0EA5E9" />
              <text
                x="0"
                y="4"
                textAnchor="middle"
                fill="#070D19"
                fontSize="11"
                fontWeight="700"
                fontFamily="monospace"
              >
                {selectedElement.symbol}
              </text>
              {selectedElement.shells.map((count, sIdx) => {
                const r = 24 + sIdx * 12;
                return (
                  <g key={sIdx}>
                    <circle
                      cx="0"
                      cy="0"
                      r={r}
                      fill="none"
                      stroke="rgba(148, 163, 184, 0.35)"
                      strokeWidth="1"
                    />
                    {Array.from({ length: count }).map((_, eIdx) => {
                      const angle = (eIdx / count) * Math.PI * 2 - Math.PI / 2;
                      const cx = Math.cos(angle) * r;
                      const cy = Math.sin(angle) * r;
                      return <circle key={eIdx} cx={cx} cy={cy} r="2.6" fill="#38BDF8" />;
                    })}
                  </g>
                );
              })}
            </svg>
            <span className="mt-1 font-mono text-xs text-slate-300">
              Phân bố lớp e: ({selectedElement.shells.join(', ')})
            </span>
          </div>

          {/* Element Properties */}
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between gap-2 py-1 border-b border-slate-800">
              <dt className="text-slate-400">Cấu hình electron</dt>
              <dd className="font-mono font-semibold text-slate-100 text-right">
                {selectedElement.config}
              </dd>
            </div>
            <div className="flex justify-between gap-2 py-1 border-b border-slate-800">
              <dt className="text-slate-400">Chu kì / Nhóm</dt>
              <dd className="font-mono font-semibold text-slate-100">
                Chu kì {selectedElement.ypos <= 7 ? selectedElement.ypos : selectedElement.ypos - 3} · Cột{' '}
                {selectedElement.xpos}
              </dd>
            </div>
            <div className="flex justify-between gap-2 py-1 border-b border-slate-800">
              <dt className="text-slate-400">Độ âm điện (Pauling)</dt>
              <dd className="font-mono font-semibold text-sky-300 tabular-nums">
                {selectedElement.electronegativity ?? 'Không xác định'}
              </dd>
            </div>
            <div className="flex justify-between gap-2 py-1 border-b border-slate-800">
              <dt className="text-slate-400">Số oxi hóa phổ biến</dt>
              <dd className="font-mono font-semibold text-amber-300">
                {selectedElement.oxidationStates}
              </dd>
            </div>
            <div className="flex justify-between gap-2 py-1 border-b border-slate-800">
              <dt className="text-slate-400">Bán kính nguyên tử</dt>
              <dd className="font-mono font-semibold text-slate-100 tabular-nums">
                {selectedElement.radiusPm ? `${selectedElement.radiusPm} pm` : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-2 py-1">
              <dt className="text-slate-400">Trạng thái (25°C)</dt>
              <dd className="font-semibold text-emerald-300">{selectedElement.state25C}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
};
