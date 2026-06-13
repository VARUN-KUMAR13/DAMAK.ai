import { apiClient, USE_MOCK_DATA } from '../api-client';
import { NotesRequest, NotesResponse, NotesMode } from '../api-types';
import { MockData } from '../mock-data';

export const NotesService = {
  generateNotes: async (jobId: string, mode: NotesMode = "standard"): Promise<NotesResponse> => {
    if (USE_MOCK_DATA) {
      await new Promise(r => setTimeout(r, 2000));
      return MockData.notes;
    }
    const request: NotesRequest = { session_id: jobId, mode };
    const response = await apiClient.post<NotesResponse>('/intelligence/notes/generate', request);
    return response.data;
  }
};
