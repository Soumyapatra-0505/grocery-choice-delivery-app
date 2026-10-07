/**
 * Grocery Choice Delivery App - Reliable Storage Wrapper
 * Supports AsyncStorage with an in-memory Map fallback for headless/test environments.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONFIG } from '@/constants/config';
import { User } from '@/types';

// In-memory fallback dictionary for test or unsupported native environments
const memoryFallback = new Map<string, string>();

export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const val = await AsyncStorage.getItem(key);
      if (val !== null) {
        return val;
      }
      return memoryFallback.get(key) || null;
    } catch {
      return memoryFallback.get(key) || null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    memoryFallback.set(key, value);
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // Memory fallback is already populated
    }
  },

  async removeItem(key: string): Promise<void> {
    memoryFallback.delete(key);
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Memory fallback is already cleared
    }
  },

  async clear(): Promise<void> {
    memoryFallback.clear();
    try {
      await AsyncStorage.clear();
    } catch {
      // Handled
    }
  },
};

// Strongly-typed session convenience helpers
export const storageService = {
  // Auth Token
  getAuthToken: () => storage.getItem(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN),
  setAuthToken: (token: string) => storage.setItem(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN, token),
  removeAuthToken: () => storage.removeItem(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN),

  // User Profile
  getUserProfile: async (): Promise<User | null> => {
    const raw = await storage.getItem(APP_CONFIG.STORAGE_KEYS.USER_PROFILE);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },
  setUserProfile: (user: User) =>
    storage.setItem(APP_CONFIG.STORAGE_KEYS.USER_PROFILE, JSON.stringify(user)),
  removeUserProfile: () => storage.removeItem(APP_CONFIG.STORAGE_KEYS.USER_PROFILE),

  // Remembered Identifier
  getRememberedIdentifier: () => storage.getItem(APP_CONFIG.STORAGE_KEYS.REMEMBER_IDENTIFIER),
  setRememberedIdentifier: (id: string) =>
    storage.setItem(APP_CONFIG.STORAGE_KEYS.REMEMBER_IDENTIFIER, id),
  removeRememberedIdentifier: () =>
    storage.removeItem(APP_CONFIG.STORAGE_KEYS.REMEMBER_IDENTIFIER),

  // Clear Session
  clearSession: async () => {
    await Promise.all([
      storage.removeItem(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN),
      storage.removeItem(APP_CONFIG.STORAGE_KEYS.USER_PROFILE),
    ]);
  },
};
