import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, X } from 'lucide-react';
import { useSnackbarStore, SnackbarItem } from '../store/snackbarStore';

const AUTO_DISMISS_MS = 4000;

function SnackbarRow({ item }: { item: SnackbarItem }) {
  const dismiss = useSnackbarStore((s) => s.dismiss);
  useEffect(() => {
    const t = setTimeout(() => dismiss(item.id), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [item.id, dismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      role="status"
      className="pointer-events-auto flex items-center gap-3 min-w-[280px] max-w-md rounded-xl bg-foreground text-background shadow-2xl shadow-black/20 pl-4 pr-2 py-3"
    >
      <CheckCircle2 size={20} className="shrink-0 text-emerald-400" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug">{item.message}</p>
        {item.detail && <p className="text-xs opacity-70 truncate mt-0.5">{item.detail}</p>}
      </div>
      <button
        onClick={() => dismiss(item.id)}
        className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-background/10 transition"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
}

/** Bottom-centre success snackbars; sits above modals (z-50) and confetti. */
export function SnackbarContainer() {
  const items = useSnackbarStore((s) => s.items);
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence>
        {items.map((item) => <SnackbarRow key={item.id} item={item} />)}
      </AnimatePresence>
    </div>
  );
}
