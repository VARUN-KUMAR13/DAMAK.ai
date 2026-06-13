import { apiClient, USE_MOCK_DATA } from '../api-client';
import { JobDetailResponse, JobCreateResponse } from '../api-types';
import { MockData } from '../mock-data';

export const JobsService = {
  getAllJobs: async (): Promise<JobDetailResponse[]> => {
    if (USE_MOCK_DATA) {
      await new Promise(r => setTimeout(r, 500));
      return MockData.jobs;
    }
    const response = await apiClient.get<JobDetailResponse[]>('/jobs');
    return response.data;
  },

  getJob: async (jobId: string): Promise<JobDetailResponse> => {
    if (USE_MOCK_DATA) {
      await new Promise(r => setTimeout(r, 300));
      return MockData.jobs.find(j => j.job_id === jobId) || MockData.jobs[0];
    }
    const response = await apiClient.get<JobDetailResponse>(`/jobs/${jobId}`);
    return response.data;
  },

  uploadJob: async (file: File, onUploadProgress?: (progressEvent: any) => void): Promise<JobCreateResponse> => {
    if (USE_MOCK_DATA) {
      if (onUploadProgress) {
        // Simulate upload progress
        for (let i = 1; i <= 10; i++) {
          await new Promise(r => setTimeout(r, 150));
          onUploadProgress({ loaded: i * 10, total: 100 });
        }
      } else {
        await new Promise(r => setTimeout(r, 1500));
      }
      return MockData.uploadJob;
    }
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<JobCreateResponse>('/jobs', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress
    });
    return response.data;
  }
};
