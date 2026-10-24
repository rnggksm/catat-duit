/**
 * Bagian penting di dalam pesan saran: nominal rupiah, kelipatan ("26,2×"),
 * dan persentase ("30%"). Dipakai `Emphasis` untuk menebalkannya.
 *
 * Pesan datang sebagai teks biasa dari server dan tersimpan apa adanya di DB,
 * jadi penekanan dikerjakan saat render — bukan disimpan sebagai markup. Efeknya
 * saran yang sudah ada di database ikut tertebalkan tanpa perlu dihitung ulang.
 */
const IMPORTANT = /(Rp\s?\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?\s?[×%])/g;

export interface EmphasisPart {
  text: string;
  strong: boolean;
}

export function emphasisParts(text: string): EmphasisPart[] {
  // split() dengan capture group menyisipkan hasil tangkapan di indeks ganjil.
  return text
    .split(IMPORTANT)
    .map((part, i) => ({ text: part, strong: i % 2 === 1 }))
    .filter((part) => part.text !== '');
}
