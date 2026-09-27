/**
 * Donut persentase (SVG). Lingkaran r=15.9155 punya keliling 100, jadi panjang dash = persen.
 * Tiap segmen dipisah celah 2px warna permukaan (spesifikasi dataviz), bukan garis tepi.
 */
export function Donut({
  segments,
  size = 128,
  thickness = 6,
}: {
  segments: { color: string; pct: number }[];
  size?: number;
  thickness?: number;
}) {
  const gap = segments.length > 1 ? 0.8 : 0;
  let offset = 25;
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" aria-hidden="true">
      <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#F1EDE6" strokeWidth={thickness} />
      {segments.map((s, i) => {
        const len = Math.max(s.pct - gap, 0.2);
        const el = (
          <circle
            key={i}
            cx="21"
            cy="21"
            r="15.9155"
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={`${len} ${100 - len}`}
            strokeDashoffset={offset}
          />
        );
        offset -= s.pct;
        return el;
      })}
    </svg>
  );
}

const OTHERS_COLOR = '#C9C2B6';

/** 5 kategori terbesar + sisanya digabung jadi "n lainnya" (maksimal 6 warna di satu grafik). */
export function topWithOthers<T extends { name: string; color: string; pct: number; amount?: number }>(list: T[], max = 5) {
  const top = list.slice(0, max).map((c) => ({ name: c.name, color: c.color, pct: c.pct, amount: c.amount ?? 0 }));
  const rest = list.slice(max);
  if (rest.length === 0) return top;
  return [
    ...top,
    {
      name: `${rest.length} lainnya`,
      color: OTHERS_COLOR,
      pct: Math.round(rest.reduce((s, c) => s + c.pct, 0) * 10) / 10,
      amount: rest.reduce((s, c) => s + (c.amount ?? 0), 0),
    },
  ];
}
