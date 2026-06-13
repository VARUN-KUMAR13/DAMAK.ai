import { create } from 'zustand';
import { JobDetailResponse } from '../lib/api-types';
import { JobsService } from '../lib/services/jobs.service';

interface SessionsState {
  sessions: JobDetailResponse[];
  isLoading: boolean;
  error: string | null;
  
  // Upload State
  isUploading: boolean;
  uploadProgress: number;
  uploadFileName: string | null;
  uploadFileSize: number | null;

  fetchSessions: () => Promise<void>;
  uploadSession: (file: File) => Promise<void>;
  resetUploadState: () => void;
}

export const useSessionsStore = create<SessionsState>((set) => ({
  sessions: [],
  isLoading: false,
  error: null,
  isUploading: false,
  uploadProgress: 0,
  uploadFileName: null,
  uploadFileSize: null,
  
  fetchSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await JobsService.getAllJobs();
      set({ sessions: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  uploadSession: async (file: File) => {
    set({ 
      isUploading: true, 
      uploadProgress: 0, 
      uploadFileName: file.name,
      uploadFileSize: file.size,
      error: null 
    });
    
    try {
      await JobsService.uploadJob(file, (progressEvent) => {
        if (progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          set({ uploadProgress: progress });
        }
      });
      
      // Successfully uploaded
      set({ 
        isUploading: false, 
        uploadProgress: 100 
      });

      // Re-fetch sessions to update dashboard immediately
      const data = await JobsService.getAllJobs();
      set({ sessions: data });
      
    } catch (err: any) {
      set({ 
        isUploading: false, 
        uploadProgress: 0,
        error: err.message 
      });
      // Re-throw so component can catch and show toast if needed
      throw err;
    }
  },

  resetUploadState: () => {
    set({
      isUploading: false,
      uploadProgress: 0,
      uploadFileName: null,
      uploadFileSize: null,
      error: null
    });
  }
}));
