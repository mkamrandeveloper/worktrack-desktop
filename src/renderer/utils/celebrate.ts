import confettiLib from 'canvas-confetti';
import { useSnackbarStore } from '../store/snackbarStore';

// Own full-window instance with the worker off: the default instance draws in
// a blob: Web Worker, which the packaged app's Content-Security-Policy blocks.
const confetti = confettiLib.create(undefined, { resize: true, useWorker: false });

// Brand teal first, then festive accents.
const COLORS = ['#00685f', '#6bd8cb', '#34d399', '#fbbf24', '#60a5fa', '#f472b6', '#a78bfa'];

/**
 * Success moment: a snackbar plus a burst of confetti ("sprinkles") from both
 * sides of the window. Confetti is skipped for users who prefer reduced motion.
 */
export function celebrate(message: string, detail?: string): void {
  useSnackbarStore.getState().show(message, detail);

  const base = {
    particleCount: 70,
    spread: 70,
    startVelocity: 55,
    ticks: 220,
    colors: COLORS,
    zIndex: 150, // above modals (z-50), below the snackbar (z-200)
    disableForReducedMotion: true,
  };
  confetti({ ...base, angle: 60, origin: { x: 0, y: 0.75 } });
  confetti({ ...base, angle: 120, origin: { x: 1, y: 0.75 } });
  // A softer second wave from the top centre.
  setTimeout(() => confetti({ ...base, particleCount: 50, spread: 110, startVelocity: 35, origin: { x: 0.5, y: 0.25 } }), 250);
}
