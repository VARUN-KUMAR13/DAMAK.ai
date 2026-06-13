import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

// Feature Flag for Mock Backend
export const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'false';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5 min timeout for large file uploads / LLM generation
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add auth token here in the future
    // const token = localStorage.getItem('token');
    // if (token) config.headers.Authorization = `Bearer ${token}`;

    if (process.env.NODE_ENV === 'development') {
      console.log(`🚀 [API Request] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ [API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, response.status);
    }
    return response;
  },
  (error: AxiosError) => {
    let errorMessage = "An unexpected error occurred.";

    if (error.response) {
      // The request was made and the server responded with a status code
      // Extract FastAPI detail array or string
      const data = error.response.data as any;
      if (data?.detail) {
        if (typeof data.detail === 'string') {
          errorMessage = data.detail;
        } else if (Array.isArray(data.detail)) {
          errorMessage = data.detail.map((err: any) => err.msg).join(', ');
        }
      } else {
        errorMessage = `Server Error: ${error.response.status}`;
      }
    } else if (error.request) {
      // The request was made but no response was received
      errorMessage = "Network error. Please check your connection to the server.";
    } else {
      // Something happened in setting up the request
      errorMessage = error.message;
    }

    if (process.env.NODE_ENV === 'development') {
      console.error(`❌ [API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url}:`, errorMessage);
    }

    // Attach friendly message to the error object so services can easily throw it
    const enhancedError = new Error(errorMessage);
    (enhancedError as any).status = error.response?.status;
    (enhancedError as any).originalError = error;

    return Promise.reject(enhancedError);
  }
);
