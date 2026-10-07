/**
 * Grocery Choice Delivery App - Global Configuration & Constants
 */

declare const process: any;

export const APP_CONFIG = {
  APP_NAME: 'Grocery Choice Delivery',
  TAGLINE: 'Rider Partner Portal',
  APP_VERSION: '1.0.0',

  // Backend API Base URL (defaults to production Railway backend, overridable locally)
  API_BASE_URL:
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_BASE_URL) ||
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
    'https://grocery-choice-backend-production.up.railway.app/api',

  // Dedicated Delivery App Storage Keys
  STORAGE_KEYS: {
    AUTH_TOKEN: 'grocery_choice_delivery_auth_token',
    USER_PROFILE: 'grocery_choice_delivery_auth_profile',
    REMEMBER_IDENTIFIER: 'grocery_choice_delivery_remember_id',
  },

  // Role Security Boundary: Delivery App ONLY accepts DELIVERY role
  ALLOWED_ROLE: 'DELIVERY' as const,

  // Thresholds & Defaults
  OTP_LENGTH: 6,
  OTP_RESEND_COOLDOWN_SECONDS: 60,
  REQUEST_TIMEOUT_MS: 15000,
};
