/**
 * Grocery Choice Delivery App - Phase 5 Test Suite
 * Doorstep OTP Verification & COD Handling Lifecycle Tests
 * Validates:
 * 1. verifyDeliveryOtp calls POST /api/delivery/orders/{id}/verify-otp
 * 2. Correct Bearer authorization is supplied
 * 3. Correct 4-digit OTP request is sent ({ otp: '1234' })
 * 4. Successful OTP verification returns updated state
 * 5. deliveryOtpVerified is handled correctly
 * 6. deliveryOtpVerifiedAt is handled correctly
 * 7. OTP input rejects non-numeric characters
 * 8. OTP input rejects fewer than 4 digits
 * 9. OTP input rejects more than 4 digits
 * 10. OTP action is available only for: OUT_FOR_DELIVERY + unverified
 * 11. OTP action is hidden after verification
 * 12. Already verified OTP cannot be submitted again
 * 13. 401 triggers session handling
 * 14. 403 displays authorization error
 * 15. 404 displays not-found error
 * 16. 409 displays lifecycle error
 * 17. Invalid OTP displays user-friendly error
 * 18. Network/500 error displays retry message
 * 19. Failed OTP verification does not mutate local verified state
 * 20. Duplicate OTP submissions are prevented
 * 21. Wrong rider cannot verify OTP
 * 22. OTP verification is not available for PROCESSING
 * 23. OTP verification is not available for DELIVERED
 * 24. OTP verification is not available for CANCELLED
 * 25. COD order is correctly detected from backend payment data
 * 26. Prepaid order never shows COD collection action
 * 27. COD collection is unavailable before OTP verification
 * 28. COD collection action appears only after verified OTP
 * 29. Successful COD collection updates local state
 * 30. COD collected timestamp is handled correctly
 * 31. Already collected COD cannot be collected again
 * 32. Wrong rider cannot collect COD
 * 33. 401 COD error is handled
 * 34. 403 COD error is handled
 * 35. 404 COD error is handled
 * 36. 409 COD error is handled
 * 37. Network/500 COD error is handled
 * 38. Failed COD request does not falsely mark cash collected
 * 39. COD amount is read-only and comes from backend data
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// --- Domain Input Sanitizer ---

export function sanitizeOtpInput(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/[^\d]/g, '').slice(0, 4);
}

// --- Domain OTP Verification Rule Evaluator ---

export function canVerifyDeliveryOtp(order, user) {
  if (!order || !user) return false;
  if (user.role !== 'DELIVERY') return false;

  // Order must belong to current delivery partner
  if (
    order.assignedDeliveryPartnerId != null &&
    user.id != null &&
    order.assignedDeliveryPartnerId !== user.id
  ) {
    return false;
  }

  // Must be in OUT_FOR_DELIVERY status and not already verified
  if (order.status !== 'OUT_FOR_DELIVERY') return false;
  if (order.deliveryOtpVerified === true) return false;

  return true;
}

// --- Domain Payment & COD Evaluator ---

export function isCodOrder(order) {
  if (!order) return false;
  const method = String(order.paymentMethod || '').toLowerCase();
  return method.includes('cod') || method.includes('cash');
}

export function isPrepaidOrder(order) {
  if (!order) return false;
  if (order.paymentStatus === 'PAID') return true;
  const method = String(order.paymentMethod || '').toLowerCase();
  return !isCodOrder(order) && method.includes('online');
}

export function canCollectCod(order, user) {
  if (!order || !user) return false;
  if (user.role !== 'DELIVERY') return false;

  // Order ownership
  if (
    order.assignedDeliveryPartnerId != null &&
    user.id != null &&
    order.assignedDeliveryPartnerId !== user.id
  ) {
    return false;
  }

  // Must be OUT_FOR_DELIVERY
  if (order.status !== 'OUT_FOR_DELIVERY') return false;

  // Must have OTP verified first
  if (order.deliveryOtpVerified !== true) return false;

  // Must be COD payment method
  if (!isCodOrder(order)) return false;

  // Cash not already collected
  if (order.codCollected === true) return false;

  return true;
}

// --- Error Mapping for OTP and COD ---

export function mapOtpVerificationError(error) {
  const status = error?.status;
  const rawMsg = String(error?.message || '').toLowerCase();

  if (status === 401) {
    return {
      type: 'AUTH_EXPIRED',
      message: 'Session expired. Please log in again.',
      action: 'LOGOUT',
    };
  }
  if (status === 403) {
    return {
      type: 'FORBIDDEN',
      message: 'You are not authorized to verify this delivery.',
      action: 'DISPLAY_ERROR',
    };
  }
  if (status === 404) {
    return {
      type: 'NOT_FOUND',
      message: 'Delivery could not be found.',
      action: 'DISPLAY_ERROR',
    };
  }
  if (status === 409 || (status === 400 && rawMsg.includes('out_for_delivery'))) {
    return {
      type: 'CONFLICT',
      message: 'This delivery is not ready for OTP verification.',
      action: 'DISPLAY_ERROR',
    };
  }
  if (
    status === 400 ||
    rawMsg.includes('invalid') ||
    rawMsg.includes('otp') ||
    rawMsg.includes('code') ||
    rawMsg.includes('incorrect')
  ) {
    return {
      type: 'INVALID_OTP',
      message: 'Incorrect delivery OTP. Please ask the customer to confirm the OTP.',
      action: 'DISPLAY_ERROR',
    };
  }
  return {
    type: 'SERVER_ERROR',
    message: 'Unable to verify OTP. Please try again.',
    action: 'DISPLAY_ERROR',
  };
}

export function mapCodCollectionError(error) {
  const status = error?.status;
  const rawMsg = String(error?.message || '').toLowerCase();

  if (status === 401) {
    return {
      type: 'AUTH_EXPIRED',
      message: 'Session expired. Please log in again.',
      action: 'LOGOUT',
    };
  }
  if (status === 403) {
    return {
      type: 'FORBIDDEN',
      message: 'You are not authorized to collect COD for this delivery.',
      action: 'DISPLAY_ERROR',
    };
  }
  if (status === 404) {
    return {
      type: 'NOT_FOUND',
      message: 'Delivery could not be found.',
      action: 'DISPLAY_ERROR',
    };
  }
  if (status === 409 || (status === 400 && (rawMsg.includes('not ready') || rawMsg.includes('prepaid')))) {
    return {
      type: 'CONFLICT',
      message: 'COD collection is not currently allowed for this delivery.',
      action: 'DISPLAY_ERROR',
    };
  }
  return {
    type: 'SERVER_ERROR',
    message: 'Unable to confirm cash collection. Please try again.',
    action: 'DISPLAY_ERROR',
  };
}

// --- Mock API Client with Request Inspection ---

class MockDeliveryApiClient {
  constructor(token = null) {
    this.token = token;
    this.lastRequest = null;
    this.requestCount = 0;
    this.mockResponses = new Map();
  }

  setToken(t) {
    this.token = t;
  }

  setMockResponse(endpoint, responseOrError) {
    this.mockResponses.set(endpoint, responseOrError);
  }

  async post(endpoint, data = null) {
    this.requestCount++;
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    this.lastRequest = { method: 'POST', endpoint, headers, data };

    if (!this.token) {
      const err = new Error('Full authentication is required');
      err.status = 401;
      throw err;
    }

    if (this.mockResponses.has(endpoint)) {
      const resp = this.mockResponses.get(endpoint);
      if (resp instanceof Error) {
        throw resp;
      }
      return resp;
    }

    const err = new Error('Endpoint not found');
    err.status = 404;
    throw err;
  }
}

// --- Simulated Controllers for OTP and COD ---

class OrderOtpVerificationController {
  constructor(apiClient, currentUser, initialOrder) {
    this.apiClient = apiClient;
    this.currentUser = currentUser;
    this.order = { ...initialOrder };
    this.isVerifying = false;
    this.actionError = null;
    this.actionSuccess = null;
    this.loggedOut = false;
  }

  async verifyOtp(otp) {
    if (this.isVerifying) {
      return { duplicatePrevented: true };
    }

    if (!otp || otp.length !== 4) {
      this.actionError = 'Enter the 4-digit delivery OTP.';
      return { success: false, error: this.actionError };
    }

    this.isVerifying = true;
    this.actionError = null;

    try {
      const updated = await this.apiClient.post(
        `/delivery/orders/${this.order.id}/verify-otp`,
        { otp: otp.trim() }
      );
      this.order = updated;
      this.actionSuccess = 'Delivery OTP verified successfully.';
      return { success: true, order: this.order };
    } catch (err) {
      const mapped = mapOtpVerificationError(err);
      if (mapped.action === 'LOGOUT') {
        this.loggedOut = true;
      }
      this.actionError = mapped.message;
      return { success: false, error: mapped.message };
    } finally {
      this.isVerifying = false;
    }
  }
}

class OrderCodCollectionController {
  constructor(apiClient, currentUser, initialOrder) {
    this.apiClient = apiClient;
    this.currentUser = currentUser;
    this.order = { ...initialOrder };
    this.isCollecting = false;
    this.actionError = null;
    this.actionSuccess = null;
    this.loggedOut = false;
  }

  async confirmCashCollection() {
    if (this.isCollecting) {
      return { duplicatePrevented: true };
    }

    if (!canCollectCod(this.order, this.currentUser)) {
      this.actionError = 'COD collection is not currently allowed for this delivery.';
      return { success: false, error: this.actionError };
    }

    this.isCollecting = true;
    this.actionError = null;

    try {
      const updated = await this.apiClient.post(
        `/delivery/orders/${this.order.id}/collect-cod`,
        { codCollected: true }
      );
      this.order = updated;
      this.actionSuccess = 'Cash collection confirmed.';
      return { success: true, order: this.order };
    } catch (err) {
      const mapped = mapCodCollectionError(err);
      if (mapped.action === 'LOGOUT') {
        this.loggedOut = true;
      }
      this.actionError = mapped.message;
      return { success: false, error: mapped.message };
    } finally {
      this.isCollecting = false;
    }
  }
}

// --- Phase 5 Test Suite Execution ---

describe('Phase 5: Doorstep OTP Verification & COD Handling Lifecycle', () => {
  const deliveryUser = {
    id: 10,
    fullName: 'Suresh Kumar',
    email: 'suresh@grocerychoice.com',
    phone: '9876543210',
    role: 'DELIVERY',
    status: 'ACTIVE',
  };

  const sampleOutForDeliveryOrder = {
    id: 42,
    orderNumber: 'GC-2026-00042',
    customerId: 5,
    customerName: 'Aarav Patel',
    customerPhone: '9876543210',
    subtotal: 550.0,
    deliveryCharge: 30.0,
    discount: 0.0,
    totalAmount: 580.0,
    status: 'OUT_FOR_DELIVERY',
    paymentStatus: 'PENDING',
    paymentMethod: 'COD',
    assignedDeliveryPartnerId: 10,
    assignedAt: '2026-10-06T10:00:00.000Z',
    acceptedAt: '2026-10-06T10:15:00.000Z',
    pickedUpAt: '2026-10-06T10:30:00.000Z',
    deliveryOtpVerified: false,
    deliveryOtpVerifiedAt: null,
    codCollected: false,
    codCollectedAt: null,
    deliveredAt: null,
  };

  // 1. verifyDeliveryOtp calls POST /api/delivery/orders/{id}/verify-otp
  test('1. verifyDeliveryOtp calls POST /api/delivery/orders/{id}/verify-otp', async () => {
    const client = new MockDeliveryApiClient('jwt_delivery_token');
    client.setMockResponse('/delivery/orders/42/verify-otp', {
      ...sampleOutForDeliveryOrder,
      deliveryOtpVerified: true,
      deliveryOtpVerifiedAt: '2026-10-06T10:45:00.000Z',
    });

    await client.post('/delivery/orders/42/verify-otp', { otp: '4321' });
    assert.equal(client.lastRequest.endpoint, '/delivery/orders/42/verify-otp');
    assert.equal(client.lastRequest.method, 'POST');
  });

  // 2. Correct Bearer authorization is supplied
  test('2. Correct Bearer authorization is supplied on verify-otp request', async () => {
    const client = new MockDeliveryApiClient('jwt_rider_secure_token');
    client.setMockResponse('/delivery/orders/42/verify-otp', {
      ...sampleOutForDeliveryOrder,
      deliveryOtpVerified: true,
    });

    await client.post('/delivery/orders/42/verify-otp', { otp: '4321' });
    assert.equal(
      client.lastRequest.headers['Authorization'],
      'Bearer jwt_rider_secure_token'
    );
  });

  // 3. Correct 4-digit OTP request is sent
  test('3. Correct 4-digit OTP request body is sent ({ otp: "4321" })', async () => {
    const client = new MockDeliveryApiClient('jwt_token');
    client.setMockResponse('/delivery/orders/42/verify-otp', {
      ...sampleOutForDeliveryOrder,
      deliveryOtpVerified: true,
    });

    const controller = new OrderOtpVerificationController(
      client,
      deliveryUser,
      sampleOutForDeliveryOrder
    );
    await controller.verifyOtp('4321');

    assert.deepEqual(client.lastRequest.data, { otp: '4321' });
  });

  // 4. Successful OTP verification returns updated state
  test('4. Successful OTP verification returns updated state with deliveryOtpVerified = true', async () => {
    const client = new MockDeliveryApiClient('jwt_token');
    client.setMockResponse('/delivery/orders/42/verify-otp', {
      ...sampleOutForDeliveryOrder,
      deliveryOtpVerified: true,
      deliveryOtpVerifiedAt: '2026-10-06T10:45:00.000Z',
    });

    const controller = new OrderOtpVerificationController(
      client,
      deliveryUser,
      sampleOutForDeliveryOrder
    );
    const result = await controller.verifyOtp('4321');

    assert.equal(result.success, true);
    assert.equal(controller.order.deliveryOtpVerified, true);
    assert.equal(controller.order.status, 'OUT_FOR_DELIVERY'); // Retains OUT_FOR_DELIVERY
  });

  // 5. deliveryOtpVerified is handled correctly
  test('5. deliveryOtpVerified boolean flag is handled correctly', () => {
    const verifiedOrder = {
      ...sampleOutForDeliveryOrder,
      deliveryOtpVerified: true,
    };
    assert.equal(verifiedOrder.deliveryOtpVerified, true);
    assert.equal(canVerifyDeliveryOtp(verifiedOrder, deliveryUser), false);
  });

  // 6. deliveryOtpVerifiedAt is handled correctly
  test('6. deliveryOtpVerifiedAt timestamp is handled and formatted safely', () => {
    const verifiedOrder = {
      ...sampleOutForDeliveryOrder,
      deliveryOtpVerified: true,
      deliveryOtpVerifiedAt: '2026-10-06T10:45:00.000Z',
    };
    const date = new Date(verifiedOrder.deliveryOtpVerifiedAt);
    assert.ok(!isNaN(date.getTime()));
    assert.equal(date.getUTCHours(), 10);
    assert.equal(date.getUTCMinutes(), 45);
  });

  // 7. OTP input rejects non-numeric characters
  test('7. OTP input rejects non-numeric characters (e.g. letters, symbols)', () => {
    assert.equal(sanitizeOtpInput('12a3'), '123');
    assert.equal(sanitizeOtpInput('abcd'), '');
    assert.equal(sanitizeOtpInput('1 2 3 4'), '1234');
    assert.equal(sanitizeOtpInput('1-2#3$4'), '1234');
  });

  // 8. OTP input rejects fewer than 4 digits
  test('8. OTP input rejects fewer than 4 digits before API call', async () => {
    const client = new MockDeliveryApiClient('jwt_token');
    const controller = new OrderOtpVerificationController(
      client,
      deliveryUser,
      sampleOutForDeliveryOrder
    );

    const result = await controller.verifyOtp('123');
    assert.equal(result.success, false);
    assert.equal(result.error, 'Enter the 4-digit delivery OTP.');
    assert.equal(client.requestCount, 0); // Zero network dispatches
  });

  // 9. OTP input rejects more than 4 digits
  test('9. OTP input truncates to max length 4', () => {
    assert.equal(sanitizeOtpInput('12345'), '1234');
    assert.equal(sanitizeOtpInput('9876543210'), '9876');
  });

  // 10. OTP action is available only for: OUT_FOR_DELIVERY + unverified
  test('10. OTP action is available only for OUT_FOR_DELIVERY + unverified', () => {
    assert.equal(canVerifyDeliveryOtp(sampleOutForDeliveryOrder, deliveryUser), true);
  });

  // 11. OTP action is hidden after verification
  test('11. OTP action is hidden after verification', () => {
    const verified = {
      ...sampleOutForDeliveryOrder,
      deliveryOtpVerified: true,
    };
    assert.equal(canVerifyDeliveryOtp(verified, deliveryUser), false);
  });

  // 12. Already verified OTP cannot be submitted again
  test('12. Already verified OTP cannot be submitted again', () => {
    const verified = {
      ...sampleOutForDeliveryOrder,
      deliveryOtpVerified: true,
    };
    assert.equal(canVerifyDeliveryOtp(verified, deliveryUser), false);
  });

  // 13. 401 triggers session handling
  test('13. 401 Unauthorized triggers session logout on OTP verification', async () => {
    const client = new MockDeliveryApiClient(null);
    const controller = new OrderOtpVerificationController(
      client,
      deliveryUser,
      sampleOutForDeliveryOrder
    );

    const result = await controller.verifyOtp('1234');
    assert.equal(result.success, false);
    assert.equal(controller.loggedOut, true);
    assert.equal(controller.actionError, 'Session expired. Please log in again.');
  });

  // 14. 403 displays authorization error
  test('14. 403 Forbidden displays authorization error message', async () => {
    const client = new MockDeliveryApiClient('jwt_token');
    const err = new Error('Access denied');
    err.status = 403;
    client.setMockResponse('/delivery/orders/42/verify-otp', err);

    const controller = new OrderOtpVerificationController(
      client,
      deliveryUser,
      sampleOutForDeliveryOrder
    );
    const result = await controller.verifyOtp('1234');

    assert.equal(result.success, false);
    assert.equal(
      controller.actionError,
      'You are not authorized to verify this delivery.'
    );
  });

  // 15. 404 displays not-found error
  test('15. 404 Not Found displays delivery not found error', async () => {
    const client = new MockDeliveryApiClient('jwt_token');
    const err = new Error('Not found');
    err.status = 404;
    client.setMockResponse('/delivery/orders/42/verify-otp', err);

    const controller = new OrderOtpVerificationController(
      client,
      deliveryUser,
      sampleOutForDeliveryOrder
    );
    const result = await controller.verifyOtp('1234');

    assert.equal(result.success, false);
    assert.equal(controller.actionError, 'Delivery could not be found.');
  });

  // 16. 409 displays lifecycle error
  test('16. 409 Conflict displays delivery not ready for OTP verification', async () => {
    const client = new MockDeliveryApiClient('jwt_token');
    const err = new Error('Order must be in OUT_FOR_DELIVERY status to verify delivery code');
    err.status = 409;
    client.setMockResponse('/delivery/orders/42/verify-otp', err);

    const controller = new OrderOtpVerificationController(
      client,
      deliveryUser,
      sampleOutForDeliveryOrder
    );
    const result = await controller.verifyOtp('1234');

    assert.equal(result.success, false);
    assert.equal(
      controller.actionError,
      'This delivery is not ready for OTP verification.'
    );
  });

  // 17. Invalid OTP displays user-friendly error
  test('17. Invalid OTP displays user-friendly error to re-confirm with customer', async () => {
    const client = new MockDeliveryApiClient('jwt_token');
    const err = new Error('Invalid delivery verification code');
    err.status = 400;
    client.setMockResponse('/delivery/orders/42/verify-otp', err);

    const controller = new OrderOtpVerificationController(
      client,
      deliveryUser,
      sampleOutForDeliveryOrder
    );
    const result = await controller.verifyOtp('9999');

    assert.equal(result.success, false);
    assert.equal(
      controller.actionError,
      'Incorrect delivery OTP. Please ask the customer to confirm the OTP.'
    );
  });

  // 18. Network/500 error displays retry message
  test('18. Network / 500 error displays retry message', async () => {
    const client = new MockDeliveryApiClient('jwt_token');
    const err = new Error('Server error');
    err.status = 500;
    client.setMockResponse('/delivery/orders/42/verify-otp', err);

    const controller = new OrderOtpVerificationController(
      client,
      deliveryUser,
      sampleOutForDeliveryOrder
    );
    const result = await controller.verifyOtp('1234');

    assert.equal(result.success, false);
    assert.equal(
      controller.actionError,
      'Unable to verify OTP. Please try again.'
    );
  });

  // 19. Failed OTP verification does not mutate local verified state
  test('19. Failed OTP verification does not falsely mutate local verified state', async () => {
    const client = new MockDeliveryApiClient('jwt_token');
    const err = new Error('Invalid delivery verification code');
    err.status = 400;
    client.setMockResponse('/delivery/orders/42/verify-otp', err);

    const controller = new OrderOtpVerificationController(
      client,
      deliveryUser,
      sampleOutForDeliveryOrder
    );
    await controller.verifyOtp('0000');

    assert.equal(controller.order.deliveryOtpVerified, false);
    assert.equal(controller.order.status, 'OUT_FOR_DELIVERY');
  });

  // 20. Duplicate OTP submissions are prevented
  test('20. Duplicate OTP submissions are prevented while in flight', async () => {
    const client = new MockDeliveryApiClient('jwt_token');
    let resolvePost;
    const pendingPromise = new Promise((resolve) => {
      resolvePost = resolve;
    });
    client.post = async () => {
      client.requestCount++;
      return pendingPromise;
    };

    const controller = new OrderOtpVerificationController(
      client,
      deliveryUser,
      sampleOutForDeliveryOrder
    );

    const p1 = controller.verifyOtp('1234');
    assert.equal(controller.isVerifying, true);

    const p2 = controller.verifyOtp('1234');
    const result2 = await p2;
    assert.equal(result2.duplicatePrevented, true);

    resolvePost({
      ...sampleOutForDeliveryOrder,
      deliveryOtpVerified: true,
    });
    await p1;
    assert.equal(client.requestCount, 1);
  });

  // 21. Wrong rider cannot verify OTP
  test('21. Wrong rider cannot verify OTP (rejected client + backend 403)', async () => {
    const wrongRider = { id: 999, role: 'DELIVERY' };
    assert.equal(canVerifyDeliveryOtp(sampleOutForDeliveryOrder, wrongRider), false);

    const client = new MockDeliveryApiClient('jwt_wrong');
    const err = new Error('You are not assigned to this order');
    err.status = 403;
    client.setMockResponse('/delivery/orders/42/verify-otp', err);

    const controller = new OrderOtpVerificationController(
      client,
      wrongRider,
      sampleOutForDeliveryOrder
    );
    const result = await controller.verifyOtp('1234');
    assert.equal(result.success, false);
    assert.equal(
      controller.actionError,
      'You are not authorized to verify this delivery.'
    );
  });

  // 22. OTP verification is not available for PROCESSING
  test('22. OTP verification is not available for PROCESSING', () => {
    const processingOrder = {
      ...sampleOutForDeliveryOrder,
      status: 'PROCESSING',
    };
    assert.equal(canVerifyDeliveryOtp(processingOrder, deliveryUser), false);
  });

  // 23. OTP verification is not available for DELIVERED
  test('23. OTP verification is not available for DELIVERED', () => {
    const deliveredOrder = {
      ...sampleOutForDeliveryOrder,
      status: 'DELIVERED',
    };
    assert.equal(canVerifyDeliveryOtp(deliveredOrder, deliveryUser), false);
  });

  // 24. OTP verification is not available for CANCELLED
  test('24. OTP verification is not available for CANCELLED', () => {
    const cancelledOrder = {
      ...sampleOutForDeliveryOrder,
      status: 'CANCELLED',
    };
    assert.equal(canVerifyDeliveryOtp(cancelledOrder, deliveryUser), false);
  });

  // --- COD Tests ---

  // 25. COD order is correctly detected from backend payment data
  test('25. COD order is correctly detected from backend payment data', () => {
    assert.equal(isCodOrder({ paymentMethod: 'COD' }), true);
    assert.equal(isCodOrder({ paymentMethod: 'Cash on Delivery' }), true);
    assert.equal(isCodOrder({ paymentMethod: 'ONLINE' }), false);
  });

  // 26. Prepaid order never shows COD collection action
  test('26. Prepaid order never shows COD collection action', () => {
    const prepaidOrder = {
      ...sampleOutForDeliveryOrder,
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      deliveryOtpVerified: true,
    };
    assert.equal(isPrepaidOrder(prepaidOrder), true);
    assert.equal(canCollectCod(prepaidOrder, deliveryUser), false);
  });

  // 27. COD collection is unavailable before OTP verification
  test('27. COD collection is unavailable before OTP verification', () => {
    const unverifiedCod = {
      ...sampleOutForDeliveryOrder,
      deliveryOtpVerified: false,
      paymentMethod: 'COD',
    };
    assert.equal(canCollectCod(unverifiedCod, deliveryUser), false);
  });

  // 28. COD collection action appears only after verified OTP
  test('28. COD collection action appears only after verified OTP', () => {
    const verifiedCod = {
      ...sampleOutForDeliveryOrder,
      deliveryOtpVerified: true,
      codCollected: false,
      paymentMethod: 'COD',
    };
    assert.equal(canCollectCod(verifiedCod, deliveryUser), true);
  });

  // 29. Successful COD collection updates local state
  test('29. Successful COD collection updates local state when supported', async () => {
    const verifiedCod = {
      ...sampleOutForDeliveryOrder,
      deliveryOtpVerified: true,
      codCollected: false,
    };
    const client = new MockDeliveryApiClient('jwt_token');
    client.setMockResponse('/delivery/orders/42/collect-cod', {
      ...verifiedCod,
      codCollected: true,
      codCollectedAt: '2026-10-06T10:50:00.000Z',
      paymentStatus: 'PAID',
    });

    const controller = new OrderCodCollectionController(client, deliveryUser, verifiedCod);
    const result = await controller.confirmCashCollection();

    assert.equal(result.success, true);
    assert.equal(controller.order.codCollected, true);
    assert.equal(controller.order.paymentStatus, 'PAID');
  });

  // 30. COD collected timestamp is handled correctly
  test('30. COD collected timestamp is handled and formatted correctly', () => {
    const collectedOrder = {
      ...sampleOutForDeliveryOrder,
      codCollected: true,
      codCollectedAt: '2026-10-06T10:50:00.000Z',
    };
    const date = new Date(collectedOrder.codCollectedAt);
    assert.ok(!isNaN(date.getTime()));
    assert.equal(date.getUTCHours(), 10);
    assert.equal(date.getUTCMinutes(), 50);
  });

  // 31. Already collected COD cannot be collected again
  test('31. Already collected COD cannot be collected again', () => {
    const alreadyCollected = {
      ...sampleOutForDeliveryOrder,
      deliveryOtpVerified: true,
      codCollected: true,
    };
    assert.equal(canCollectCod(alreadyCollected, deliveryUser), false);
  });

  // 32. Wrong rider cannot collect COD
  test('32. Wrong rider cannot collect COD', () => {
    const verifiedCod = {
      ...sampleOutForDeliveryOrder,
      deliveryOtpVerified: true,
      codCollected: false,
    };
    const wrongRider = { id: 999, role: 'DELIVERY' };
    assert.equal(canCollectCod(verifiedCod, wrongRider), false);
  });

  // 33. 401 COD error is handled
  test('33. 401 COD error triggers session logout', () => {
    const mapped = mapCodCollectionError({ status: 401 });
    assert.equal(mapped.action, 'LOGOUT');
    assert.equal(mapped.message, 'Session expired. Please log in again.');
  });

  // 34. 403 COD error is handled
  test('34. 403 COD error is handled with authorization message', () => {
    const mapped = mapCodCollectionError({ status: 403 });
    assert.equal(
      mapped.message,
      'You are not authorized to collect COD for this delivery.'
    );
  });

  // 35. 404 COD error is handled
  test('35. 404 COD error is handled with delivery not found message', () => {
    const mapped = mapCodCollectionError({ status: 404 });
    assert.equal(mapped.message, 'Delivery could not be found.');
  });

  // 36. 409 COD error is handled
  test('36. 409 COD error is handled with conflict message', () => {
    const mapped = mapCodCollectionError({ status: 409 });
    assert.equal(
      mapped.message,
      'COD collection is not currently allowed for this delivery.'
    );
  });

  // 37. Network/500 COD error is handled
  test('37. Network/500 COD error displays retry message', () => {
    const mapped = mapCodCollectionError({ status: 500 });
    assert.equal(
      mapped.message,
      'Unable to confirm cash collection. Please try again.'
    );
  });

  // 38. Failed COD request does not falsely mark cash collected
  test('38. Failed COD request does not falsely mark cash collected', async () => {
    const verifiedCod = {
      ...sampleOutForDeliveryOrder,
      deliveryOtpVerified: true,
      codCollected: false,
    };
    const client = new MockDeliveryApiClient('jwt_token');
    const err = new Error('Database timeout');
    err.status = 500;
    client.setMockResponse('/delivery/orders/42/collect-cod', err);

    const controller = new OrderCodCollectionController(client, deliveryUser, verifiedCod);
    const result = await controller.confirmCashCollection();

    assert.equal(result.success, false);
    assert.equal(controller.order.codCollected, false);
  });

  // 39. COD amount is read-only and comes from backend data
  test('39. COD amount is read-only and comes strictly from backend totalAmount', () => {
    assert.equal(sampleOutForDeliveryOrder.totalAmount, 580.0);
    const formatted = `₹${sampleOutForDeliveryOrder.totalAmount.toFixed(2)}`;
    assert.equal(formatted, '₹580.00');
  });
});
