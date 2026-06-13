import { create } from 'zustand';

interface StoreState {
  currentSessionId: string | null;
  currentLiveSessionId: string | null;
  uploadingFile: string | null;
  sessions: any[];
  liveSessions: any[];
  currentTranscript: any[];
  currentScreenshots: any[];
  currentNotes: string | null;
  currentNotesKeyConcepts: string[];
  currentNotesCitations: any[];
  highlightedTimestamp: number | null;
  
  setCurrentSession: (id: string | null) => void;
  setCurrentLiveSession: (id: string | null) => void;
  setSessions: (sessions: any[]) => void;
  setLiveSessions: (sessions: any[]) => void;
  setUploadingFile: (filename: string | null) => void;
  addSession: (session: any) => void;
  addLiveSession: (session: any) => void;
  removeSession: (id: string) => void;
  removeLiveSession: (id: string) => void;
  setTranscript: (transcript: any[]) => void;
  setScreenshots: (screenshots: any[]) => void;
  setNotes: (notes: string | null, keyConcepts?: string[], citations?: any[]) => void;
  setHighlightedTimestamp: (timestamp: number | null) => void;
}

export const useStore = create<StoreState>((set) => ({
  currentSessionId: null,
  currentLiveSessionId: null,
  uploadingFile: null,
  sessions: [],
  liveSessions: [],
  currentTranscript: [],
  currentScreenshots: [],
  currentNotes: null,
  currentNotesKeyConcepts: [],
  currentNotesCitations: [],
  highlightedTimestamp: null,

  setCurrentSession: (id) => set({ 
    currentSessionId: id, 
    currentLiveSessionId: null,
    currentNotes: null,
    currentNotesKeyConcepts: [],
    currentNotesCitations: [],
    currentTranscript: [], 
    currentScreenshots: [],
    highlightedTimestamp: null 
  }),
  setCurrentLiveSession: (id) => set({
    currentLiveSessionId: id,
    currentSessionId: null,
    currentNotes: null,
    currentNotesKeyConcepts: [],
    currentNotesCitations: [],
    currentTranscript: [],
    currentScreenshots: [],
    highlightedTimestamp: null
  }),
  setSessions: (sessions) => set({ sessions }),
  setLiveSessions: (sessions) => set({ liveSessions: sessions }),
  setUploadingFile: (filename) => set({ uploadingFile: filename }),
  addSession: (session) => set((state) => {
    const exists = state.sessions.some(s => (s.job_id || s.id) === (session.job_id || session.id));
    return exists ? state : { sessions: [...state.sessions, session] };
  }),
  addLiveSession: (session) => set((state) => {
    const exists = state.liveSessions.some(s => (s.session_id || s.id) === (session.session_id || session.id));
    return exists ? state : { liveSessions: [session, ...state.liveSessions] };
  }),
  removeSession: (id) => set((state) => ({ 
    sessions: state.sessions.filter(s => (s.job_id || s.id) !== id),
    currentSessionId: state.currentSessionId === id ? null : state.currentSessionId
  })),
  removeLiveSession: (id) => set((state) => ({
    liveSessions: state.liveSessions.filter(s => (s.session_id || s.id) !== id),
    currentLiveSessionId: state.currentLiveSessionId === id ? null : state.currentLiveSessionId
  })),
  setTranscript: (transcript) => set({ currentTranscript: transcript }),
  setScreenshots: (screenshots) => set({ currentScreenshots: screenshots }),
  setNotes: (notes, keyConcepts = [], citations = []) => set({ 
    currentNotes: notes,
    currentNotesKeyConcepts: keyConcepts,
    currentNotesCitations: citations
  }),
  setHighlightedTimestamp: (timestamp) => set({ highlightedTimestamp: timestamp }),
}));
