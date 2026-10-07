/**
 * Grocery Choice Delivery App - Centralized Axios Client
 * Automatically attaches stored Delivery Bearer JWT token to outbound requests.
 */

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { storageService } from '@/storage/storage';
import { APP_CONFIG } from '@/constants/config';

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const apiClient: AxiosInstance = axios.create({
  baseURL: APP_CONFIG.API_BASE_URL,
  timeout: APP_CONFIG.REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request Interceptor: Attach stored Delivery JWT token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await storageService.getAuthToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Memory fallback handles retrieval errors safely
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Parse response data & transform errors
apiClient.interceptors.response.use(
  (response) => response.data,
  (error: AxiosError) => {
    let message = 'An unexpected server error occurred.';
    let status = 500;
    let data: any = null;

    if (error.response) {
      status = error.response.status;
      data = error.response.data;

      if (typeof data === 'object' && data !== null) {
        message = (data as any).message || (data as any).error || `Server responded with status ${status}`;
      } else if (typeof data === 'string' && data.length > 0) {
        message = data;
      }
    } else if (error.code === 'ECONNABORTED' || (error.message && error.message.includes('timeout'))) {
      status = 408;
      message = 'Request timed out. Please check your internet connection.';
    } else if (error.request) {
      status = 0;
      message = 'Unable to connect to Grocery Choice server. Please verify your connection.';
    }

    return Promise.reject(new ApiError(message, status, data));
  }
);

export default apiClient;
