import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// --- Domain & Helper Implementations Tested Headlessly ---

const ALLOWED_ROLE = 'DELIVERY';

function isDeliveryRole(candidate) {
  if (!candidate || !candidate.role) return false;
  return candidate.role === ALLOWED_ROLE;
}

function validateIdentifier(input) {
  if (!input || !input.trim()) {
    return { isValid: false, type: null, error: 'Please enter your mobile number or email' };
  }
  const trimmed = input.trim();
  if (trimmed.includes('@')) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return { isValid: false, type: 'email', error: 'Please enter a valid email address' };
    }
    return { isValid: true, type: 'email', normalized: trimmed.toLowerCase(), error: null };
  }
  const digits = trimmed.replace(/\D/g, '');
  const is10Digit = digits.length === 10 && /^[6-9]\d{9}$/.test(digits);
  const is11Digit = digits.length === 11 && digits.startsWith('0') && /^[6-9]\d{9}$/.test(digits.slice(1));
  const is12Digit = digits.length === 12 && digits.startsWith('91') && /^[6-9]\d{9}$/.test(digits.slice(2));

  if (is10Digit || is11Digit || is12Digit) {
    const normalizedMobile = is10Digit ? digits : is11Digit ? digits.slice(1) : digits.slice(2);
    return { isValid: true, type: 'mobile', normalized: normalizedMobile, error: null };
  }
  return {
    isValid: false,
    type: 'mobile',
    error: 'Please enter a valid 10-digit mobile number (e.g. 9876543210)',
  };
}

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Simulated session store
class MockAuthSessionManager {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.storage = new Map();
    this.user = null;
    this.authError = null;
  }

  async setToken(token) {
    this.storage.set('grocery_choice_delivery_auth_token', token);
  }

  async getToken() {
    return this.storage.get('grocery_choice_delivery_auth_token') || null;
  }

  async setUserProfile(profile) {
    this.storage.set('grocery_choice_delivery_auth_profile', JSON.stringify(profile));
    this.user = profile;
  }

  async getUserProfile() {
    const raw = this.storage.get('grocery_choice_delivery_auth_profile');
    return raw ? JSON.parse(raw) : null;
  }

  async logout() {
    this.storage.delete('grocery_choice_delivery_auth_token');
    this.storage.delete('grocery_choice_delivery_auth_profile');
    this.user = null;
    this.authError = null;
  }

  async loginWithPassword(identifier, password) {
    this.authError = null;
    try {
      const response = await this.apiClient.loginWithPassword(identifier, password);
      if (response && response.token && response.user) {
        if (!isDeliveryRole(response.user)) {
          await this.logout();
          this.authError = 'This account is not authorized for the Delivery App.';
          return { success: false, error: this.authError };
        }
        await this.setToken(response.token);
        await this.setUserProfile(response.user);
        return { success: true };
      }
      this.authError = response?.message || 'Authentication failed';
      return { success: false, error: this.authError };
    } catch (err) {
      this.authError = err?.message || 'Invalid credentials or server unavailable.';
      return { success: false, error: this.authError };
    }
  }

  async sendOtp(identifier) {
    this.authError = null;
    return this.apiClient.sendOtp(identifier);
  }

  async verifyOtpAndLogin(identifier, otp) {
    this.authError = null;
    try {
      const response = await this.apiClient.verifyOtpAndLogin(identifier, otp);
      if (response && response.token && response.user) {
        if (!isDeliveryRole(response.user)) {
          await this.logout();
          this.authError = 'This account is not authorized for the Delivery App.';
          return { success: false, error: this.authError };
        }
        await this.setToken(response.token);
        await this.setUserProfile(response.user);
        return { success: true };
      }
      this.authError = response?.message || 'OTP verification failed';
      return { success: false, error: this.authError };
    } catch (err) {
      this.authError = err?.message || 'Invalid OTP code or expired session.';
      return { success: false, error: this.authError };
    }
  }

  async hydrateSession() {
    const token = await this.getToken();
    if (!token) {
      this.user = null;
      return;
    }

    const cached = await this.getUserProfile();
    if (cached) {
      if (isDeliveryRole(cached)) {
        this.user = cached;
      } else {
        await this.logout();
        this.authError = 'This account is not authorized for the Delivery App.';
        return;
      }
    }

    try {
      const liveUser = await this.apiClient.getMe(token);
      if (liveUser && isDeliveryRole(liveUser)) {
        this.user = liveUser;
        await this.setUserProfile(liveUser);
      } else {
        await this.logout();
        this.authError = 'This account is not authorized for the Delivery App.';
      }
    } catch (err) {
      if (err?.status === 401 || err?.status === 403) {
        await this.logout();
      }
    }
  }
}

// --- Test Suites ---

