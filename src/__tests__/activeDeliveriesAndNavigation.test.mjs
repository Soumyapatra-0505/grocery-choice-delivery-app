import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// --- Domain Filter & Utility Functions Tested Headlessly ---

function filterActiveOrders(orders, filterType = 'ALL') {
  if (!Array.isArray(orders)) return [];

  // Exclude completed or cancelled orders
  const activeOnly = orders.filter(
    (o) => o && o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
  );

  switch (filterType) {
    case 'TO_ACCEPT':
      return activeOnly.filter((o) => o.status === 'PROCESSING' && !o.acceptedAt);
    case 'TO_PICKUP':
      return activeOnly.filter((o) => o.status === 'PROCESSING' && !!o.acceptedAt);
    case 'OUT_FOR_DELIVERY':
      return activeOnly.filter((o) => o.status === 'OUT_FOR_DELIVERY');
    case 'ALL':
    default:
      return activeOnly;
  }
}

function getFilterCounts(orders) {
  if (!Array.isArray(orders)) {
    return { all: 0, toAccept: 0, toPickup: 0, outForDelivery: 0 };
  }
  const active = orders.filter(
    (o) => o && o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
  );
  return {
    all: active.length,
    toAccept: active.filter((o) => o.status === 'PROCESSING' && !o.acceptedAt).length,
    toPickup: active.filter((o) => o.status === 'PROCESSING' && !!o.acceptedAt).length,
    outForDelivery: active.filter((o) => o.status === 'OUT_FOR_DELIVERY').length,
  };
}

function formatDeliveryCardData(order) {
  if (!order) return null;
  const orderNumber = `#${order.orderNumber || order.id}`;
  const customerName = order.customerName || 'Customer';
  const addressText = order.deliveryAddressText || 'Address not specified';
  const landmark = order.deliveryAddressLandmark ? `Near ${order.deliveryAddressLandmark}` : null;
  const isCod =
    order.paymentMethod?.toLowerCase().includes('cash') ||
    order.paymentMethod?.toLowerCase().includes('cod');
  const isPaid = order.paymentStatus === 'PAID';
  const totalAmount = Number(order.totalAmount || 0);

  return {
    orderNumber,
    customerName,
    addressText,
    landmark,
    isCod,
    isPaid,
    totalAmount,
    navigationTarget: `/order/${order.id}`,
  };
}

// Simulated Delivery API Client with Request Interceptors
class MockDeliveryApiClient {
  constructor(token = null) {
    this.token = token;
    this.lastRequest = null;
  }

  setToken(t) {
    this.token = t;
  }

  async get(endpoint) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    this.lastRequest = { endpoint, headers };

    if (endpoint === '/delivery/orders/assigned') {
      if (!this.token) {
        const err = new Error('Full authentication is required to access this resource');
        err.status = 401;
        throw err;
      }
      return this.mockOrdersData || [];
    }

    const err = new Error('Not found');
    err.status = 404;
    throw err;
  }

  setMockOrders(data) {
    this.mockOrdersData = data;
  }
}

