/**
 * Grocery Choice Delivery App - Maps Navigation & Phone Calling Utilities
 * Provides platform-compatible deep-linking for destination maps and customer calls.
 * Does not require external SDKs or API keys.
 */

import { Linking } from 'react-native';

export interface DestinationInfo {
  latitude?: number | null;
  longitude?: number | null;
  addressText?: string | null;
  landmark?: string | null;
}

/**
 * Constructs a cross-platform Google Maps search/navigation URL.
 * Prefers exact GPS coordinates when available; falls back to URL-encoded address & landmark.
 * Returns null if no usable destination data exists.
 */
export function getMapUrl(destination?: DestinationInfo | null): string | null {
  if (!destination) return null;

  const { latitude, longitude, addressText, landmark } = destination;

  // 1. Prefer GPS coordinates when both latitude and longitude are valid numbers
  if (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude)
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }

  // 2. Address fallback with optional landmark
  const addressParts: string[] = [];
  if (addressText && addressText.trim().length > 0) {
    addressParts.push(addressText.trim());
  }
  if (landmark && landmark.trim().length > 0) {
    addressParts.push(`Near ${landmark.trim()}`);
  }

  if (addressParts.length === 0) {
    return null;
  }

  const query = addressParts.join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Opens native map navigation or browser map for the given destination.
 */
export async function openMapNavigation(
  destination?: DestinationInfo | null
): Promise<{ success: boolean; error?: string; url?: string }> {
  const url = getMapUrl(destination);
  if (!url) {
    return {
      success: false,
      error: 'Destination information is unavailable.',
    };
  }

  try {
    const supported = await Linking.canOpenURL(url).catch(() => true);
    if (supported) {
      await Linking.openURL(url);
      return { success: true, url };
    }
    return {
      success: false,
      error: 'Unable to open maps on this device.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Unable to open maps navigation.',
    };
  }
}

/**
 * Constructs a native phone deep-link (tel:<phone>).
 * Strips whitespace/hyphens and safely validates numbers.
 * Returns null if phone number is missing or empty.
 */
export function getPhoneCallUrl(phoneNumber?: string | null): string | null {
  if (!phoneNumber) return null;
  const cleaned = phoneNumber.trim().replace(/[^\d+]/g, '');
  if (!cleaned || cleaned === '+') return null;
  return `tel:${cleaned}`;
}

/**
 * Opens device dialer with the customer phone number pre-filled.
 */
export async function callCustomerPhone(
  phoneNumber?: string | null
): Promise<{ success: boolean; error?: string; url?: string }> {
  const url = getPhoneCallUrl(phoneNumber);
  if (!url) {
    return {
      success: false,
      error: 'Customer phone number is unavailable.',
    };
  }

  try {
    const supported = await Linking.canOpenURL(url).catch(() => true);
    if (supported) {
      await Linking.openURL(url);
      return { success: true, url };
    }
    return {
      success: false,
      error: 'Phone calls are not supported on this device.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Unable to place call.',
    };
  }
}
