/**
 * Grocery Choice Delivery App - Core Type Definitions
 */

export type Role = 'CUSTOMER' | 'STAFF' | 'ADMIN' | 'OWNER' | 'DELIVERY';

export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface User {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  status: UserStatus;
  designation?: string | null;
  storeHub?: string | null;
  primaryOwner?: boolean;
  permissions?: string[];
  createdAt?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: User;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface SendOtpRequest {
  identifier: string;
}

export interface SendOtpResponse {
  success: boolean;
  message: string;
  target?: string;
  channel?: string;
  expirySeconds?: number;
  resendCooldownSeconds?: number;
}

export interface VerifyOtpRequest {
  identifier: string;
  otp: string;
}

export interface SessionState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// --- Order & Delivery Types ---

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface DeliveryOrderItem {
  id: number;
  productId: number;
  productName: string;
  unit?: string | null;
  price: number;
  quantity: number;
  subtotal: number;
  imageUrl?: string | null;
}

export interface DeliveryOrder {
  id: number;
  orderNumber: string;
  customerId?: number | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  deliveryAddressId?: number | null;
  deliveryAddressText?: string | null;
  deliveryAddressLandmark?: string | null;
  deliveryAddressLatitude?: number | null;
  deliveryAddressLongitude?: number | null;
  subtotal?: number | null;
  deliveryCharge?: number | null;
  discount?: number | null;
  totalAmount: number;
  status: OrderStatus | string;
  paymentStatus: PaymentStatus | string;
  paymentMethod: string;
  deliverySlot?: string | null;
  assignedDeliveryPartnerId?: number | null;
  assignedDeliveryPartnerName?: string | null;
  assignedDeliveryPartnerPhone?: string | null;
  assignedAt?: string | null;
  acceptedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  deliveryNotes?: string | null;
  deliveryOtpVerified?: boolean | null;
  deliveryOtpVerifiedAt?: string | null;
  codCollected?: boolean | null;
  codCollectedAt?: string | null;
  items?: DeliveryOrderItem[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface DeliveryOtpVerifyRequest {
  otp: string;
}

export interface DeliveryCompletionRequest {
  notes?: string;
  otp?: string;
  codCollected?: boolean;
}

export type ActiveDeliveryFilter = 'ALL' | 'TO_ACCEPT' | 'TO_PICKUP' | 'OUT_FOR_DELIVERY';
