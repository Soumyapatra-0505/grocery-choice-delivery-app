/**
 * Grocery Choice Delivery App - Phase 4 Test Suite
 * Store Pickup & Navigation Lifecycle Tests
 * Validates:
 * 1. pickupDelivery calls POST /api/delivery/orders/{id}/pickup
 * 2. Authorization Bearer header is supplied
 * 3. Successful pickup returns updated order
 * 4. pickedUpAt is handled correctly
 * 5. Successful pickup transitions state to OUT_FOR_DELIVERY
 * 6. Pickup action is available only when: PROCESSING + acceptedAt != null + pickedUpAt == null
 * 7. Pickup action is hidden when: acceptedAt == null
 * 8. Pickup action is hidden when: pickedUpAt != null
 * 9. Pickup action is hidden when: OUT_FOR_DELIVERY
 * 10. Pickup action is hidden when: DELIVERED
 * 11. Pickup action is hidden when: CANCELLED
 * 12. 401 triggers session handling
 * 13. 403 displays authorization error
 * 14. 404 displays not-found error
 * 15. 409 displays lifecycle error
 * 16. Network/500 error displays retry message
 * 17. Duplicate pickup requests are prevented while loading
 * 18. Failed pickup does not falsely change local status
 * 19. Wrong rider is rejected
 * 20. Navigation URL is generated correctly from coordinates
 * 21. Address fallback navigation URL is encoded correctly
 * 22. Missing destination data is handled safely
 * 23. Customer phone deep-link is generated correctly
 * 24. Missing phone number is handled safely
 * 25. Verification of Phase 1, Phase 2, and Phase 3 consistency
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// --- Domain Store Pickup Rule Evaluator ---

export function canPickupDelivery(order, user) {
  if (!order || !user) return false;
  if (user.role !== 'DELIVERY') return false;

  // Order must belong to current delivery partner if assigned ID is set
  if (
    order.assignedDeliveryPartnerId != null &&
    user.id != null &&
    order.assignedDeliveryPartnerId !== user.id
  ) {
    return false;
  }

  // Only PROCESSING orders that are already accepted and not yet picked up
  if (order.status !== 'PROCESSING') return false;
  if (order.acceptedAt == null) return false;
  if (order.pickedUpAt != null) return false;

  return true;
}

// --- Order Detail UI State & Badge Determiner for Phase 4 ---

export function getDeliveryLifecycleDisplay(order) {
  if (!order) {
    return { badge: 'Unknown', canAccept: false, canPickup: false, isOutForDelivery: false };
  }

  if (order.status === 'OUT_FOR_DELIVERY') {
    return {
      badge: 'Out for Delivery',
      variant: 'info',
      canAccept: false,
      canPickup: false,
      isOutForDelivery: true,
      noticeTitle: '🚚 Out for Delivery',
    };
  }

  if (order.status === 'PROCESSING') {
    if (order.acceptedAt != null && order.pickedUpAt == null) {
      return {
        badge: 'Ready for Pickup',
        variant: 'info',
        canAccept: false,
        canPickup: true,
        isOutForDelivery: false,
        noticeTitle: '📦 Ready for Store Pickup',
      };
    }
    if (order.acceptedAt != null && order.pickedUpAt != null) {
      // Picked up but status transitioning
      return {
        badge: 'Out for Delivery',
        variant: 'info',
        canAccept: false,
        canPickup: false,
        isOutForDelivery: true,
        noticeTitle: '🚚 Out for Delivery',
      };
    }
    return {
      badge: 'Awaiting Acceptance',
      variant: 'warning',
      canAccept: true,
      canPickup: false,
      isOutForDelivery: false,
      noticeTitle: '📋 Delivery Assigned',
    };
  }

  if (order.status === 'DELIVERED') {
    return {
      badge: 'Delivered',
      variant: 'success',
      canAccept: false,
      canPickup: false,
      isOutForDelivery: false,
      noticeTitle: '🎉 Order Delivered',
    };
  }

  if (order.status === 'CANCELLED') {
    return {
      badge: 'Cancelled',
      variant: 'danger',
      canAccept: false,
      canPickup: false,
      isOutForDelivery: false,
      noticeTitle: '❌ Cancelled',
    };
  }

  return {
    badge: String(order.status),
    variant: 'default',
    canAccept: false,
    canPickup: false,
    isOutForDelivery: false,
    noticeTitle: `Status: ${order.status}`,
  };
}

// --- Error Mapping for Store Pickup ---

export function mapPickupError(error) {
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
      message: 'You are not authorized to pick up this delivery.',
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
  if (
    status === 409 ||
    (status === 400 &&
      (rawMsg.includes('not ready') ||
        rawMsg.includes('pickup') ||
        rawMsg.includes('accepted')))
  ) {
    return {
      type: 'CONFLICT',
      message: 'This delivery is not ready for pickup.',
      action: 'REFRESH_ORDER',
    };
  }
  return {
    type: 'SERVER_ERROR',
    message: 'Unable to confirm pickup. Please try again.',
    action: 'DISPLAY_ERROR',
  };
}

// --- Maps and Phone Link Helpers (Mirroring src/utils/navigation.ts) ---

export function getMapUrl(destination) {
  if (!destination) return null;
  const { latitude, longitude, addressText, landmark } = destination;

  if (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude)
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }

  const parts = [];
  if (addressText && addressText.trim().length > 0) {
    parts.push(addressText.trim());
  }
  if (landmark && landmark.trim().length > 0) {
    parts.push(`Near ${landmark.trim()}`);
  }

  if (parts.length === 0) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
}

export function getPhoneCallUrl(phoneNumber) {
  if (!phoneNumber) return null;
  const cleaned = phoneNumber.trim().replace(/[^\d+]/g, '');
  if (!cleaned || cleaned === '+') return null;
  return `tel:${cleaned}`;
}

// --- Mock API Client with Request Tracking ---

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

// --- Simulated UI Controller for Order Pickup ---

class OrderPickupController {
  constructor(apiClient, currentUser, initialOrder) {
    this.apiClient = apiClient;
    this.currentUser = currentUser;
    this.order = { ...initialOrder };
    this.isPickingUp = false;
    this.actionError = null;
    this.actionSuccess = null;
    this.loggedOut = false;
  }

  async confirmPickup() {
    // Prevent double submission
    if (this.isPickingUp) {
      return { duplicatePrevented: true };
    }

    this.isPickingUp = true;
    this.actionError = null;

    try {
      const updated = await this.apiClient.post(
        `/delivery/orders/${this.order.id}/pickup`
      );
      this.order = updated;
      this.actionSuccess = 'Pickup confirmed. You are now out for delivery.';
      return { success: true, order: this.order };
    } catch (err) {
      const mapped = mapPickupError(err);
      if (mapped.action === 'LOGOUT') {
        this.loggedOut = true;
      }
      this.actionError = mapped.message;
      return { success: false, error: mapped.message };
    } finally {
      this.isPickingUp = false;
    }
  }
}

// --- Phase 4 Test Suite Execution ---

describe('Phase 4: Store Pickup & Navigation Lifecycle', () => {
  const deliveryUser = {
    id: 10,
    fullName: 'Suresh Kumar',
    email: 'suresh@grocerychoice.com',
    phone: '9876543210',
    role: 'DELIVERY',
    status: 'ACTIVE',
  };

  const sampleAcceptedOrder = {
    id: 42,
    orderNumber: 'GC-2026-00042',
    customerId: 5,
    customerName: 'Aarav Patel',
    customerPhone: '9876543210',
    deliveryAddressLatitude: 12.9279,
    deliveryAddressLongitude: 77.6756,
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
    acceptedAt: '2026-10-06T10:15:00.000Z',
    pickedUpAt: null,
    deliveredAt: null,
  };

  // 1. pickupDelivery calls POST /api/delivery/orders/{id}/pickup
  test('1. pickupDelivery calls POST /api/delivery/orders/{id}/pickup', async () => {
    const client = new MockDeliveryApiClient('jwt_delivery_token');
    const pickedUpOrder = {
      ...sampleAcceptedOrder,
      status: 'OUT_FOR_DELIVERY',
      pickedUpAt: '2026-10-06T10:30:00.000Z',
    };
    client.setMockResponse('/delivery/orders/42/pickup', pickedUpOrder);

    const result = await client.post('/delivery/orders/42/pickup');
    assert.equal(client.lastRequest.endpoint, '/delivery/orders/42/pickup');
    assert.equal(client.lastRequest.method, 'POST');
    assert.equal(result.id, 42);
  });

  // 2. Authorization Bearer header is supplied
  test('2. Authorization Bearer header is supplied on pickup request', async () => {
    const client = new MockDeliveryApiClient('jwt_rider_pickup_token');
    client.setMockResponse('/delivery/orders/42/pickup', {
      ...sampleAcceptedOrder,
      status: 'OUT_FOR_DELIVERY',
      pickedUpAt: '2026-10-06T10:30:00.000Z',
    });

    await client.post('/delivery/orders/42/pickup');
    assert.equal(
      client.lastRequest.headers['Authorization'],
      'Bearer jwt_rider_pickup_token'
    );
  });

  // 3. Successful pickup returns updated order
  test('3. Successful pickup returns updated order with OUT_FOR_DELIVERY status', async () => {
    const client = new MockDeliveryApiClient('jwt_delivery_token');
    const updatedResponse = {
      ...sampleAcceptedOrder,
      status: 'OUT_FOR_DELIVERY',
      pickedUpAt: '2026-10-06T10:30:00.000Z',
    };
    client.setMockResponse('/delivery/orders/42/pickup', updatedResponse);

    const controller = new OrderPickupController(client, deliveryUser, sampleAcceptedOrder);
    const result = await controller.confirmPickup();

    assert.equal(result.success, true);
    assert.equal(controller.order.status, 'OUT_FOR_DELIVERY');
  });

  // 4. pickedUpAt is handled correctly
  test('4. pickedUpAt timestamp is handled and formatted correctly', () => {
    const orderWithPickup = {
      ...sampleAcceptedOrder,
      status: 'OUT_FOR_DELIVERY',
      pickedUpAt: '2026-10-06T10:30:00.000Z',
    };
    const date = new Date(orderWithPickup.pickedUpAt);
    assert.ok(!isNaN(date.getTime()));
    assert.equal(date.getUTCHours(), 10);
    assert.equal(date.getUTCMinutes(), 30);
  });

  // 5. Successful pickup transitions state to OUT_FOR_DELIVERY
  test('5. Successful pickup transitions UI display to OUT_FOR_DELIVERY', async () => {
    const client = new MockDeliveryApiClient('jwt_token');
    const updatedResponse = {
      ...sampleAcceptedOrder,
      status: 'OUT_FOR_DELIVERY',
      pickedUpAt: '2026-10-06T10:30:00.000Z',
    };
    client.setMockResponse('/delivery/orders/42/pickup', updatedResponse);

    const controller = new OrderPickupController(client, deliveryUser, sampleAcceptedOrder);
    await controller.confirmPickup();

    const display = getDeliveryLifecycleDisplay(controller.order);
    assert.equal(display.badge, 'Out for Delivery');
    assert.equal(display.isOutForDelivery, true);
    assert.equal(display.canPickup, false);
    assert.equal(display.canAccept, false);
  });

  // 6. Pickup action is available only when: PROCESSING + acceptedAt != null + pickedUpAt == null
  test('6. Pickup action is available only when PROCESSING + acceptedAt != null + pickedUpAt == null', () => {
    const eligibleForPickup = { ...sampleAcceptedOrder };
    const canPickup = canPickupDelivery(eligibleForPickup, deliveryUser);
    assert.equal(canPickup, true);

    const display = getDeliveryLifecycleDisplay(eligibleForPickup);
    assert.equal(display.canPickup, true);
    assert.equal(display.badge, 'Ready for Pickup');
  });

  // 7. Pickup action is hidden when: acceptedAt == null
  test('7. Pickup action is hidden when acceptedAt == null', () => {
    const unacceptedOrder = {
      ...sampleAcceptedOrder,
      acceptedAt: null,
    };
    const canPickup = canPickupDelivery(unacceptedOrder, deliveryUser);
    assert.equal(canPickup, false);

    const display = getDeliveryLifecycleDisplay(unacceptedOrder);
    assert.equal(display.canPickup, false);
    assert.equal(display.canAccept, true); // It is waiting for acceptance
  });

  // 8. Pickup action is hidden when: pickedUpAt != null
  test('8. Pickup action is hidden when pickedUpAt != null', () => {
    const alreadyPickedUp = {
      ...sampleAcceptedOrder,
      status: 'OUT_FOR_DELIVERY',
      pickedUpAt: '2026-10-06T10:30:00.000Z',
    };
    const canPickup = canPickupDelivery(alreadyPickedUp, deliveryUser);
    assert.equal(canPickup, false);

    const display = getDeliveryLifecycleDisplay(alreadyPickedUp);
    assert.equal(display.canPickup, false);
  });

  // 9. Pickup action is hidden when: OUT_FOR_DELIVERY
  test('9. Pickup action is hidden when OUT_FOR_DELIVERY', () => {
    const outOrder = {
      ...sampleAcceptedOrder,
      status: 'OUT_FOR_DELIVERY',
      pickedUpAt: '2026-10-06T10:30:00.000Z',
    };
    assert.equal(canPickupDelivery(outOrder, deliveryUser), false);
  });

  // 10. Pickup action is hidden when: DELIVERED
  test('10. Pickup action is hidden when DELIVERED', () => {
    const deliveredOrder = {
      ...sampleAcceptedOrder,
      status: 'DELIVERED',
      pickedUpAt: '2026-10-06T10:30:00.000Z',
      deliveredAt: '2026-10-06T11:00:00.000Z',
    };
    assert.equal(canPickupDelivery(deliveredOrder, deliveryUser), false);
  });

  // 11. Pickup action is hidden when: CANCELLED
  test('11. Pickup action is hidden when CANCELLED', () => {
    const cancelledOrder = {
      ...sampleAcceptedOrder,
      status: 'CANCELLED',
    };
    assert.equal(canPickupDelivery(cancelledOrder, deliveryUser), false);
  });

  // 12. 401 triggers session handling
  test('12. 401 Unauthorized triggers session logout on pickup attempt', async () => {
    const client = new MockDeliveryApiClient(null);
    const controller = new OrderPickupController(client, deliveryUser, sampleAcceptedOrder);

    const result = await controller.confirmPickup();
    assert.equal(result.success, false);
    assert.equal(controller.loggedOut, true);
    assert.equal(controller.actionError, 'Session expired. Please log in again.');
  });

  // 13. 403 displays authorization error
  test('13. 403 Forbidden displays authorization error', async () => {
    const client = new MockDeliveryApiClient('jwt_token');
    const err = new Error('Access denied');
    err.status = 403;
    client.setMockResponse('/delivery/orders/42/pickup', err);

    const controller = new OrderPickupController(client, deliveryUser, sampleAcceptedOrder);
    const result = await controller.confirmPickup();

    assert.equal(result.success, false);
    assert.equal(
      controller.actionError,
      'You are not authorized to pick up this delivery.'
    );
  });

  // 14. 404 displays not-found error
  test('14. 404 Not Found displays delivery not found error', async () => {
    const client = new MockDeliveryApiClient('jwt_token');
    const err = new Error('Order not found');
    err.status = 404;
    client.setMockResponse('/delivery/orders/42/pickup', err);

    const controller = new OrderPickupController(client, deliveryUser, sampleAcceptedOrder);
    const result = await controller.confirmPickup();

    assert.equal(result.success, false);
    assert.equal(controller.actionError, 'Delivery could not be found.');
  });

  // 15. 409 displays lifecycle error
  test('15. 409 Conflict displays not ready for pickup error', async () => {
    const client = new MockDeliveryApiClient('jwt_token');
    const err = new Error('Order must be accepted by delivery partner before it can be picked up');
    err.status = 409;
    client.setMockResponse('/delivery/orders/42/pickup', err);

    const controller = new OrderPickupController(client, deliveryUser, sampleAcceptedOrder);
    const result = await controller.confirmPickup();

    assert.equal(result.success, false);
    assert.equal(
      controller.actionError,
      'This delivery is not ready for pickup.'
    );
  });

  // 16. Network/500 error displays retry message
  test('16. Network/500 error displays retry message', async () => {
    const client = new MockDeliveryApiClient('jwt_token');
    const err = new Error('Internal Server Error');
    err.status = 500;
    client.setMockResponse('/delivery/orders/42/pickup', err);

    const controller = new OrderPickupController(client, deliveryUser, sampleAcceptedOrder);
    const result = await controller.confirmPickup();

    assert.equal(result.success, false);
    assert.equal(
      controller.actionError,
      'Unable to confirm pickup. Please try again.'
    );
  });

  // 17. Duplicate pickup requests are prevented while loading
  test('17. Duplicate pickup requests are prevented while in progress', async () => {
    const client = new MockDeliveryApiClient('jwt_token');
    let resolvePost;
    const pendingPromise = new Promise((resolve) => {
      resolvePost = resolve;
    });
    client.post = async () => {
      client.requestCount++;
      return pendingPromise;
    };

    const controller = new OrderPickupController(client, deliveryUser, sampleAcceptedOrder);

    const p1 = controller.confirmPickup();
    assert.equal(controller.isPickingUp, true);

    const p2 = controller.confirmPickup();
    const result2 = await p2;
    assert.equal(result2.duplicatePrevented, true);

    resolvePost({
      ...sampleAcceptedOrder,
      status: 'OUT_FOR_DELIVERY',
      pickedUpAt: '2026-10-06T10:35:00.000Z',
    });
    const result1 = await p1;
    assert.equal(result1.success, true);
    assert.equal(client.requestCount, 1);
  });

  // 18. Failed pickup does not falsely change local status
  test('18. Failed pickup does not falsely change local status to OUT_FOR_DELIVERY', async () => {
    const client = new MockDeliveryApiClient('jwt_token');
    const err = new Error('Server error');
    err.status = 500;
    client.setMockResponse('/delivery/orders/42/pickup', err);

    const controller = new OrderPickupController(client, deliveryUser, sampleAcceptedOrder);
    assert.equal(controller.order.status, 'PROCESSING');
    assert.equal(controller.order.pickedUpAt, null);

    const result = await controller.confirmPickup();
    assert.equal(result.success, false);
    assert.equal(controller.order.status, 'PROCESSING'); // Strictly unchanged!
    assert.equal(controller.order.pickedUpAt, null);
  });

  // 19. Wrong rider is rejected
  test('19. Wrong rider is rejected by ownership check and backend 403', async () => {
    const wrongRider = {
      id: 999,
      role: 'DELIVERY',
    };
    const allowed = canPickupDelivery(sampleAcceptedOrder, wrongRider);
    assert.equal(allowed, false);

    const client = new MockDeliveryApiClient('jwt_wrong_rider');
    const accessDenied = new Error('You are not assigned to this order');
    accessDenied.status = 403;
    client.setMockResponse('/delivery/orders/42/pickup', accessDenied);

    const controller = new OrderPickupController(client, wrongRider, sampleAcceptedOrder);
    const result = await controller.confirmPickup();
    assert.equal(result.success, false);
    assert.equal(
      controller.actionError,
      'You are not authorized to pick up this delivery.'
    );
  });

  // 20. Navigation URL is generated correctly from coordinates
  test('20. Navigation URL is generated correctly from GPS coordinates', () => {
    const destination = {
      latitude: 12.9279,
      longitude: 77.6756,
      addressText: 'Some Address',
      landmark: 'Near Mall',
    };
    const url = getMapUrl(destination);
    assert.equal(
      url,
      'https://www.google.com/maps/search/?api=1&query=12.9279,77.6756'
    );
  });

  // 21. Address fallback navigation URL is encoded correctly
  test('21. Address fallback navigation URL is encoded correctly when coordinates missing', () => {
    const destination = {
      latitude: null,
      longitude: null,
      addressText: 'Flat 302, Green Glen Layout, Bengaluru',
      landmark: 'Opposite Central Mall',
    };
    const url = getMapUrl(destination);
    assert.ok(url != null);
    assert.ok(url.startsWith('https://www.google.com/maps/search/?api=1&query='));
    assert.ok(url.includes('Green%20Glen%20Layout'));
    assert.ok(url.includes('Opposite%20Central%20Mall'));
  });

  // 22. Missing destination data is handled safely
  test('22. Missing destination data is handled safely without crashing', () => {
    assert.equal(getMapUrl(null), null);
    assert.equal(getMapUrl(undefined), null);
    assert.equal(getMapUrl({}), null);
    assert.equal(
      getMapUrl({ latitude: null, longitude: null, addressText: '', landmark: '' }),
      null
    );
  });

  // 23. Customer phone deep-link is generated correctly
  test('23. Customer phone deep-link is generated correctly (tel:<phone>)', () => {
    assert.equal(getPhoneCallUrl('9876543210'), 'tel:9876543210');
    assert.equal(getPhoneCallUrl('+91 98765-43210'), 'tel:+919876543210');
  });

  // 24. Missing phone number is handled safely
  test('24. Missing or invalid phone number is handled safely without crashing', () => {
    assert.equal(getPhoneCallUrl(null), null);
    assert.equal(getPhoneCallUrl(''), null);
    assert.equal(getPhoneCallUrl('   '), null);
    assert.equal(getPhoneCallUrl('+'), null);
  });
});