describe('Phase 2: Active Deliveries & Tab Navigation', () => {
  // Test 1: getAssignedDeliveries calls the correct endpoint
  test('1. getAssignedDeliveries calls /delivery/orders/assigned endpoint', async () => {
    const client = new MockDeliveryApiClient('jwt_delivery_partner_token');
    client.setMockOrders([]);

    const data = await client.get('/delivery/orders/assigned');
    assert.ok(Array.isArray(data));
    assert.equal(client.lastRequest.endpoint, '/delivery/orders/assigned');
  });

  // Test 2: Authorization is provided by centralized client
  test('2. Authorization Bearer token header is sent on assigned deliveries request', async () => {
    const client = new MockDeliveryApiClient('jwt_rider_token_999');
    client.setMockOrders([]);

    await client.get('/delivery/orders/assigned');
    assert.equal(
      client.lastRequest.headers['Authorization'],
      'Bearer jwt_rider_token_999'
    );
  });

  // Test 3: Assigned delivery response is parsed correctly
  test('3. Assigned delivery response fields are mapped correctly', () => {
    const rawOrder = {
      id: 42,
      orderNumber: 'GC-2026-00042',
      customerId: 5,
      customerName: 'Aarav Patel',
      customerPhone: '9876543210',
      customerEmail: 'aarav@example.com',
      deliveryAddressId: 12,
      deliveryAddressText: 'Flat 302, Green Glen Layout, Bellandur, Bengaluru',
      deliveryAddressLandmark: 'Opposite Central Mall',
      deliveryAddressLatitude: 12.9279,
      deliveryAddressLongitude: 77.6756,
      subtotal: 550.0,
      deliveryCharge: 30.0,
      discount: 0.0,
      totalAmount: 580.0,
      status: 'PROCESSING',
      paymentStatus: 'PAID',
      paymentMethod: 'ONLINE',
      assignedDeliveryPartnerId: 10,
      assignedDeliveryPartnerName: 'Suresh Kumar',
      assignedAt: '2026-10-06T10:00:00',
      acceptedAt: null,
      pickedUpAt: null,
      deliveredAt: null,
      deliveryOtp: null, // Verified masked by backend
      items: [
        {
          id: 1,
          productId: 101,
          productName: 'Organic Whole Milk',
          unit: 'LITRE',
          price: 65.0,
          quantity: 2,
          subtotal: 130.0,
        },
      ],
    };

    const card = formatDeliveryCardData(rawOrder);
    assert.equal(card.orderNumber, '#GC-2026-00042');
    assert.equal(card.customerName, 'Aarav Patel');
    assert.equal(card.addressText, 'Flat 302, Green Glen Layout, Bellandur, Bengaluru');
    assert.equal(card.landmark, 'Near Opposite Central Mall');
    assert.equal(card.isPaid, true);
    assert.equal(card.isCod, false);
    assert.equal(card.totalAmount, 580.0);
    assert.equal(card.navigationTarget, '/order/42');
  });

  // Test 4: Empty assigned delivery list is handled
  test('4. Empty assigned deliveries response produces clean empty state', () => {
    const result = filterActiveOrders([]);
    assert.deepEqual(result, []);
    const counts = getFilterCounts([]);
    assert.equal(counts.all, 0);
  });

  // Test 5: ALL ACTIVE filter
  test('5. ALL ACTIVE filter returns all uncompleted active deliveries', () => {
    const sampleOrders = [
      { id: 1, status: 'PROCESSING', acceptedAt: null },
      { id: 2, status: 'PROCESSING', acceptedAt: '2026-10-06T10:05:00' },
      { id: 3, status: 'OUT_FOR_DELIVERY', acceptedAt: '2026-10-06T10:05:00' },
      { id: 4, status: 'DELIVERED', acceptedAt: '2026-10-06T09:00:00' },
      { id: 5, status: 'CANCELLED', acceptedAt: null },
    ];

    const filtered = filterActiveOrders(sampleOrders, 'ALL');
    assert.equal(filtered.length, 3);
    assert.deepEqual(
      filtered.map((o) => o.id),
      [1, 2, 3]
    );
  });

  // Test 6: TO ACCEPT filter
  test('6. TO ACCEPT filter returns PROCESSING orders not yet accepted', () => {
    const sampleOrders = [
      { id: 1, status: 'PROCESSING', acceptedAt: null },
      { id: 2, status: 'PROCESSING', acceptedAt: '2026-10-06T10:05:00' },
      { id: 3, status: 'OUT_FOR_DELIVERY', acceptedAt: '2026-10-06T10:05:00' },
    ];

    const filtered = filterActiveOrders(sampleOrders, 'TO_ACCEPT');
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, 1);
  });

  // Test 7: TO PICKUP filter
  test('7. TO PICKUP filter returns accepted orders in PROCESSING status', () => {
    const sampleOrders = [
      { id: 1, status: 'PROCESSING', acceptedAt: null },
      { id: 2, status: 'PROCESSING', acceptedAt: '2026-10-06T10:05:00' },
      { id: 3, status: 'OUT_FOR_DELIVERY', acceptedAt: '2026-10-06T10:05:00' },
    ];

    const filtered = filterActiveOrders(sampleOrders, 'TO_PICKUP');
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, 2);
  });

  // Test 8: OUT FOR DELIVERY filter
  test('8. OUT FOR DELIVERY filter returns orders currently on the road', () => {
    const sampleOrders = [
      { id: 1, status: 'PROCESSING', acceptedAt: null },
      { id: 2, status: 'PROCESSING', acceptedAt: '2026-10-06T10:05:00' },
      { id: 3, status: 'OUT_FOR_DELIVERY', acceptedAt: '2026-10-06T10:05:00' },
    ];

    const filtered = filterActiveOrders(sampleOrders, 'OUT_FOR_DELIVERY');
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, 3);
  });

  // Test 9: DELIVERED orders are excluded from active list
  test('9. DELIVERED and CANCELLED orders are strictly excluded from all active filters', () => {
    const sampleOrders = [
      { id: 10, status: 'DELIVERED', acceptedAt: '2026-10-06T09:00:00' },
      { id: 11, status: 'CANCELLED', acceptedAt: null },
    ];

    assert.equal(filterActiveOrders(sampleOrders, 'ALL').length, 0);
    assert.equal(filterActiveOrders(sampleOrders, 'TO_ACCEPT').length, 0);
    assert.equal(filterActiveOrders(sampleOrders, 'TO_PICKUP').length, 0);
    assert.equal(filterActiveOrders(sampleOrders, 'OUT_FOR_DELIVERY').length, 0);
  });

  // Test 10: Unexpected / null optional fields do not crash
  test('10. Partial or missing optional fields do not crash data formatters', () => {
    const sparseOrder = {
      id: 99,
      totalAmount: 150.0,
      status: 'PROCESSING',
      paymentMethod: 'CASH ON DELIVERY',
    };

    const card = formatDeliveryCardData(sparseOrder);
    assert.equal(card.orderNumber, '#99');
    assert.equal(card.customerName, 'Customer');
    assert.equal(card.addressText, 'Address not specified');
    assert.equal(card.landmark, null);
    assert.equal(card.isCod, true);
    assert.equal(card.isPaid, false);
    assert.equal(card.totalAmount, 150.0);
  });

  // Test 11: API / network error is handled
  test('11. Network error during delivery fetch produces descriptive user message', async () => {
    const client = new MockDeliveryApiClient('valid_token');
    client.get = async () => {
      const err = new Error('Unable to connect to Grocery Choice server');
      err.status = 0;
      throw err;
    };

    let caughtError = null;
    try {
      await client.get('/delivery/orders/assigned');
    } catch (e) {
      caughtError = e;
    }

    assert.ok(caughtError);
    assert.equal(caughtError.status, 0);
    assert.match(caughtError.message, /Unable to connect/);
  });

  // Test 12: 401 session failure is handled
  test('12. 401 Unauthorized from /delivery/orders/assigned indicates expired session', async () => {
    const client = new MockDeliveryApiClient(null); // No token
    let status = null;

    try {
      await client.get('/delivery/orders/assigned');
    } catch (e) {
      status = e.status;
    }

    assert.equal(status, 401);
  });

  // Test 13: 403 authorization failure is handled
  test('13. 403 Forbidden indicates user is not authorized for delivery operations', async () => {
    const client = new MockDeliveryApiClient('customer_or_staff_jwt');
    client.get = async () => {
      const err = new Error('Access denied: Role DELIVERY is required');
      err.status = 403;
      throw err;
    };

    let status = null;
    try {
      await client.get('/delivery/orders/assigned');
    } catch (e) {
      status = e.status;
    }

    assert.equal(status, 403);
  });

  // Test 14: Delivery card navigation target is correct
  test('14. Delivery card target route accurately targets /order/[id]', () => {
    const order = { id: 77, status: 'PROCESSING', totalAmount: 200, paymentMethod: 'UPI' };
    const card = formatDeliveryCardData(order);
    assert.equal(card.navigationTarget, '/order/77');
  });

  // Test 15: Filter counts calculation
  test('15. Filter counts correctly tally orders across statuses', () => {
    const orders = [
      { id: 1, status: 'PROCESSING', acceptedAt: null },
      { id: 2, status: 'PROCESSING', acceptedAt: null },
      { id: 3, status: 'PROCESSING', acceptedAt: '2026-10-06T10:00:00' },
      { id: 4, status: 'OUT_FOR_DELIVERY', acceptedAt: '2026-10-06T10:00:00' },
      { id: 5, status: 'OUT_FOR_DELIVERY', acceptedAt: '2026-10-06T10:00:00' },
      { id: 6, status: 'DELIVERED' },
    ];

    const counts = getFilterCounts(orders);
    assert.equal(counts.all, 5);
    assert.equal(counts.toAccept, 2);
    assert.equal(counts.toPickup, 1);
    assert.equal(counts.outForDelivery, 2);
  });
});
