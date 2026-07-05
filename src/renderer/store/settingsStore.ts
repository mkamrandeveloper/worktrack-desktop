import { create } from 'zustand';
import { UserSettings, DEFAULT_SETTINGS } from '@shared/types';

interface SettingsStore {
  settings: UserSettings;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<UserSettings>) => Promise<void>;
  toggleStartup: (enable: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: DEFAULT_SETTINGS,
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true });
    const result = await window.worktrack.settings.get();
    set({ isLoading: false });
    if (result.success && result.data) {
      set({ settings: result.data });
    }
  },

  updateSettings: async (partial: Partial<UserSettings>) => {
    const result = await window.worktrack.settings.update(partial);
    if (result.success && result.data) {
      set({ settings: result.data });
    }
  },

  toggleStartup: async (enable: boolean) => {
    await window.worktrack.settings.toggleStartup(enable);
    set((state) => ({
      settings: { ...state.settings, launchOnStartup: enable },
    }));
  },
}));
