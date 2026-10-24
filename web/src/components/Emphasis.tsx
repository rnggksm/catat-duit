import { emphasisParts } from '../lib/emphasis';

/**
 * Menebalkan bagian penting di dalam pesan saran (nominal, kelipatan, persentase).
 * Teksnya tetap utuh — hanya dipecah jadi potongan biasa dan potongan tebal.
 */
export function Emphasis({ text }: { text: string }) {
  return (
    <>
      {emphasisParts(text).map((part, i) =>
        part.strong ? (
          <strong key={i} className="font-bold text-ink">
            {part.text}
          </strong>
        ) : (
          part.text
        ),
      )}
    </>
  );
}
