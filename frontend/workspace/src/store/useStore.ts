import { create } from 'zustand';

interface StoreState {
  currentSessionId: string | null;
  currentLiveSessionId: string | null;
  sessions: any[];
  liveSessions: any[];
  currentTranscript: any[];
  currentScreenshots: any[];
  currentNotes: string | null;
  highlightedTimestamp: number | null;
  
  setCurrentSession: (id: string | null) => void;
  setCurrentLiveSession: (id: string | null) => void;
  setSessions: (sessions: any[]) => void;
  setLiveSessions: (sessions: any[]) => void;
  addSession: (session: any) => void;
  addLiveSession: (session: any) => void;
  removeSession: (id: string) => void;
  removeLiveSession: (id: string) => void;
  setTranscript: (transcript: any[]) => void;
  setScreenshots: (screenshots: any[]) => void;
  setNotes: (notes: string | null) => void;
  setHighlightedTimestamp: (timestamp: number | null) => void;
}

export const useStore = create<StoreState>((set) => ({
  currentSessionId: null,
  currentLiveSessionId: null,
  sessions: [],
  liveSessions: [],
  currentTranscript: [],
  currentScreenshots: [],
  currentNotes: null,
  highlightedTimestamp: null,

  setCurrentSession: (id) => set({ 
    currentSessionId: id, 
    currentLiveSessionId: null,
    currentNotes: null, 
    currentTranscript: [], 
    currentScreenshots: [],
    highlightedTimestamp: null 
  }),
  setCurrentLiveSession: (id) => set({
    currentLiveSessionId: id,
    currentSessionId: null,
    currentNotes: null,
    currentTranscript: [],
    currentScreenshots: [],
    highlightedTimestamp: null
  }),
  setSessions: (sessions) => set({ sessions }),
  setLiveSessions: (sessions) => set({ liveSessions: sessions }),
  addSession: (session) => set((state) => ({ sessions: [...state.sessions, session] })),
  addLiveSession: (session) => set((state) => ({ liveSessions: [session, ...state.liveSessions] })),
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
  setNotes: (notes) => set({ currentNotes: notes }),
  setHighlightedTimestamp: (timestamp) => set({ highlightedTimestamp: timestamp }),
}));
