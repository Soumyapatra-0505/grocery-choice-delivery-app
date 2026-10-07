/**
 * Grocery Choice Delivery App - Authentication API Service
 * Interacts with backend auth endpoints for login, OTP verification, and session hydration.
 */

import apiClient from './client';
import { AuthResponse, SendOtpResponse, User } from '@/types';

export const authApi = {
  /**
   * Password Authentication
   * Backend endpoint: POST /api/auth/owner/login
   * Backend permits DELIVERY, OWNER, ADMIN, STAFF roles through this portal.
   */
  async loginWithPassword(identifier: string, password?: string): Promise<AuthResponse> {
    return apiClient.post<any, AuthResponse>('/auth/owner/login', {
      identifier: identifier.trim(),
      password: password || '',
    });
  },

  /**
   * Send 6-digit OTP
   * Backend endpoint: POST /api/auth/owner/send-otp
   */
  async sendOtp(identifier: string): Promise<SendOtpResponse> {
    return apiClient.post<any, SendOtpResponse>('/auth/owner/send-otp', {
      identifier: identifier.trim(),
    });
  },

  /**
   * Verify 6-digit OTP and Authenticate
   * Backend endpoint: POST /api/auth/owner/verify-otp
   */
  async verifyOtpAndLogin(identifier: string, otp: string): Promise<AuthResponse> {
    return apiClient.post<any, AuthResponse>('/auth/owner/verify-otp', {
      identifier: identifier.trim(),
      otp: otp.trim(),
    });
  },

  /**
   * Hydrate / Verify Authenticated Session
   * Backend endpoint: GET /api/auth/me
   */
  async getMe(): Promise<User> {
    return apiClient.get<any, User>('/auth/me');
  },
};
