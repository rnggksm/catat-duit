import { useState } from 'react';

export interface Column {
  label: string;
  value: number;
  /** Teks nilai di atas batang, mis. "6,45". */
  valueLabel: string;
  /** Teks lengkap untuk pembaca layar & tooltip, mis. "September: Rp 6.450.000". */
  detail: string;
}

/**
 * Grafik kolom satu seri, dari nol. Batang ≤24px, ujung data membulat 4px, alas persegi,
 * garis dasar tipis. Satu kolom bisa disorot (mis. periode ini / hari termahal).
 * Ketuk kolom untuk melihat nilai lengkapnya.
 */
export function ColumnChart({
  columns,
  highlight,
  color = '#5B3FD6',
  soft = '#D9D2F7',
  height = 130,
}: {
  columns: Column[];
  highlight?: number;
  color?: string;
  soft?: string;
  height?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...columns.map((c) => c.value), 1);
  const shown = active ?? highlight ?? null;

  return (
    <div className="flex flex-col gap-2">
      <p className="min-h-[18px] text-xs text-muted" aria-live="polite">
        {shown != null ? columns[shown]?.detail : ''}
      </p>
      <div
        className="grid items-end gap-2 border-b border-line"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`, height: height + 22 }}
      >
        {columns.map((c, i) => {
          const on = i === highlight;
          return (
            <button
              key={c.label}
              type="button"
              aria-label={c.detail}
              onClick={() => setActive(active === i ? null : i)}
              className="flex h-full flex-col items-center justify-end gap-1"
            >
              <span className={`text-[11px] font-bold ${on ? 'text-ink' : 'text-muted'}`}>{c.valueLabel}</span>
              <span
                className="w-full max-w-6 rounded-t-[4px]"
                style={{
                  height: Math.max(2, Math.round((c.value / max) * height)),
                  background: on ? color : soft,
                  outline: active === i ? `2px solid ${color}` : 'none',
                  outlineOffset: 2,
                }}
              />
            </button>
          );
        })}
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((c, i) => (
          <span key={c.label} className={`text-center text-xs ${i === highlight ? 'font-bold text-ink' : 'text-muted'}`}>
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
