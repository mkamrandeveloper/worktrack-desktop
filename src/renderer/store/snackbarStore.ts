import { create } from 'zustand';

export interface SnackbarItem {
  id: number;
  message: string;
  detail?: string;
}

interface SnackbarStore {
  items: SnackbarItem[];
  show: (message: string, detail?: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

/** In-app success snackbars (renderer-only; OS notifications use NotificationToast). */
export const useSnackbarStore = create<SnackbarStore>((set) => ({
  items: [],
  show: (message, detail) => {
    const id = nextId++;
    // Keep at most 3 on screen; newest at the bottom.
    set((s) => ({ items: [...s.items.slice(-2), { id, message, detail }] }));
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));
