/**
 * Kategori default yang dibuat untuk setiap household baru (PRD bagian 6).
 * `icon` adalah kunci ikon yang dipetakan ke SVG di frontend.
 */
export interface DefaultCategory {
  name: string;
  icon: string;
  color: string;
  isEssential: boolean;
  children?: string[];
}

export const DEFAULT_EXPENSE_CATEGORIES: DefaultCategory[] = [
  { name: 'Makan & Minum', icon: 'utensils', color: '#FF7A59', isEssential: true, children: ['Makan siang', 'Makan malam', 'Kopi', 'Jajan'] },
  { name: 'Belanja Harian', icon: 'cart', color: '#F4B63F', isEssential: true },
  { name: 'Transportasi', icon: 'bus', color: '#2BB3A3', isEssential: true },
  { name: 'Bensin', icon: 'fuel', color: '#E4557A', isEssential: true },
  { name: 'Laundry', icon: 'shirt', color: '#7FC8F8', isEssential: true },
  { name: 'Tempat Tinggal', icon: 'home', color: '#5B3FD6', isEssential: true },
  { name: 'Tagihan', icon: 'bolt', color: '#3D7BF7', isEssential: true },
  { name: 'Kesehatan', icon: 'heart', color: '#D6453D', isEssential: true },
  { name: 'Cicilan & Utang', icon: 'card', color: '#4A5568', isEssential: true },
  { name: 'Pendidikan', icon: 'book', color: '#2E7D5B', isEssential: true },
  { name: 'Keluarga', icon: 'users', color: '#C2567E', isEssential: true },
  { name: 'Hiburan', icon: 'ticket', color: '#A58BFF', isEssential: false },
  { name: 'Langganan', icon: 'play', color: '#6C4BD8', isEssential: false },
  { name: 'Belanja Pribadi', icon: 'bag', color: '#D7722A', isEssential: false },
  { name: 'Sosial & Donasi', icon: 'gift', color: '#B8860B', isEssential: false },
  { name: 'Lainnya', icon: 'dots', color: '#C9C2B6', isEssential: false },
];

export const DEFAULT_INCOME_CATEGORIES: DefaultCategory[] = [
  { name: 'Gaji', icon: 'wallet', color: '#1F8A5B', isEssential: true },
  { name: 'Bonus/THR', icon: 'gift', color: '#2E7D5B', isEssential: true },
  { name: 'Usaha Sampingan', icon: 'bag', color: '#2BB3A3', isEssential: true },
  { name: 'Lainnya', icon: 'dots', color: '#C9C2B6', isEssential: true },
];

export const DEFAULT_WALLETS = [
  { name: 'Tunai', type: 'CASH' as const },
  { name: 'Rekening Bank', type: 'BANK' as const },
  { name: 'e-Wallet', type: 'EWALLET' as const },
];

/** Normalisasi nama untuk cek duplikat: huruf kecil, spasi dirapikan. */
export function toNameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}