describe('Phase 1: Delivery App Authentication & Role Security', () => {
  // Test 1: Storage Set, Get, Remove
  test('1. Storage wrapper correctly sets, gets, and removes values', async () => {
    const session = new MockAuthSessionManager({});
    await session.setToken('sample_token_xyz');
    assert.equal(await session.getToken(), 'sample_token_xyz');
    await session.logout();
    assert.equal(await session.getToken(), null);
  });

  // Test 2: Successful Password Authentication
  test('2. Successful password login with DELIVERY role authenticates session', async () => {
    const mockApiClient = {
      async loginWithPassword(identifier, password) {
        return {
          success: true,
          token: 'valid_jwt_delivery_123',
          user: {
            id: 10,
            fullName: 'Ramesh Rider',
            email: 'ramesh@grocerychoice.com',
            phone: '9876543210',
            role: 'DELIVERY',
            status: 'ACTIVE',
            storeHub: 'Koramangala Hub',
          },
        };
      },
    };

    const session = new MockAuthSessionManager(mockApiClient);
    const result = await session.loginWithPassword('ramesh@grocerychoice.com', 'Pass123!');
    assert.equal(result.success, true);
    assert.equal(await session.getToken(), 'valid_jwt_delivery_123');
    assert.equal(session.user?.role, 'DELIVERY');
    assert.equal(session.user?.fullName, 'Ramesh Rider');
    assert.equal(session.authError, null);
  });

  // Test 3: Failed Password Authentication
  test('3. Failed password authentication returns error without crashing', async () => {
    const mockApiClient = {
      async loginWithPassword() {
        throw new ApiError('Invalid owner credentials', 401);
      },
    };

    const session = new MockAuthSessionManager(mockApiClient);
    const result = await session.loginWithPassword('ramesh@grocerychoice.com', 'WrongPassword');
    assert.equal(result.success, false);
    assert.equal(result.error, 'Invalid owner credentials');
    assert.equal(await session.getToken(), null);
    assert.equal(session.user, null);
  });

  // Test 4: OTP Send Flow
  test('4. OTP send flow dispatches request and returns cooldown/expiry metadata', async () => {
    const mockApiClient = {
      async sendOtp(identifier) {
        return {
          success: true,
          message: '6-digit OTP sent to 9876543210',
          target: '9876543210',
          channel: 'mobile',
          expirySeconds: 300,
          resendCooldownSeconds: 60,
        };
      },
    };

    const session = new MockAuthSessionManager(mockApiClient);
    const res = await session.sendOtp('9876543210');
    assert.equal(res.success, true);
    assert.equal(res.expirySeconds, 300);
    assert.equal(res.resendCooldownSeconds, 60);
    assert.equal(res.target, '9876543210');
  });

  // Test 5: OTP Verification Flow
  test('5. OTP verification flow accepts 6-digit OTP and authenticates rider', async () => {
    const mockApiClient = {
      async verifyOtpAndLogin(identifier, otp) {
        if (otp === '123456') {
          return {
            success: true,
            token: 'valid_otp_jwt_456',
            user: {
              id: 11,
              fullName: 'Suresh Delivery',
              email: 'suresh@grocerychoice.com',
              phone: '9876543210',
              role: 'DELIVERY',
              status: 'ACTIVE',
            },
          };
        }
        throw new ApiError('Invalid OTP. 2 attempts remaining.', 400);
      },
    };

    const session = new MockAuthSessionManager(mockApiClient);
    const successRes = await session.verifyOtpAndLogin('9876543210', '123456');
    assert.equal(successRes.success, true);
    assert.equal(await session.getToken(), 'valid_otp_jwt_456');

    // Failed attempt
    const sessionFailed = new MockAuthSessionManager(mockApiClient);
    const failRes = await sessionFailed.verifyOtpAndLogin('9876543210', '000000');
    assert.equal(failRes.success, false);
    assert.match(failRes.error, /Invalid OTP/);
  });

  // Test 6: Session Restoration via /api/auth/me
  test('6. Session restoration validates stored token via /api/auth/me', async () => {
    const mockApiClient = {
      async getMe(token) {
        if (token === 'valid_persisted_token') {
          return {
            id: 10,
            fullName: 'Ramesh Rider',
            role: 'DELIVERY',
            status: 'ACTIVE',
            storeHub: 'Indiranagar Hub',
          };
        }
        throw new ApiError('Unauthorized', 401);
      },
    };

    const session = new MockAuthSessionManager(mockApiClient);
    await session.setToken('valid_persisted_token');
    await session.hydrateSession();

    assert.ok(session.user);
    assert.equal(session.user.role, 'DELIVERY');
    assert.equal(session.user.fullName, 'Ramesh Rider');
  });

  // Test 7: DELIVERY Role Accepted
  test('7. DELIVERY role is strictly recognized and accepted', () => {
    assert.equal(isDeliveryRole({ role: 'DELIVERY' }), true);
  });

  // Test 8: CUSTOMER Role Rejected
  test('8. CUSTOMER role is rejected with exact unauthorized message', async () => {
    const mockApiClient = {
      async loginWithPassword() {
        return {
          success: true,
          token: 'customer_token',
          user: { id: 100, role: 'CUSTOMER', fullName: 'Customer One' },
        };
      },
    };

    const session = new MockAuthSessionManager(mockApiClient);
    const res = await session.loginWithPassword('customer@gmail.com', 'Pass123!');
    assert.equal(res.success, false);
    assert.equal(res.error, 'This account is not authorized for the Delivery App.');
    assert.equal(await session.getToken(), null);
    assert.equal(session.user, null);
  });

  // Test 9: STAFF Role Rejected
  test('9. STAFF role is rejected with unauthorized message', async () => {
    const mockApiClient = {
      async loginWithPassword() {
        return {
          success: true,
          token: 'staff_token',
          user: { id: 101, role: 'STAFF', fullName: 'Staff One' },
        };
      },
    };

    const session = new MockAuthSessionManager(mockApiClient);
    const res = await session.loginWithPassword('staff@grocerychoice.com', 'Pass123!');
    assert.equal(res.success, false);
    assert.equal(res.error, 'This account is not authorized for the Delivery App.');
  });

  // Test 10: ADMIN Role Rejected
  test('10. ADMIN role is rejected with unauthorized message', async () => {
    const mockApiClient = {
      async loginWithPassword() {
        return {
          success: true,
          token: 'admin_token',
          user: { id: 102, role: 'ADMIN', fullName: 'Admin One' },
        };
      },
    };

    const session = new MockAuthSessionManager(mockApiClient);
    const res = await session.loginWithPassword('admin@grocerychoice.com', 'Pass123!');
    assert.equal(res.success, false);
    assert.equal(res.error, 'This account is not authorized for the Delivery App.');
  });

  // Test 11: OWNER Role Rejected
  test('11. OWNER role is rejected with unauthorized message', async () => {
    const mockApiClient = {
      async loginWithPassword() {
        return {
          success: true,
          token: 'owner_token',
          user: { id: 1, role: 'OWNER', fullName: 'Store Owner' },
        };
      },
    };

    const session = new MockAuthSessionManager(mockApiClient);
    const res = await session.loginWithPassword('owner@grocerychoice.com', 'Pass123!');
    assert.equal(res.success, false);
    assert.equal(res.error, 'This account is not authorized for the Delivery App.');
  });

  // Test 12: Logout Clears Authentication
  test('12. Logout completely clears stored token and user state', async () => {
    const session = new MockAuthSessionManager({});
    await session.setToken('active_token');
    await session.setUserProfile({ id: 10, role: 'DELIVERY', fullName: 'Rider' });

    await session.logout();

    assert.equal(await session.getToken(), null);
    assert.equal(await session.getUserProfile(), null);
    assert.equal(session.user, null);
  });

  // Test 13: Invalid / Expired Token Clears Session
  test('13. Expired or 401 token during hydration clears session without crashing', async () => {
    const mockApiClient = {
      async getMe() {
        throw new ApiError('Full authentication is required to access this resource', 401);
      },
    };

    const session = new MockAuthSessionManager(mockApiClient);
    await session.setToken('expired_or_tampered_token');
    await session.hydrateSession();

    assert.equal(await session.getToken(), null);
    assert.equal(session.user, null);
  });

  // Test 14: API Error Handled Without Crashing
  test('14. Server 500 or network failure does not crash session', async () => {
    const mockApiClient = {
      async loginWithPassword() {
        throw new ApiError('Unable to connect to Grocery Choice server. Please verify your connection.', 0);
      },
    };

    const session = new MockAuthSessionManager(mockApiClient);
    const res = await session.loginWithPassword('9876543210', 'Pass123!');
    assert.equal(res.success, false);
    assert.match(res.error, /Unable to connect/);
  });

  // Test 15: Phone & Email Identifier Format Validation
  test('15. Identifier validation correctly handles 10/11/12-digit Indian mobiles and emails', () => {
    // 10-digit mobile
    const res10 = validateIdentifier('9876543210');
    assert.equal(res10.isValid, true);
    assert.equal(res10.type, 'mobile');
    assert.equal(res10.normalized, '9876543210');

    // 11-digit mobile (0-prefix)
    const res11 = validateIdentifier('09876543210');
    assert.equal(res11.isValid, true);
    assert.equal(res11.normalized, '9876543210');

    // 12-digit mobile (91-prefix)
    const res12 = validateIdentifier('+91 9876543210');
    assert.equal(res12.isValid, true);
    assert.equal(res12.normalized, '9876543210');

    // Email
    const resEmail = validateIdentifier('rider@store.com');
    assert.equal(resEmail.isValid, true);
    assert.equal(resEmail.type, 'email');

    // Invalid mobile
    const resBad = validateIdentifier('12345');
    assert.equal(resBad.isValid, false);
  });
});
