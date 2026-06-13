import { create } from 'zustand';
import { LiveSessionDetail } from '../lib/api-types';
import { LiveService } from '../lib/services/live.service';
import { useSessionsStore } from './sessions.store';

interface ChunkTask {
  id: string;
  file: File;
  type: 'audio' | 'screenshot';
  timestamp?: number;
  retries: number;
}

export type LiveCaptureState = "idle" | "starting" | "recording" | "stopping" | "processing" | "completed" | "failed";

interface LiveState {
  activeSession: LiveSessionDetail | null;
  captureState: LiveCaptureState;
  error: string | null;
  elapsedSeconds: number;
  
  // Chunk Queue
  chunkQueue: ChunkTask[];
  isUploadingChunk: boolean;

  // Actions
  startSession: (title: string) => Promise<void>;
  stopSession: () => Promise<void>;
  enqueueChunk: (task: Omit<ChunkTask, 'id' | 'retries'>) => void;
  incrementTimer: () => void;
  reset: () => void;
  pollProcessing: () => Promise<void>;
  _processQueue: () => Promise<void>;
}

export const useLiveStore = create<LiveState>((set, get) => ({
  activeSession: null,
  captureState: "idle",
  error: null,
  elapsedSeconds: 0,
  
  chunkQueue: [],
  isUploadingChunk: false,

  incrementTimer: () => {
    set(state => ({ elapsedSeconds: state.elapsedSeconds + 1 }));
  },

  reset: () => {
    set({
      activeSession: null,
      captureState: "idle",
      error: null,
      elapsedSeconds: 0,
      chunkQueue: [],
      isUploadingChunk: false
    });
  },

  startSession: async (title: string) => {
    set({ captureState: "starting", error: null, elapsedSeconds: 0, chunkQueue: [] });
    try {
      const data = await LiveService.startSession(title);
      set({ activeSession: data, captureState: "recording" });
    } catch (err: any) {
      set({ error: err.message || "Failed to start live session.", captureState: "idle" });
    }
  },

  enqueueChunk: (task) => {
    const newTask: ChunkTask = { ...task, id: Date.now().toString() + Math.random(), retries: 0 };
    set(state => ({ chunkQueue: [...state.chunkQueue, newTask] }));
    
    // Trigger queue processor if not running
    get()._processQueue();
  },

  _processQueue: async () => {
    const state = get();
    if (state.isUploadingChunk || state.chunkQueue.length === 0 || !state.activeSession) return;

    const task = state.chunkQueue[0];
    set({ isUploadingChunk: true });

    try {
      if (task.type === 'audio') {
        await LiveService.uploadAudio(state.activeSession.session_id, task.file);
      } else if (task.type === 'screenshot' && task.timestamp !== undefined) {
        await LiveService.uploadScreenshot(state.activeSession.session_id, task.file, task.timestamp);
      }
      
      // Success, remove from queue
      set(s => ({ 
        chunkQueue: s.chunkQueue.filter(t => t.id !== task.id),
        isUploadingChunk: false
      }));
      
      // Continue processing
      setTimeout(() => get()._processQueue(), 100);
      
    } catch (err) {
      console.error("Chunk upload failed, retrying...", err);
      // Retry logic
      if (task.retries < 3) {
        set(s => ({
          chunkQueue: s.chunkQueue.map(t => t.id === task.id ? { ...t, retries: t.retries + 1 } : t),
          isUploadingChunk: false
        }));
        setTimeout(() => get()._processQueue(), 2000); // Wait 2s before retry
      } else {
        // Drop chunk after 3 failures to prevent halting
        set(s => ({
          chunkQueue: s.chunkQueue.filter(t => t.id !== task.id),
          isUploadingChunk: false,
          error: "A data chunk failed to upload due to network instability."
        }));
        setTimeout(() => get()._processQueue(), 100);
      }
    }
  },

  stopSession: async () => {
    const { activeSession, chunkQueue } = get();
    if (!activeSession) return;

    set({ captureState: "stopping" });

    // Wait for queue to flush before sending stop
    const flushQueue = async () => {
      while (get().chunkQueue.length > 0 || get().isUploadingChunk) {
        await new Promise(r => setTimeout(r, 500));
      }
    };

    try {
      await flushQueue();
      const stoppedData = await LiveService.stopSession(activeSession.session_id);
      set({ activeSession: stoppedData, captureState: "processing" });
      
      // Start polling
      get().pollProcessing();
      
    } catch (err: any) {
      set({ error: err.message || "Failed to stop session.", captureState: "recording" }); // Revert so user can try again
    }
  },

  pollProcessing: async () => {
    const { activeSession } = get();
    if (!activeSession) return;

    try {
      const data = await LiveService.getSession(activeSession.session_id);
      set({ activeSession: data });

      if (data.status === 'completed') {
        set({ captureState: "completed" });
        // Refresh dashboard sessions immediately
        useSessionsStore.getState().fetchSessions();
      } else if (data.status === 'failed') {
        set({ captureState: "failed", error: data.error_message || "Backend processing failed." });
      } else {
        // Still processing, poll again
        setTimeout(() => get().pollProcessing(), 3000);
      }
    } catch (err: any) {
      // Continue polling on transient errors
      setTimeout(() => get().pollProcessing(), 5000);
    }
  }
}));
