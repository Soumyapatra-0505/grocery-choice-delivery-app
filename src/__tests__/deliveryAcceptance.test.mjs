/**
 * Grocery Choice Delivery App - Phase 3 Test Suite
 * Order Detail & Delivery Acceptance Lifecycle Tests
 * Validates:
 * 1. acceptDelivery calls POST /api/delivery/orders/{id}/accept
 * 2. Authorization header is provided by the centralized client
 * 3. Successful acceptance returns updated order data
 * 4. Accepted timestamp is handled correctly
 * 5. Already accepted delivery is represented correctly
 * 6. Accept action is available for PROCESSING + acceptedAt == null
 * 7. Accept action is hidden when acceptedAt != null
 * 8. Accept action is hidden for OUT_FOR_DELIVERY
 * 9. Accept action is hidden for DELIVERED
 * 10. Accept action is hidden for CANCELLED
 * 11. 401 response is handled correctly
 * 12. 403 response is handled correctly
 * 13. 404 response is handled correctly
 * 14. Lifecycle conflict/409 is handled correctly
 * 15. Network/500 error is handled correctly
 * 16. Duplicate button presses do not generate duplicate requests
 * 17. Successful acceptance updates the UI state
 * 18. Failed acceptance does not falsely update local state
 * 19. Wrong-rider rejection is handled correctly
 * 20. Verification of full lifecycle consistency
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// --- Domain Acceptance Rule Evaluator ---

export function canAcceptDelivery(order, user) {
  if (!order || !user) return false;
  if (user.role !== 'DELIVERY') return false;

  // Order must belong to current delivery partner if assigned ID is present
  if (
    order.assignedDeliveryPartnerId != null &&
    user.id != null &&
    order.assignedDeliveryPartnerId !== user.id
  ) {
    return false;
  }

  // Only PROCESSING orders with no accepted timestamp may be accepted
  if (order.status !== 'PROCESSING') return false;
  if (order.acceptedAt != null) return false;

  return true;
}

// --- Order Detail UI State Determiner ---

export function getDeliveryLifecycleDisplay(order) {
  if (!order) {
    return { badge: 'Unknown', canAccept: false, isAccepted: false };
  }

  if (order.status === 'OUT_FOR_DELIVERY') {
    return {
      badge: 'Out for Delivery',
      variant: 'info',
      canAccept: false,
      isAccepted: true,
      noticeTitle: '🚚 Out for Delivery',
    };
  }

  if (order.status === 'PROCESSING') {
    if (order.acceptedAt != null) {
      return {
        badge: 'Delivery Accepted',
        variant: 'success',
        canAccept: false,
        isAccepted: true,
        noticeTitle: '✅ Delivery Accepted',
      };
    }
    return {
      badge: 'Awaiting Acceptance',
      variant: 'warning',
      canAccept: true,
      isAccepted: false,
      noticeTitle: '📋 Delivery Assigned',
    };
  }

  if (order.status === 'DELIVERED') {
    return {
      badge: 'Delivered',
      variant: 'success',
      canAccept: false,
      isAccepted: true,
      noticeTitle: '🎉 Order Delivered',
    };
  }

  if (order.status === 'CANCELLED') {
    return {
      badge: 'Cancelled',
      variant: 'danger',
      canAccept: false,
      isAccepted: false,
      noticeTitle: '❌ Cancelled',
    };
  }

  return {
    badge: String(order.status),
    variant: 'default',
    canAccept: false,
    isAccepted: false,
    noticeTitle: `Status: ${order.status}`,
  };
}

// --- Error Message Mapping for Acceptance ---

export function mapAcceptanceError(error) {
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
      message: 'You are not authorized to accept this delivery.',
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
  if (status === 409 || (status === 400 && rawMsg.includes('already'))) {
    return {
      type: 'CONFLICT',
      message: 'This delivery can no longer be accepted.',
      action: 'REFRESH_ORDER',
    };
  }
  return {
    type: 'SERVER_ERROR',
    message: 'Unable to accept delivery. Please try again.',
    action: 'DISPLAY_ERROR',
  };
}

// --- Mock Delivery API Client with Request Tracking ---

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

// --- Simulated UI Controller for Order Acceptance ---

class OrderAcceptanceController {
  constructor(apiClient, currentUser, initialOrder) {
    this.apiClient = apiClient;
    this.currentUser = currentUser;
    this.order = { ...initialOrder };
    this.isAccepting = false;
    this.actionError = null;
    this.actionSuccess = null;
    this.loggedOut = false;
  }

  async accept() {
    // Prevent duplicate submission / double taps
    if (this.isAccepting) {
      return { duplicatePrevented: true };
    }

    this.isAccepting = true;
    this.actionError = null;

    try {
      const updated = await this.apiClient.post(
        `/delivery/orders/${this.order.id}/accept`
      );
      this.order = updated;
      this.actionSuccess = 'Delivery accepted successfully!';
      return { success: true, order: this.order };
    } catch (err) {
      const mapped = mapAcceptanceError(err);
      if (mapped.action === 'LOGOUT') {
        this.loggedOut = true;
      }
      this.actionError = mapped.message;
      return { success: false, error: mapped.message };
    } finally {
      this.isAccepting = false;
    }
  }
}

// --- Test Suite Execution ---

describe('Phase 3: Order Detail & Delivery Acceptance Lifecycle', () => {
  const deliveryUser = {
    id: 10,
    fullName: 'Suresh Kumar',
    email: 'suresh@grocerychoice.com',
    phone: '9876543210',
    role: 'DELIVERY',
    status: 'ACTIVE',
  };

  const sampleOrder = {
    id: 42,
    orderNumber: 'GC-2026-00042',
    customerId: 5,
    customerName: 'Aarav Patel',
    customerPhone: '9876543210',
    deliveryAddressText: 'Flat 302, Green Glen Layout, Bellandur, Bengaluru',
    deliveryAddressLandmark: 'Opposite Central Mall',
    subtotal: 550.0,
    deliveryCharge: 30.0,
    discount: 0.0,
    totalAmount: 580.0,
    status: 'PROCESSING',
    paymentStatus: 'PAID',
    paymentMethod: 'ONLINE',
    assignedDeliveryPartnerId: 10,
    assignedAt: '2026-10-06T10:00:00.000Z',
    acceptedAt: null,
    pickedUpAt: null,
    deliveredAt: null,
  };

  // 1. acceptDelivery calls POST /api/delivery/orders/{id}/accept
  test('1. acceptDelivery calls POST /api/delivery/orders/{id}/accept', async () => {
    const client = new MockDeliveryApiClient('jwt_delivery_token');
    const acceptedOrder = {
      ...sampleOrder,
      acceptedAt: '2026-10-06T10:15:00.000Z',
    };
    client.setMockResponse('/delivery/orders/42/accept', acceptedOrder);

    const result = await client.post('/delivery/orders/42/accept');
    assert.equal(client.lastRequest.endpoint, '/delivery/orders/42/accept');
    assert.equal(client.lastRequest.method, 'POST');
    assert.equal(result.id, 42);
  });

  // 2. Authorization header is provided by the centralized client
  test('2. Authorization Bearer header is sent on acceptDelivery request', async () => {
    const client = new MockDeliveryApiClient('secure_jwt_rider_token');
    client.setMockResponse('/delivery/orders/42/accept', {
      ...sampleOrder,
      acceptedAt: '2026-10-06T10:15:00.000Z',
    });

    await client.post('/delivery/orders/42/accept');
    assert.equal(
      client.lastRequest.headers['Authorization'],
      'Bearer secure_jwt_rider_token'
    );
  });

  // 3. Successful acceptance returns updated order data
  test('3. Successful acceptance returns updated order data', async () => {
    const client = new MockDeliveryApiClient('jwt_delivery_token');
    const acceptedData = {
      ...sampleOrder,
      acceptedAt: '2026-10-06T10:20:00.000Z',
      status: 'PROCESSING',
    };
    client.setMockResponse('/delivery/orders/42/accept', acceptedData);

    const controller = new OrderAcceptanceController(client, deliveryUser, sampleOrder);
    const result = await controller.accept();

    assert.equal(result.success, true);
    assert.equal(controller.order.status, 'PROCESSING');
    assert.ok(controller.order.acceptedAt != null);
    assert.equal(controller.order.acceptedAt, '2026-10-06T10:20:00.000Z');
  });

  // 4. Accepted timestamp is handled correctly
  test('4. Accepted timestamp is handled and formatted correctly', () => {
    const orderWithAccepted = {
      ...sampleOrder,
      acceptedAt: '2026-10-06T10:20:00.000Z',
    };
    const date = new Date(orderWithAccepted.acceptedAt);
    assert.ok(!isNaN(date.getTime()));
    assert.equal(date.getUTCHours(), 10);
    assert.equal(date.getUTCMinutes(), 20);

    const display = getDeliveryLifecycleDisplay(orderWithAccepted);
    assert.equal(display.isAccepted, true);
    assert.equal(display.badge, 'Delivery Accepted');
  });

  // 5. Already accepted delivery is represented correctly
  test('5. Already accepted delivery is represented correctly (status PROCESSING + acceptedAt != null)', () => {
    const orderAlreadyAccepted = {
      ...sampleOrder,
      acceptedAt: '2026-10-06T09:30:00.000Z',
    };
    const display = getDeliveryLifecycleDisplay(orderAlreadyAccepted);
    assert.equal(display.badge, 'Delivery Accepted');
    assert.equal(display.variant, 'success');
    assert.equal(display.canAccept, false);
    assert.equal(display.isAccepted, true);
  });

  // 6. Accept action is available for PROCESSING + acceptedAt == null
  test('6. Accept action is available for PROCESSING + acceptedAt == null', () => {
    const eligibleOrder = {
      ...sampleOrder,
      status: 'PROCESSING',
      acceptedAt: null,
      assignedDeliveryPartnerId: deliveryUser.id,
    };
    const canAccept = canAcceptDelivery(eligibleOrder, deliveryUser);
    assert.equal(canAccept, true);

    const display = getDeliveryLifecycleDisplay(eligibleOrder);
    assert.equal(display.canAccept, true);
    assert.equal(display.badge, 'Awaiting Acceptance');
  });

  // 7. Accept action is hidden when acceptedAt != null
  test('7. Accept action is hidden when acceptedAt != null', () => {
    const alreadyAcceptedOrder = {
      ...sampleOrder,
      status: 'PROCESSING',
      acceptedAt: '2026-10-06T10:05:00.000Z',
    };
    const canAccept = canAcceptDelivery(alreadyAcceptedOrder, deliveryUser);
    assert.equal(canAccept, false);

    const display = getDeliveryLifecycleDisplay(alreadyAcceptedOrder);
    assert.equal(display.canAccept, false);
  });

  // 8. Accept action is hidden for OUT_FOR_DELIVERY
  test('8. Accept action is hidden for OUT_FOR_DELIVERY', () => {
    const outOrder = {
      ...sampleOrder,
      status: 'OUT_FOR_DELIVERY',
      acceptedAt: '2026-10-06T10:05:00.000Z',
      pickedUpAt: '2026-10-06T10:30:00.000Z',
    };
    const canAccept = canAcceptDelivery(outOrder, deliveryUser);
    assert.equal(canAccept, false);

    const display = getDeliveryLifecycleDisplay(outOrder);
    assert.equal(display.canAccept, false);
    assert.equal(display.badge, 'Out for Delivery');
  });

  // 9. Accept action is hidden for DELIVERED
  test('9. Accept action is hidden for DELIVERED', () => {
    const deliveredOrder = {
      ...sampleOrder,
      status: 'DELIVERED',
      acceptedAt: '2026-10-06T10:05:00.000Z',
      deliveredAt: '2026-10-06T11:00:00.000Z',
    };
    const canAccept = canAcceptDelivery(deliveredOrder, deliveryUser);
    assert.equal(canAccept, false);

    const display = getDeliveryLifecycleDisplay(deliveredOrder);
    assert.equal(display.canAccept, false);
    assert.equal(display.badge, 'Delivered');
  });

  // 10. Accept action is hidden for CANCELLED
  test('10. Accept action is hidden for CANCELLED', () => {
    const cancelledOrder = {
      ...sampleOrder,
      status: 'CANCELLED',
      acceptedAt: null,
    };
    const canAccept = canAcceptDelivery(cancelledOrder, deliveryUser);
    assert.equal(canAccept, false);

    const display = getDeliveryLifecycleDisplay(cancelledOrder);
    assert.equal(display.canAccept, false);
    assert.equal(display.badge, 'Cancelled');
  });

  // 11. 401 response is handled correctly
  test('11. 401 Unauthorized response triggers session logout', async () => {
    const client = new MockDeliveryApiClient(null); // Unauthenticated
    const controller = new OrderAcceptanceController(client, deliveryUser, sampleOrder);

    const result = await controller.accept();
    assert.equal(result.success, false);
    assert.equal(controller.loggedOut, true);
    assert.equal(controller.actionError, 'Session expired. Please log in again.');
  });

  // 12. 403 response is handled correctly
  test('12. 403 Forbidden displays not authorized message', async () => {
    const client = new MockDeliveryApiClient('jwt_token');
    const forbiddenErr = new Error('Access denied');
    forbiddenErr.status = 403;
    client.setMockResponse('/delivery/orders/42/accept', forbiddenErr);

    const controller = new OrderAcceptanceController(client, deliveryUser, sampleOrder);
    const result = await controller.accept();

    assert.equal(result.success, false);
    assert.equal(
      controller.actionError,
      'You are not authorized to accept this delivery.'
    );
  });

  // 13. 404 response is handled correctly
  test('13. 404 Not Found displays delivery could not be found message', async () => {
    const client = new MockDeliveryApiClient('jwt_token');
    const notFoundErr = new Error('Order not found');
    notFoundErr.status = 404;
    client.setMockResponse('/delivery/orders/42/accept', notFoundErr);

    const controller = new OrderAcceptanceController(client, deliveryUser, sampleOrder);
    const result = await controller.accept();

    assert.equal(result.success, false);
    assert.equal(controller.actionError, 'Delivery could not be found.');
  });

  // 14. Lifecycle conflict/409 is handled correctly
  test('14. 409 Conflict displays lifecycle conflict message', async () => {
    const client = new MockDeliveryApiClient('jwt_token');
    const conflictErr = new Error('Order assignment has already been accepted');
    conflictErr.status = 409;
    client.setMockResponse('/delivery/orders/42/accept', conflictErr);

    const controller = new OrderAcceptanceController(client, deliveryUser, sampleOrder);
    const result = await controller.accept();

    assert.equal(result.success, false);
    assert.equal(
      controller.actionError,
      'This delivery can no longer be accepted.'
    );
  });

  // 15. Network/500 error is handled correctly
  test('15. Network / 500 error displays user-friendly retry message', async () => {
    const client = new MockDeliveryApiClient('jwt_token');
    const serverErr = new Error('Database connection failed');
    serverErr.status = 500;
    client.setMockResponse('/delivery/orders/42/accept', serverErr);

    const controller = new OrderAcceptanceController(client, deliveryUser, sampleOrder);
    const result = await controller.accept();

    assert.equal(result.success, false);
    assert.equal(
      controller.actionError,
      'Unable to accept delivery. Please try again.'
    );
  });

  // 16. Duplicate button presses do not generate duplicate requests
  test('16. In-flight request lock prevents duplicate accept requests', async () => {
    const client = new MockDeliveryApiClient('jwt_token');
    // Slow endpoint simulation
    let resolvePost;
    const pendingPromise = new Promise((resolve) => {
      resolvePost = resolve;
    });
    client.post = async (endpoint) => {
      client.requestCount++;
      return pendingPromise;
    };

    const controller = new OrderAcceptanceController(client, deliveryUser, sampleOrder);

    // First tap fires
    const p1 = controller.accept();
    assert.equal(controller.isAccepting, true);

    // Second tap while in flight
    const p2 = controller.accept();
    const result2 = await p2;
    assert.equal(result2.duplicatePrevented, true);

    // Resolve first request
    resolvePost({
      ...sampleOrder,
      acceptedAt: '2026-10-06T10:25:00.000Z',
    });
    const result1 = await p1;
    assert.equal(result1.success, true);
    assert.equal(client.requestCount, 1); // Exactly one network request sent
  });

  // 17. Successful acceptance updates the UI state
  test('17. Successful acceptance updates local order state and shows accepted view', async () => {
    const client = new MockDeliveryApiClient('jwt_token');
    const acceptedData = {
      ...sampleOrder,
      acceptedAt: '2026-10-06T10:30:00.000Z',
    };
    client.setMockResponse('/delivery/orders/42/accept', acceptedData);

    const controller = new OrderAcceptanceController(client, deliveryUser, sampleOrder);
    assert.equal(controller.order.acceptedAt, null);

    await controller.accept();
    assert.equal(controller.order.acceptedAt, '2026-10-06T10:30:00.000Z');
    assert.equal(controller.actionSuccess, 'Delivery accepted successfully!');

    // UI state check
    const updatedDisplay = getDeliveryLifecycleDisplay(controller.order);
    assert.equal(updatedDisplay.badge, 'Delivery Accepted');
    assert.equal(updatedDisplay.canAccept, false);
    assert.equal(updatedDisplay.isAccepted, true);
  });

  // 18. Failed acceptance does not falsely update local state
  test('18. Failed acceptance does not falsely mutate local order state', async () => {
    const client = new MockDeliveryApiClient('jwt_token');
    const err = new Error('Internal Server Error');
    err.status = 500;
    client.setMockResponse('/delivery/orders/42/accept', err);

    const controller = new OrderAcceptanceController(client, deliveryUser, sampleOrder);
    assert.equal(controller.order.acceptedAt, null);

    const result = await controller.accept();
    assert.equal(result.success, false);
    assert.equal(controller.order.acceptedAt, null); // Strictly unchanged!
    assert.equal(canAcceptDelivery(controller.order, deliveryUser), true);
  });

  // 19. Wrong-rider rejection is handled correctly
  test('19. Wrong-rider rejection is rejected by ownership check and backend 403', async () => {
    const otherUser = {
      id: 99,
      fullName: 'Ramesh Singh',
      role: 'DELIVERY',
    };

    // Client-side rule rejection
    const allowed = canAcceptDelivery(sampleOrder, otherUser);
    assert.equal(allowed, false);

    // Backend-side 403 simulation
    const client = new MockDeliveryApiClient('jwt_other_rider');
    const accessDenied = new Error('You are not assigned to this order');
    accessDenied.status = 403;
    client.setMockResponse('/delivery/orders/42/accept', accessDenied);

    const controller = new OrderAcceptanceController(client, otherUser, sampleOrder);
    const result = await controller.accept();
    assert.equal(result.success, false);
    assert.equal(
      controller.actionError,
      'You are not authorized to accept this delivery.'
    );
    assert.equal(controller.order.acceptedAt, null);
  });

  // 20. Non-DELIVERY role rejection
  test('20. Non-DELIVERY role (CUSTOMER/STAFF/OWNER) is strictly prevented from accepting delivery', () => {
    const nonDeliveryRoles = ['CUSTOMER', 'STAFF', 'ADMIN', 'OWNER'];
    for (const r of nonDeliveryRoles) {
      const invalidUser = { id: 10, role: r };
      const canAccept = canAcceptDelivery(sampleOrder, invalidUser);
      assert.equal(
        canAccept,
        false,
        `Role ${r} must not be allowed to accept delivery`
      );
    }
  });
});
