import { apiClient, USE_MOCK_DATA } from '../api-client';
import { ChatRequest, ChatResponse } from '../api-types';
import { MockData } from '../mock-data';

export const TutorService = {
  sendMessage: async (request: ChatRequest): Promise<ChatResponse> => {
    if (USE_MOCK_DATA) {
      await new Promise(r => setTimeout(r, 1500));
      return MockData.chat;
    }
    // Prefix question with V2 Frontend Context if needed
    const response = await apiClient.post<ChatResponse>('/chat', request);
    return response.data;
  }
};
