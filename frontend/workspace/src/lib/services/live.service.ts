import { apiClient, USE_MOCK_DATA } from '../api-client';
import { LiveSessionCreate, LiveSessionDetail } from '../api-types';
import { MockData } from '../mock-data';

export const LiveService = {
  startSession: async (title: string): Promise<LiveSessionDetail> => {
    if (USE_MOCK_DATA) {
      await new Promise(r => setTimeout(r, 500));
      return MockData.liveSessionStart;
    }
    const request: LiveSessionCreate = { title };
    const response = await apiClient.post<LiveSessionDetail>('/live/start', request);
    return response.data;
  },

  stopSession: async (sessionId: string): Promise<LiveSessionDetail> => {
    if (USE_MOCK_DATA) {
      await new Promise(r => setTimeout(r, 500));
      return MockData.liveSessionStop;
    }
    const response = await apiClient.post<LiveSessionDetail>(`/live/${sessionId}/stop`);
    return response.data;
  },

  getSession: async (sessionId: string): Promise<LiveSessionDetail> => {
    if (USE_MOCK_DATA) {
      await new Promise(r => setTimeout(r, 500));
      return MockData.liveSessionStop;
    }
    const response = await apiClient.get<LiveSessionDetail>(`/live/${sessionId}`);
    return response.data;
  },

  uploadAudio: async (sessionId: string, file: File): Promise<{ status: string }> => {
    if (USE_MOCK_DATA) return { status: "ok" };
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<{ status: string }>(`/live/${sessionId}/upload-audio`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  
  uploadScreenshot: async (sessionId: string, file: File, timestamp: number): Promise<{ status: string, saved: boolean }> => {
    if (USE_MOCK_DATA) return { status: "ok", saved: true };
    const formData = new FormData();
    formData.append('file', file);
    formData.append('timestamp', timestamp.toString());
    const response = await apiClient.post<{ status: string, saved: boolean }>(`/live/${sessionId}/upload-screenshot`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }
};
