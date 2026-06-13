import { create } from 'zustand';
import { NotesResponse, NotesMode } from '../lib/api-types';
import { NotesService } from '../lib/services/notes.service';

interface NotesState {
  currentNotes: NotesResponse | null;
  isLoading: boolean;
  error: string | null;
  generateNotes: (jobId: string, mode?: NotesMode) => Promise<void>;
  clearNotes: () => void;
}

export const useNotesStore = create<NotesState>((set) => ({
  currentNotes: null,
  isLoading: false,
  error: null,

  generateNotes: async (jobId: string, mode: NotesMode = "standard") => {
    set({ isLoading: true, error: null });
    try {
      const data = await NotesService.generateNotes(jobId, mode);
      set({ currentNotes: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  clearNotes: () => set({ currentNotes: null, error: null })
}));
