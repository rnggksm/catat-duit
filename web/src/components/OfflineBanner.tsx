import { useEffect, useState } from 'react';
import { useOutbox } from '../lib/offline';
import { Icon } from './Icon';

/** Banner "sedang offline" (mockup layar 12). */
export function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const ops = useOutbox();

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (online) return null;
  return (
    <div role="status" className="sticky top-0 z-30 flex items-center gap-2.5 bg-ink px-5 py-3 text-[13px] text-white">
      <Icon name="wifiOff" size={18} className="shrink-0 text-amber" />
      <span>
        Kamu sedang offline.
        {ops.length > 0 ? ` ${ops.length} catatan akan tersinkron otomatis.` : ' Catatan baru tetap bisa disimpan.'}
      </span>
    </div>
  );
}
