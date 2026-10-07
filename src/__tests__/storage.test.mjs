import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Storage & In-Memory Fallback Reliability (Delivery App)', () => {
  const memoryFallback = new Map();

  const mockStorage = {
    async getItem(key) {
      return memoryFallback.get(key) ?? null;
    },
    async setItem(key, value) {
      memoryFallback.set(key, value);
    },
    async removeItem(key) {
      memoryFallback.delete(key);
    },
    async clear() {
      memoryFallback.clear();
    },
  };

  test('Stores and retrieves delivery auth token properly', async () => {
    await mockStorage.setItem('grocery_choice_delivery_auth_token', 'delivery_jwt_sample_token');
    const token = await mockStorage.getItem('grocery_choice_delivery_auth_token');
    assert.equal(token, 'delivery_jwt_sample_token');
  });

  test('Stores and retrieves delivery user profile JSON properly', async () => {
    const profile = {
      id: 10,
      fullName: 'Suresh Kumar',
      email: 'suresh@grocerychoice.com',
      phone: '9876543210',
      role: 'DELIVERY',
      status: 'ACTIVE',
      storeHub: 'Indiranagar Hub',
    };
    await mockStorage.setItem('grocery_choice_delivery_auth_profile', JSON.stringify(profile));
    const raw = await mockStorage.getItem('grocery_choice_delivery_auth_profile');
    assert.ok(raw);
    const parsed = JSON.parse(raw);
    assert.equal(parsed.fullName, 'Suresh Kumar');
    assert.equal(parsed.role, 'DELIVERY');
    assert.equal(parsed.storeHub, 'Indiranagar Hub');
  });

  test('Removes delivery auth token on logout', async () => {
    await mockStorage.setItem('grocery_choice_delivery_auth_token', 'active_token');
    await mockStorage.removeItem('grocery_choice_delivery_auth_token');
    const token = await mockStorage.getItem('grocery_choice_delivery_auth_token');
    assert.equal(token, null);
  });

  test('Clears all keys properly on full cache reset', async () => {
    await mockStorage.setItem('token', 'sample');
    await mockStorage.setItem('profile', 'sample_profile');
    await mockStorage.clear();
    assert.equal(await mockStorage.getItem('token'), null);
    assert.equal(await mockStorage.getItem('profile'), null);
  });
});
