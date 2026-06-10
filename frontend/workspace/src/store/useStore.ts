import { create } from 'zustand';

interface StoreState {
  currentSessionId: string | null;
  currentLiveSessionId: string | null;
  currentLiveMeetingId: string | null;
  uploadingFile: string | null;
  sessions: any[];
  liveSessions: any[];
  liveMeetings: any[];
  currentTranscript: any[];
  currentScreenshots: any[];
  currentNotes: string | null;
  currentNotesKeyConcepts: string[];
  currentNotesCitations: any[];
  highlightedTimestamp: number | null;
  meetingTranscript: any[];
  
  setCurrentSession: (id: string | null) => void;
  setCurrentLiveSession: (id: string | null) => void;
  setCurrentLiveMeeting: (id: string | null) => void;
  setSessions: (sessions: any[]) => void;
  setLiveSessions: (sessions: any[]) => void;
  setLiveMeetings: (meetings: any[]) => void;
  setUploadingFile: (filename: string | null) => void;
  addSession: (session: any) => void;
  addLiveSession: (session: any) => void;
  addLiveMeeting: (meeting: any) => void;
  removeSession: (id: string) => void;
  removeLiveSession: (id: string) => void;
  removeLiveMeeting: (id: string) => void;
  setTranscript: (transcript: any[]) => void;
  setScreenshots: (screenshots: any[]) => void;
  setNotes: (notes: string | null, keyConcepts?: string[], citations?: any[]) => void;
  setHighlightedTimestamp: (timestamp: number | null) => void;
  setMeetingTranscript: (transcript: any[]) => void;
  addMeetingTranscriptChunk: (chunk: any) => void;
}

export const useStore = create<StoreState>((set) => ({
  currentSessionId: null,
  currentLiveSessionId: null,
  currentLiveMeetingId: null,
  uploadingFile: null,
  sessions: [],
  liveSessions: [],
  liveMeetings: [],
  currentTranscript: [],
  currentScreenshots: [],
  currentNotes: null,
  currentNotesKeyConcepts: [],
  currentNotesCitations: [],
  highlightedTimestamp: null,
  meetingTranscript: [],

  setCurrentSession: (id) => set({ 
    currentSessionId: id, 
    currentLiveSessionId: null,
    currentLiveMeetingId: null,
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
    currentLiveMeetingId: null,
    currentNotes: null,
    currentNotesKeyConcepts: [],
    currentNotesCitations: [],
    currentTranscript: [],
    currentScreenshots: [],
    highlightedTimestamp: null
  }),
  setCurrentLiveMeeting: (id) => set({
    currentLiveMeetingId: id,
    currentSessionId: null,
    currentLiveSessionId: null,
    currentNotes: null,
    currentNotesKeyConcepts: [],
    currentNotesCitations: [],
    currentTranscript: [],
    currentScreenshots: [],
    highlightedTimestamp: null,
    meetingTranscript: []
  }),
  setSessions: (sessions) => set({ sessions }),
  setLiveSessions: (sessions) => set({ liveSessions: sessions }),
  setLiveMeetings: (meetings) => set({ liveMeetings: meetings }),
  setUploadingFile: (filename) => set({ uploadingFile: filename }),
  addSession: (session) => set((state) => {
    const exists = state.sessions.some(s => (s.job_id || s.id) === (session.job_id || session.id));
    return exists ? state : { sessions: [...state.sessions, session] };
  }),
  addLiveSession: (session) => set((state) => {
    const exists = state.liveSessions.some(s => (s.session_id || s.id) === (session.session_id || session.id));
    return exists ? state : { liveSessions: [session, ...state.liveSessions] };
  }),
  addLiveMeeting: (meeting) => set((state) => {
    const exists = state.liveMeetings.some(m => (m.session_id || m.id) === (meeting.session_id || meeting.id));
    return exists ? state : { liveMeetings: [meeting, ...state.liveMeetings] };
  }),
  removeSession: (id) => set((state) => ({ 
    sessions: state.sessions.filter(s => (s.job_id || s.id) !== id),
    currentSessionId: state.currentSessionId === id ? null : state.currentSessionId
  })),
  removeLiveSession: (id) => set((state) => ({
    liveSessions: state.liveSessions.filter(s => (s.session_id || s.id) !== id),
    currentLiveSessionId: state.currentLiveSessionId === id ? null : state.currentLiveSessionId
  })),
  removeLiveMeeting: (id) => set((state) => ({
    liveMeetings: state.liveMeetings.filter(m => (m.session_id || m.id) !== id),
    currentLiveMeetingId: state.currentLiveMeetingId === id ? null : state.currentLiveMeetingId
  })),
  setTranscript: (transcript) => set({ currentTranscript: transcript }),
  setScreenshots: (screenshots) => set({ currentScreenshots: screenshots }),
  setNotes: (notes, keyConcepts = [], citations = []) => set({ 
    currentNotes: notes,
    currentNotesKeyConcepts: keyConcepts,
    currentNotesCitations: citations
  }),
  setHighlightedTimestamp: (timestamp) => set({ highlightedTimestamp: timestamp }),
  setMeetingTranscript: (transcript) => set({ meetingTranscript: transcript }),
  addMeetingTranscriptChunk: (chunk) => set((state) => ({
    meetingTranscript: [...state.meetingTranscript, chunk]
  })),
}));
