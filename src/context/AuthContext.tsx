/**
 * Grocery Choice Delivery App - Authentication Context
 * Manages Rider JWT authentication, session hydration, and strict DELIVERY role validation.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storageService } from '@/storage/storage';
import { APP_CONFIG } from '@/constants/config';
import { authApi } from '@/api/authApi';
import { User, AuthResponse, SendOtpResponse } from '@/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  loginWithPassword: (identifier: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  sendOtp: (identifier: string) => Promise<SendOtpResponse>;
  verifyOtpAndLogin: (identifier: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Strictly checks whether the user possesses the DELIVERY role
  const isDeliveryRole = (candidate: User | null | undefined): boolean => {
    if (!candidate || !candidate.role) return false;
    return candidate.role === APP_CONFIG.ALLOWED_ROLE;
  };

  // Perform clean local logout
  const logout = useCallback(async () => {
    try {
      await storageService.clearSession();
    } catch (e) {
      console.warn('Error clearing delivery session storage', e);
    } finally {
      setUser(null);
    }
  }, []);

  // Save session upon successful authentication and role verification
  const saveSession = async (token: string, candidateUser: User) => {
    if (!isDeliveryRole(candidateUser)) {
      await logout();
      throw new Error('This account is not authorized for the Delivery App.');
    }

    await storageService.setAuthToken(token);
    await storageService.setUserProfile(candidateUser);
    setUser(candidateUser);
    setAuthError(null);
  };

  // Startup Session Hydration: Checks stored token, verifies role, validates via GET /api/auth/me
  const hydrateSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const storedToken = await storageService.getAuthToken();
      const storedProfile = await storageService.getUserProfile();

      if (!storedToken) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      // Fast initial render from cached profile if valid role
      if (storedProfile) {
        if (isDeliveryRole(storedProfile)) {
          setUser(storedProfile);
        } else {
          await logout();
          setAuthError('This account is not authorized for the Delivery App.');
          setIsLoading(false);
          return;
        }
      }

      // Live verification with backend: GET /api/auth/me
      try {
        const liveUser = await authApi.getMe();
        if (liveUser && isDeliveryRole(liveUser)) {
          setUser(liveUser);
          await storageService.setUserProfile(liveUser);
        } else {
          // Wrong role (CUSTOMER, STAFF, ADMIN, OWNER) -> Clear session immediately
          await logout();
          setAuthError('This account is not authorized for the Delivery App.');
        }
      } catch (apiErr: any) {
        // If explicitly 401 or 403, clear token and return to login
        if (apiErr?.status === 401 || apiErr?.status === 403) {
          await logout();
        } else {
          // Temporary network failure: retain cached profile if previously validated
          console.debug('Network notice during delivery session hydration:', apiErr?.message);
        }
      }
    } catch (err) {
      console.error('Failed to restore delivery session', err);
      await logout();
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  // Method 1: Password Login
  const loginWithPassword = async (identifier: string, password?: string) => {
    setAuthError(null);
    try {
      const response: AuthResponse = await authApi.loginWithPassword(identifier, password);
      if (response && response.token && response.user) {
        if (!isDeliveryRole(response.user)) {
          await logout();
          const err = 'This account is not authorized for the Delivery App.';
          setAuthError(err);
          return { success: false, error: err };
        }
        await saveSession(response.token, response.user);
        return { success: true };
      }
      const err = response?.message || 'Authentication failed';
      setAuthError(err);
      return { success: false, error: err };
    } catch (err: any) {
      const errMsg = err?.message || 'Invalid credentials or server unavailable.';
      setAuthError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  // Method 2: Send OTP
  const sendOtp = async (identifier: string): Promise<SendOtpResponse> => {
    setAuthError(null);
    return authApi.sendOtp(identifier);
  };

  // Method 2: Verify OTP and Login
  const verifyOtpAndLogin = async (identifier: string, otp: string) => {
    setAuthError(null);
    try {
      const response: AuthResponse = await authApi.verifyOtpAndLogin(identifier, otp);
      if (response && response.token && response.user) {
        if (!isDeliveryRole(response.user)) {
          await logout();
          const err = 'This account is not authorized for the Delivery App.';
          setAuthError(err);
          return { success: false, error: err };
        }
        await saveSession(response.token, response.user);
        return { success: true };
      }
      const err = response?.message || 'OTP verification failed';
      setAuthError(err);
      return { success: false, error: err };
    } catch (err: any) {
      const errMsg = err?.message || 'Invalid OTP code or expired session.';
      setAuthError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  // Refresh profile on demand
  const refreshProfile = async () => {
    try {
      const liveUser = await authApi.getMe();
      if (liveUser && isDeliveryRole(liveUser)) {
        setUser(liveUser);
        await storageService.setUserProfile(liveUser);
      } else {
        await logout();
        setAuthError('This account is not authorized for the Delivery App.');
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.status === 403) {
        await logout();
      }
    }
  };

  const clearAuthError = () => setAuthError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && isDeliveryRole(user),
        isLoading,
        authError,
        loginWithPassword,
        sendOtp,
        verifyOtpAndLogin,
        logout,
        refreshProfile,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
