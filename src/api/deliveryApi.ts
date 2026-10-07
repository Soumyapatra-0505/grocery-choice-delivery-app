/**
 * Grocery Choice Delivery App - Delivery Orders API Service
 * Integrates with backend delivery operations endpoints.
 */

import apiClient from './client';
import { DeliveryOrder, DeliveryCompletionRequest } from '@/types';

export const deliveryApi = {
  /**
   * Retrieves active orders assigned to the currently authenticated delivery partner.
   * Backend endpoint: GET /api/delivery/orders/assigned
   * Note: The backend intentionally masks deliveryOtp in this response.
   */
  async getAssignedDeliveries(): Promise<DeliveryOrder[]> {
    const data = await apiClient.get<any, DeliveryOrder[]>('/delivery/orders/assigned');
    return Array.isArray(data) ? data : [];
  },

  /**
   * Accepts a delivery assignment by the assigned delivery partner.
   * Backend endpoint: POST /api/delivery/orders/{id}/accept
   * Note: Order status remains PROCESSING; acceptedAt is timestamped.
   */
  async acceptDelivery(orderId: number): Promise<DeliveryOrder> {
    return apiClient.post<any, DeliveryOrder>(`/delivery/orders/${orderId}/accept`);
  },

  /**
   * Confirms package pickup from store hub by the assigned delivery partner.
   * Backend endpoint: POST /api/delivery/orders/{id}/pickup
   * Note: Order transitions from PROCESSING -> OUT_FOR_DELIVERY; pickedUpAt is timestamped.
   */
  async pickupDelivery(orderId: number): Promise<DeliveryOrder> {
    return apiClient.post<any, DeliveryOrder>(`/delivery/orders/${orderId}/pickup`);
  },

  /**
   * Verifies doorstep delivery verification code entered by the rider.
   * Backend endpoint: POST /api/delivery/orders/{id}/verify-otp
   * Request format: { otp: string }
   * Note: Order remains OUT_FOR_DELIVERY; deliveryOtpVerified is updated to true.
   */
  async verifyDeliveryOtp(orderId: number, otp: string): Promise<DeliveryOrder> {
    return apiClient.post<any, DeliveryOrder>(`/delivery/orders/${orderId}/verify-otp`, {
      otp: otp.trim(),
    });
  },

  /**
   * Completes order delivery (settles COD if applicable, records deliveredAt, marks DELIVERED).
   * Backend endpoint: POST /api/delivery/orders/{id}/complete
   * Request format: DeliveryCompletionRequest { notes?: string, otp?: string, codCollected?: boolean }
   */
  async completeDelivery(
    orderId: number,
    request?: DeliveryCompletionRequest
  ): Promise<DeliveryOrder> {
    return apiClient.post<any, DeliveryOrder>(
      `/delivery/orders/${orderId}/complete`,
      request || {}
    );
  },

  /**
   * Retrieves completed delivery history for the currently authenticated delivery partner.
   * Backend endpoint: GET /api/delivery/orders/history
   * Note: The backend intentionally masks deliveryOtp in this response.
   */
  async getDeliveryHistory(): Promise<DeliveryOrder[]> {
    const data = await apiClient.get<any, DeliveryOrder[]>('/delivery/orders/history');
    return Array.isArray(data) ? data : [];
  },
};

