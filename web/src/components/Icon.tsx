/** Ikon garis 24×24 (stroke 1.8) yang dipakai di mockup. Kunci sama dengan `icon` di kategori API. */
const PATHS: Record<string, string> = {
  utensils: 'M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 3c-2 0-3 2-3 6s1 5 3 5v7',
  cart: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2M9 20h.01M17 20h.01',
  bus: 'M6 17V6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v11M6 17h12M6 11h12M8 20v-3M16 20v-3',
  fuel: 'M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M4 10h10M14 8h2a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V9l-3-3',
  shirt: 'M8 3l-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 0 1-8 0z',
  home: 'M3 11l9-8 9 8M5 9.5V21h14V9.5M10 21v-6h4v6',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  card: 'M3 6h18v12H3zM3 10h18M7 15h4',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM19 19v2H6',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14a6.5 6.5 0 0 1 3.5 6',
  ticket: 'M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V6zM14 6v12',
  play: 'M4 5h16v11H4zM8 20h8M10 8.5v4l3.5-2z',
  bag: 'M5 8h14l-1 13H6L5 8zM9 8V6a3 3 0 0 1 6 0v2',
  gift: 'M4 10h16v11H4zM3 7h18v3H3zM12 7v14',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16 14.5h.01',
  coffee: 'M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v2M12 3v2',
  piggy: 'M5 11a7 6 0 0 1 12-2h2l1 3-2 1v3h-2v2h-3v-2H9v2H6v-3a6 6 0 0 1-1-4zM15 11h.01M3 10c0 1 .5 2 2 2',
  car: 'M5 17h14M6 17l1.5-6h9L18 17M7 20v-3M17 20v-3M8.5 14h.01M15.5 14h.01',
  // Navigasi & UI
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  chart: 'M12 3v9h9A9 9 0 1 1 12 3zM15 3.3A9 9 0 0 1 20.7 9H15z',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  plus: 'M12 5v14M5 12h14',
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  sparkle: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6',
  close: 'M6 6l12 12M18 6L6 18',
  chevronLeft: 'M15 18l-6-6 6-6',
  check: 'M5 12l5 5 9-10',
  backspace: 'M21 5H8l-6 7 6 7h13zM12 9l6 6M18 9l-6 6',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  note: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3',
  arrowUp: 'M7 17L17 7M9 7h8v8',
  arrowDown: 'M7 7l10 10M17 9v8H9',
  wifiOff: 'M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2.3-1.8M2 8.8a15 15 0 0 1 4.2-2.7M22 8.8A15 15 0 0 0 11 5M12 20h.01',
};

interface IconProps {
  name: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/** Ikon titik (mis. "Lainnya") digambar dengan garis sangat pendek, jadi perlu garis lebih tebal agar terlihat. */
const DOT_ICONS = new Set(['dots']);

export function Icon({ name, size = 24, strokeWidth = 1.8, className }: IconProps) {
  const key = PATHS[name] ? name : 'dots';
  const width = DOT_ICONS.has(key) ? Math.max(strokeWidth * 1.9, 3.4) : strokeWidth;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[key]} />
    </svg>
  );
}

/** Warna latar lembut untuk ubin kategori: warna kategori dengan alpha rendah. */
export function tint(hex: string, alpha = 0.16) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]) {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

const INK: [number, number, number] = [27, 24, 48];
const cache = new Map<string, string>();

/**
 * Versi warna kategori yang cukup gelap untuk ikon di atas latar terang (kontras ≥ 3,6:1 terhadap putih — di atas batas WCAG 3:1,
 * dengan cadangan karena latar ubin sedikit berwarna). Warna yang sudah cukup gelap dikembalikan apa adanya.
 * Juga dipakai sebagai latar ubin terpilih dengan ikon putih, yang butuh kontras yang sama.
 */
export function iconColor(hex: string) {
  const hit = cache.get(hex);
  if (hit) return hit;
  const base = rgb(hex);
  let out = hex;
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const mix = base.map((v, i) => Math.round(v + (INK[i] - v) * t)) as [number, number, number];
    const contrast = 1.05 / (luminance(mix) + 0.05);
    if (contrast >= 3.6) {
      out = `#${mix.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
      break;
    }
  }
  cache.set(hex, out);
  return out;
}
