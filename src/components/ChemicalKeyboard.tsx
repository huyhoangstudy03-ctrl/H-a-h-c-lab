import React from 'react';
import { Delete, Eraser } from 'lucide-react';

interface ChemicalKeyboardProps {
  onInsert: (token: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  showOperators?: boolean;
}

const ELEMENT_KEYS = [
  'H', 'O', 'N', 'C', 'S', 'Cl', 'Na', 'K', 'Ca', 'Ba',
  'Mg', 'Al', 'Zn', 'Fe', 'Cu', 'Ag', 'Pb', 'Mn', 'Cr', 'Ni', 'P', 'Br', 'I', 'F',
];

const GROUP_KEYS = ['OH', 'SO4', 'NO3', 'CO3', 'PO4', 'NH4', 'COOH', 'H2O'];

const DIGIT_KEYS = ['2', '3', '4', '5', '6', '7', '8', '9', '(', ')'];

export const ChemicalKeyboard: React.FC<ChemicalKeyboardProps> = ({
  onInsert,
  onBackspace,
  onClear,
  showOperators = true,
}) => {
  return (
    <div
      className="rounded-xl border border-slate-700/80 bg-slate-900/90 p-3 space-y-2.5"
      data-testid="chemical-keyboard"
    >
      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
        <span className="font-medium text-slate-300">
          Bàn phím công thức hóa học nhanh (chạm để chèn)
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onBackspace}
            className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 whitespace-nowrap"
          >
            <Delete className="h-3.5 w-3.5" />
            Xóa 1 ký tự
          </button>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-950/50 px-2.5 py-1 text-xs font-medium text-rose-200 hover:bg-rose-900/60 whitespace-nowrap"
          >
            <Eraser className="h-3.5 w-3.5" />
            Xóa hết
          </button>
        </div>
      </div>

      {/* Elements Row */}
      <div className="flex flex-wrap gap-1.5">
        {ELEMENT_KEYS.map((el) => (
          <button
            key={el}
            type="button"
            onClick={() => onInsert(el)}
            className="min-w-[34px] rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 font-mono text-xs font-semibold text-sky-200 hover:border-sky-500 hover:bg-slate-700 transition-colors"
          >
            {el}
          </button>
        ))}
      </div>

      {/* Polyatomic Groups & Numbers Row */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        {GROUP_KEYS.map((grp) => (
          <button
            key={grp}
            type="button"
            onClick={() => onInsert(grp)}
            className="rounded-md border border-emerald-500/30 bg-emerald-950/60 px-2.5 py-1.5 font-mono text-xs font-semibold text-emerald-200 hover:border-emerald-400 hover:bg-emerald-900/70 transition-colors"
          >
            {grp}
          </button>
        ))}

        <span className="h-5 w-px bg-slate-700 mx-0.5" aria-hidden="true" />

        {DIGIT_KEYS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onInsert(d)}
            className="min-w-[30px] rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 font-mono text-xs font-bold text-amber-200 hover:border-amber-400 hover:bg-slate-800 transition-colors"
          >
            {d}
          </button>
        ))}

        {showOperators && (
          <>
            <button
              type="button"
              onClick={() => onInsert(' + ')}
              className="rounded-md border border-sky-500/40 bg-sky-950/70 px-3 py-1.5 font-mono text-xs font-bold text-sky-200 hover:bg-sky-900/80"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => onInsert(' -> ')}
              className="rounded-md border border-blue-500/50 bg-blue-700 px-3 py-1.5 font-mono text-xs font-bold text-white hover:bg-blue-600"
            >
              →
            </button>
          </>
        )}
      </div>
    </div>
  );
};
