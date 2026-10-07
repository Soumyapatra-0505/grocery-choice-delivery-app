/**
 * Grocery Choice Delivery App - Order Detail Screen (Phase 5 Doorstep OTP Verification & COD Handling)
 * Provides comprehensive read-only delivery metadata, customer navigation/calling utilities,
 * and doorstep verification lifecycle transitions:
 * ASSIGNED -> ACCEPT DELIVERY -> ACCEPTED (PROCESSING) -> CONFIRM STORE PICKUP -> OUT_FOR_DELIVERY
 * -> VERIFY DELIVERY OTP -> OTP VERIFIED (COD / PREPAID HANDLING) -> READY FOR COMPLETION.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { deliveryApi } from '@/api/deliveryApi';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/common/Badge';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { useAuth } from '@/context/AuthContext';
import { colors, spacing } from '@/theme';
import { DeliveryOrder, DeliveryCompletionRequest } from '@/types';
import {
  openMapNavigation,
  callCustomerPhone,
  getMapUrl,
} from '@/utils/navigation';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [order, setOrder] = useState<DeliveryOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Phase 3 Acceptance State
  const [showConfirmAcceptModal, setShowConfirmAcceptModal] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);

  // Phase 4 Store Pickup State
  const [showConfirmPickupModal, setShowConfirmPickupModal] = useState(false);
  const [isPickingUp, setIsPickingUp] = useState(false);

  // Phase 5 Doorstep OTP State
  const [otpInput, setOtpInput] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpValidationError, setOtpValidationError] = useState<string | null>(null);

  // Phase 6 Delivery Completion & COD State
  const [hasConfirmedCash, setHasConfirmedCash] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [showConfirmCompleteModal, setShowConfirmCompleteModal] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // General Action Feedback State
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const assignedList = await deliveryApi.getAssignedDeliveries();
      const found = assignedList.find((o) => String(o.id) === String(id));
      if (found) {
        setOrder(found);
      } else {
        setErrorMessage(`Order #${id} was not found in your assigned deliveries.`);
      }
    } catch (err: any) {
      if (err?.status === 401) {
        await logout();
        router.replace('/(auth)/login' as any);
        return;
      }
      setErrorMessage(
        err?.message || 'Unable to load delivery details. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [id, logout, router]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  // --- Phase 3: Acceptance Handlers ---

  const handleOpenAcceptModal = () => {
    setActionError(null);
    setShowConfirmAcceptModal(true);
  };

  const handleCancelAccept = () => {
    if (isAccepting) return;
    setShowConfirmAcceptModal(false);
  };

  const handleConfirmAccept = async () => {
    if (!order || isAccepting) return;

    setIsAccepting(true);
    setActionError(null);

    try {
      const updatedOrder = await deliveryApi.acceptDelivery(order.id);
      setOrder(updatedOrder);
      setActionSuccess('Delivery accepted successfully! Ready for store pickup.');
      setShowConfirmAcceptModal(false);
    } catch (err: any) {
      setShowConfirmAcceptModal(false);
      const status = err?.status;
      const rawMessage = String(err?.message || '').toLowerCase();

      if (status === 401) {
        await logout();
        router.replace('/(auth)/login' as any);
        return;
      }

      if (status === 403) {
        setActionError('You are not authorized to accept this delivery.');
      } else if (status === 404) {
        setActionError('Delivery could not be found.');
      } else if (status === 409 || (status === 400 && rawMessage.includes('already'))) {
        try {
          const freshList = await deliveryApi.getAssignedDeliveries();
          const syncFound = freshList.find((o) => String(o.id) === String(order.id));
          if (syncFound && syncFound.acceptedAt) {
            setOrder(syncFound);
            setActionSuccess('Delivery is already accepted.');
            return;
          }
        } catch {
          // fallback to conflict message
        }
        setActionError('This delivery can no longer be accepted.');
      } else {
        setActionError('Unable to accept delivery. Please try again.');
      }
    } finally {
      setIsAccepting(false);
    }
  };

  // --- Phase 4: Pickup Handlers ---

  const handleOpenPickupModal = () => {
    setActionError(null);
    setShowConfirmPickupModal(true);
  };

  const handleCancelPickup = () => {
    if (isPickingUp) return;
    setShowConfirmPickupModal(false);
  };

  const handleConfirmPickup = async () => {
    if (!order || isPickingUp) return;

    setIsPickingUp(true);
    setActionError(null);

    try {
      const updatedOrder = await deliveryApi.pickupDelivery(order.id);
      setOrder(updatedOrder);
      setActionSuccess('Pickup confirmed. You are now out for delivery.');
      setShowConfirmPickupModal(false);
    } catch (err: any) {
      setShowConfirmPickupModal(false);
      const status = err?.status;
      const rawMessage = String(err?.message || '').toLowerCase();

      if (status === 401) {
        await logout();
        router.replace('/(auth)/login' as any);
        return;
      }

      if (status === 403) {
        setActionError('You are not authorized to pick up this delivery.');
      } else if (status === 404) {
        setActionError('Delivery could not be found.');
      } else if (
        status === 409 ||
        (status === 400 &&
          (rawMessage.includes('not ready') ||
            rawMessage.includes('pickup') ||
            rawMessage.includes('accepted')))
      ) {
        try {
          const freshList = await deliveryApi.getAssignedDeliveries();
          const syncFound = freshList.find((o) => String(o.id) === String(order.id));
          if (syncFound && syncFound.status === 'OUT_FOR_DELIVERY') {
            setOrder(syncFound);
            setActionSuccess('Pickup confirmed. You are now out for delivery.');
            return;
          }
        } catch {
          // fallback to conflict message
        }
        setActionError('This delivery is not ready for pickup.');
      } else {
        setActionError('Unable to confirm pickup. Please try again.');
      }
    } finally {
      setIsPickingUp(false);
    }
  };

  // --- Phase 5: Doorstep OTP Verification Handlers ---

  const handleOtpInputChange = (text: string) => {
    // Exactly numeric digits only, max length 4
    const cleaned = text.replace(/[^\d]/g, '').slice(0, 4);
    setOtpInput(cleaned);
    setOtpValidationError(null);
  };

  const handleVerifyOtp = async () => {
    if (!order || isVerifyingOtp) return;

    if (otpInput.length < 4) {
      setOtpValidationError('Enter the 4-digit delivery OTP.');
      return;
    }

    setIsVerifyingOtp(true);
    setActionError(null);
    setOtpValidationError(null);

    try {
      const updatedOrder = await deliveryApi.verifyDeliveryOtp(order.id, otpInput);
      setOrder(updatedOrder);
      setOtpInput('');
      setActionSuccess('Delivery OTP verified successfully.');
    } catch (err: any) {
      const status = err?.status;
      const rawMessage = String(err?.message || '').toLowerCase();

      if (status === 401) {
        await logout();
        router.replace('/(auth)/login' as any);
        return;
      }

      if (status === 403) {
        setActionError('You are not authorized to verify this delivery.');
      } else if (status === 404) {
        setActionError('Delivery could not be found.');
      } else if (status === 409 || (status === 400 && rawMessage.includes('out_for_delivery'))) {
        setActionError('This delivery is not ready for OTP verification.');
      } else if (
        status === 400 ||
        rawMessage.includes('invalid') ||
        rawMessage.includes('code') ||
        rawMessage.includes('otp') ||
        rawMessage.includes('incorrect')
      ) {
        setActionError('Incorrect delivery OTP. Please ask the customer to confirm the OTP.');
      } else {
        setActionError('Unable to verify OTP. Please try again.');
      }
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // --- Phase 6: Delivery Completion Handlers ---

  const handleToggleCashConfirmed = () => {
    if (isCompleting) return;
    setHasConfirmedCash((prev) => !prev);
  };

  const handleOpenCompleteModal = () => {
    setActionError(null);
    const isCurrentCod =
      order?.paymentMethod?.toLowerCase().includes('cash') ||
      order?.paymentMethod?.toLowerCase().includes('cod');
    if (isCurrentCod && !hasConfirmedCash) {
      setActionError('Please confirm cash collection before completing delivery.');
      return;
    }
    setShowConfirmCompleteModal(true);
  };

  const handleCancelComplete = () => {
    if (isCompleting) return;
    setShowConfirmCompleteModal(false);
  };

  const handleConfirmComplete = async () => {
    if (!order || isCompleting) return;

    setIsCompleting(true);
    setActionError(null);

    const isCurrentCod =
      order?.paymentMethod?.toLowerCase().includes('cash') ||
      order?.paymentMethod?.toLowerCase().includes('cod');

    try {
      const payload: DeliveryCompletionRequest = {
        codCollected: isCurrentCod ? true : false,
        notes: deliveryNotes.trim().length > 0 ? deliveryNotes.trim() : undefined,
      };

      const updatedOrder = await deliveryApi.completeDelivery(order.id, payload);
      setOrder(updatedOrder);
      setShowConfirmCompleteModal(false);
      setActionSuccess('Delivery completed successfully.');
    } catch (err: any) {
      setShowConfirmCompleteModal(false);
      const status = err?.status;
      const rawMessage = String(err?.message || '').toLowerCase();

      if (status === 401) {
        await logout();
        router.replace('/(auth)/login' as any);
        return;
      }

      if (status === 403) {
        setActionError('You are not authorized to complete this delivery.');
      } else if (status === 404) {
        setActionError('Delivery could not be found.');
      } else if (
        status === 409 ||
        rawMessage.includes('already been delivered') ||
        rawMessage.includes('already delivered')
      ) {
        // Idempotency: safely resync order state
        try {
          const assignedList = await deliveryApi.getAssignedDeliveries();
          const refreshed = assignedList.find((o) => String(o.id) === String(order.id));
          if (refreshed) {
            setOrder(refreshed);
          } else {
            // Completed orders are excluded from assigned list, so mark as delivered locally
            setOrder((prev) =>
              prev
                ? {
                    ...prev,
                    status: 'DELIVERED',
                    deliveredAt: prev.deliveredAt || new Date().toISOString(),
                    paymentStatus: isCurrentCod ? 'PAID' : prev.paymentStatus,
                    codCollected: isCurrentCod ? true : prev.codCollected,
                  }
                : null
            );
          }
          setActionSuccess('Delivery completed successfully.');
          return;
        } catch {
          setActionError('This delivery cannot be completed in its current state.');
        }
      } else if (status === 400) {
        if (rawMessage.includes('out_for_delivery') || rawMessage.includes('otp')) {
          setActionError('This delivery cannot be completed in its current state.');
        } else if (rawMessage.includes('cash collection')) {
          setActionError('Cash collection must be confirmed for Cash on Delivery orders.');
        } else {
          setActionError(
            err?.message || 'Unable to complete delivery. Please check details and try again.'
          );
        }
      } else {
        setActionError('Unable to complete delivery. Please try again.');
      }
    } finally {
      setIsCompleting(false);
    }
  };

  // --- Utility Navigation & Phone Handlers ---

  const handleNavigate = async () => {
    if (!order) return;
    setActionError(null);
    const dest = {
      latitude: order.deliveryAddressLatitude,
      longitude: order.deliveryAddressLongitude,
      addressText: order.deliveryAddressText,
      landmark: order.deliveryAddressLandmark,
    };

    const navResult = await openMapNavigation(dest);
    if (!navResult.success) {
      setActionError(navResult.error || 'Destination information is unavailable.');
    }
  };

  const handleCallCustomer = async () => {
    if (!order) return;
    setActionError(null);
    if (!order.customerPhone) {
      setActionError('Customer phone number is unavailable.');
      return;
    }

    const callResult = await callCustomerPhone(order.customerPhone);
    if (!callResult.success) {
      setActionError(callResult.error || 'Customer phone number is unavailable.');
    }
  };

  // --- Timestamp Formatter ---

  const formatTimestamp = (iso?: string | null) => {
    if (!iso) return 'Pending / Not set';
    try {
      const date = new Date(iso);
      if (isNaN(date.getTime())) return 'Pending / Not set';
      return date.toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return 'Pending / Not set';
    }
  };

  // --- Lifecycle & Payment State Evaluation ---

  const isAssignedToCurrentRider =
    !order?.assignedDeliveryPartnerId ||
    (user?.id != null && order.assignedDeliveryPartnerId === user.id);

  // Accept Eligibility
  const canAccept =
    user?.role === 'DELIVERY' &&
    isAssignedToCurrentRider &&
    order?.status === 'PROCESSING' &&
    order?.acceptedAt == null;

  // Pickup Eligibility
  const canPickup =
    user?.role === 'DELIVERY' &&
    isAssignedToCurrentRider &&
    order?.status === 'PROCESSING' &&
    order?.acceptedAt != null &&
    order?.pickedUpAt == null;

  const isOutForDelivery = order?.status === 'OUT_FOR_DELIVERY';
  const isOtpVerified = isOutForDelivery && !!order?.deliveryOtpVerified;
  const canVerifyOtp =
    user?.role === 'DELIVERY' &&
    isAssignedToCurrentRider &&
    isOutForDelivery &&
    !order?.deliveryOtpVerified;

  const isDelivered = order?.status === 'DELIVERED';
  const isCancelled = order?.status === 'CANCELLED';

  const isCod =
    order?.paymentMethod?.toLowerCase().includes('cash') ||
    order?.paymentMethod?.toLowerCase().includes('cod');
  const isPaid = order?.paymentStatus === 'PAID';
  const isPrepaid = isPaid || (!isCod && order?.paymentMethod?.toLowerCase().includes('online'));

  // Completion Eligibility (Phase 6)
  const canComplete =
    user?.role === 'DELIVERY' &&
    isAssignedToCurrentRider &&
    isOutForDelivery &&
    isOtpVerified &&
    (!isCod || hasConfirmedCash);

  const hasDestination =
    !!getMapUrl({
      latitude: order?.deliveryAddressLatitude,
      longitude: order?.deliveryAddressLongitude,
      addressText: order?.deliveryAddressText,
      landmark: order?.deliveryAddressLandmark,
    });

  const hasPhone = !!order?.customerPhone && order.customerPhone.trim().length > 0;

  // Operational status badge
  const getOperationalBadge = () => {
    if (!order) return null;
    if (order.status === 'OUT_FOR_DELIVERY') {
      if (order.codCollected) {
        return <Badge label="COD Collected" variant="success" />;
      }
      if (order.deliveryOtpVerified) {
        return <Badge label="OTP Verified" variant="success" />;
      }
      return <Badge label="Awaiting Delivery Verification" variant="warning" />;
    }
    if (order.status === 'PROCESSING') {
      if (order.acceptedAt) {
        return <Badge label="Ready for Pickup" variant="info" />;
      }
      return <Badge label="Awaiting Acceptance" variant="warning" />;
    }
    if (order.status === 'DELIVERED') {
      return <Badge label="Delivered" variant="success" />;
    }
    if (order.status === 'CANCELLED') {
      return <Badge label="Cancelled" variant="danger" />;
    }
    return <Badge label={String(order.status)} variant="default" />;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Navigation Header */}
      <View style={styles.navHeader}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>
          Order #{order?.orderNumber || id || ''}
        </Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {isLoading ? (
        <LoadingIndicator message="Loading delivery details..." />
      ) : errorMessage || !order ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Delivery Details Unavailable</Text>
          <Text style={styles.errorDesc}>{errorMessage || 'Order not found'}</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.returnBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.returnBtnText}>Return to Active Deliveries</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Action Success / Error Banners */}
          {actionSuccess ? (
            <View style={styles.successBanner}>
              <Text style={styles.successBannerIcon}>✓</Text>
              <Text style={styles.successBannerText}>{actionSuccess}</Text>
            </View>
          ) : null}

          {actionError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerIcon}>⚠️</Text>
              <Text style={styles.errorBannerText}>{actionError}</Text>
            </View>
          ) : null}

          {/* Status & Operational Notice */}
          <Card style={styles.statusCard}>
            <View style={styles.badgeRow}>
              {getOperationalBadge()}
              <Badge
                label={isPaid ? 'PAID ONLINE' : isCod ? 'COD (CASH)' : 'PENDING'}
                variant={isPaid ? 'success' : isCod ? 'warning' : 'default'}
              />
            </View>

            {/* Operational notice based on order lifecycle status */}
            {canAccept ? (
              <View style={styles.noticeAwaiting}>
                <Text style={styles.noticeAwaitingTitle}>📋 Delivery Assigned</Text>
                <Text style={styles.noticeAwaitingText}>
                  Please review the items and destination below, then tap "Accept Delivery" to accept this assignment.
                </Text>
              </View>
            ) : canPickup ? (
              <View style={styles.noticePickup}>
                <Text style={styles.noticePickupTitle}>📦 Ready for Store Pickup</Text>
                <Text style={styles.noticePickupText}>
                  Accepted at {formatTimestamp(order.acceptedAt)}. Please collect the package from the store hub and tap "Confirm Store Pickup" below.
                </Text>
              </View>
            ) : isOutForDelivery ? (
              isOtpVerified ? (
                <View style={styles.noticeAccepted}>
                  <Text style={styles.noticeAcceptedTitle}>✅ Doorstep OTP Verified</Text>
                  <Text style={styles.noticeAcceptedText}>
                    Delivery verification code confirmed. Review payment details below.
                  </Text>
                </View>
              ) : (
                <View style={styles.noticeOut}>
                  <Text style={styles.noticeOutTitle}>🚚 Out for Delivery</Text>
                  <Text style={styles.noticeOutText}>
                    Package picked up at {formatTimestamp(order.pickedUpAt)}. Proceed to customer address and request delivery OTP.
                  </Text>
                </View>
              )
            ) : isDelivered ? (
              <View style={styles.noticeAccepted}>
                <Text style={styles.noticeAcceptedTitle}>🎉 Order Delivered</Text>
                <Text style={styles.noticeAcceptedText}>
                  Delivery completed successfully at {formatTimestamp(order.deliveredAt)}.
                </Text>
              </View>
            ) : isCancelled ? (
              <View style={styles.noticeCancelled}>
                <Text style={styles.noticeCancelledTitle}>❌ Cancelled</Text>
                <Text style={styles.noticeCancelledText}>
                  This delivery order has been cancelled.
                </Text>
              </View>
            ) : (
              <View style={styles.noticeInfo}>
                <Text style={styles.noticeInfoTitle}>Status: {order.status}</Text>
                <Text style={styles.noticeInfoText}>
                  Order status details are displayed below.
                </Text>
              </View>
            )}
          </Card>

          {/* Phase 5 Section: Doorstep Delivery OTP Verification */}
          {canVerifyOtp && (
            <Card style={styles.otpCard}>
              <Text style={styles.otpCardHeader}>🔐 Delivery Verification</Text>
              <Text style={styles.otpInstruction}>
                Ask the customer for their 4-digit delivery OTP.
              </Text>

              <View style={styles.otpInputWrapper}>
                <TextInput
                  style={[
                    styles.otpTextInput,
                    otpValidationError ? styles.otpInputErrorBorder : null,
                  ]}
                  value={otpInput}
                  onChangeText={handleOtpInputChange}
                  keyboardType="numeric"
                  maxLength={4}
                  placeholder="••••"
                  placeholderTextColor={colors.textMuted}
                  editable={!isVerifyingOtp}
                  accessibilityLabel="4-digit delivery OTP input"
                />
              </View>

              {otpValidationError ? (
                <Text style={styles.otpValidationMsg}>{otpValidationError}</Text>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.verifyOtpBtn,
                  (otpInput.length !== 4 || isVerifyingOtp) && styles.btnDisabled,
                ]}
                onPress={handleVerifyOtp}
                disabled={otpInput.length !== 4 || isVerifyingOtp}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Verify Delivery OTP"
              >
                {isVerifyingOtp ? (
                  <View style={styles.actionInProgressRow}>
                    <ActivityIndicator color={colors.textInverse} size="small" />
                    <Text style={styles.verifyOtpBtnText}>Verifying OTP...</Text>
                  </View>
                ) : (
                  <Text style={styles.verifyOtpBtnText}>✓ Verify Delivery OTP</Text>
                )}
              </TouchableOpacity>
            </Card>
          )}

          {/* Phase 5 Section: Verified OTP State & Payment Handling */}
          {isOtpVerified && (
            <Card style={styles.verifiedCard}>
              <View style={styles.verifiedHeaderRow}>
                <Text style={styles.verifiedIcon}>✅</Text>
                <View style={styles.verifiedTextGroup}>
                  <Text style={styles.verifiedTitle}>Delivery OTP Verified</Text>
                  <Text style={styles.verifiedSubtext}>
                    Customer verification completed at doorstep.
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Payment Settlement Information (Prepaid vs COD) */}
              {isPrepaid ? (
                <View style={styles.prepaidBox}>
                  <Text style={styles.prepaidTitle}>💳 Payment Already Received</Text>
                  <Text style={styles.prepaidDesc}>
                    ₹{order.totalAmount.toFixed(2)} was paid online. No cash collection is required from the customer.
                  </Text>
                </View>
              ) : isCod ? (
                <View style={styles.codBox}>
                  <Text style={styles.codTitle}>💵 Cash Collection Required</Text>
                  <View style={styles.codAmountRow}>
                    <Text style={styles.codAmountLabel}>Collect Exact Cash:</Text>
                    <Text style={styles.codAmountValue}>₹{order.totalAmount.toFixed(2)}</Text>
                  </View>
                  <Text style={styles.codInstruction}>
                    Payment method: Cash on Delivery (COD). Please collect exactly ₹{order.totalAmount.toFixed(2)} in cash from the customer before completing delivery.
                  </Text>

                  {/* Explicit Cash Confirmation Control (Section 6) */}
                  <View style={styles.codConfirmationContainer}>
                    {hasConfirmedCash ? (
                      <View style={styles.cashConfirmedBox}>
                        <View style={styles.cashConfirmedRow}>
                          <Text style={styles.cashConfirmedText}>
                            ✓ Cash Collected (₹{order.totalAmount.toFixed(2)})
                          </Text>
                          <TouchableOpacity
                            onPress={handleToggleCashConfirmed}
                            disabled={isCompleting}
                            style={styles.undoCashBtn}
                            activeOpacity={0.7}
                            accessibilityLabel="Change cash collection confirmation"
                          >
                            <Text style={styles.undoCashBtnText}>Change</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.confirmCashBtn,
                          isCompleting && styles.btnDisabled,
                        ]}
                        onPress={handleToggleCashConfirmed}
                        disabled={isCompleting}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel="I Collected Cash"
                      >
                        <Text style={styles.confirmCashBtnText}>💵 I Collected Cash</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ) : (
                <View style={styles.prepaidBox}>
                  <Text style={styles.prepaidTitle}>Payment Status: {order.paymentStatus}</Text>
                  <Text style={styles.prepaidDesc}>
                    Amount: ₹{order.totalAmount.toFixed(2)} ({order.paymentMethod})
                  </Text>
                </View>
              )}

              {/* Optional Delivery Notes Input (Section 22) */}
              <View style={styles.notesContainer}>
                <Text style={styles.notesLabel}>📝 Delivery Notes (optional)</Text>
                <TextInput
                  style={styles.notesInput}
                  value={deliveryNotes}
                  onChangeText={setDeliveryNotes}
                  placeholder="e.g., Handed to customer at door, left with security"
                  placeholderTextColor={colors.textMuted}
                  maxLength={200}
                  editable={!isCompleting}
                  accessibilityLabel="Delivery notes optional input"
                />
              </View>
            </Card>
          )}

          {/* Customer Contact Card */}
          <Card style={styles.card}>
            <Text style={styles.cardHeader}>👤 Customer Information</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Name</Text>
              <Text style={styles.detailValue}>{order.customerName || 'N/A'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Contact Phone</Text>
              <Text style={styles.detailValue}>{order.customerPhone || 'N/A'}</Text>
            </View>
            {order.customerEmail ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email</Text>
                <Text style={styles.detailValue}>{order.customerEmail}</Text>
              </View>
            ) : null}
          </Card>

          {/* Delivery Address Card */}
          <Card style={styles.card}>
            <Text style={styles.cardHeader}>📍 Delivery Address</Text>
            <Text style={styles.addressBody}>
              {order.deliveryAddressText || 'Address not specified'}
            </Text>
            {order.deliveryAddressLandmark ? (
              <View style={styles.landmarkBox}>
                <Text style={styles.landmarkText}>
                  🏢 Landmark: {order.deliveryAddressLandmark}
                </Text>
              </View>
            ) : null}
          </Card>

          {/* Order Items Checklist */}
          {order.items && order.items.length > 0 ? (
            <Card style={styles.card}>
              <Text style={styles.cardHeader}>
                📦 Package Items ({order.items.length})
              </Text>
              {order.items.map((item, idx) => (
                <View key={item.id || idx} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.productName}</Text>
                    <Text style={styles.itemQty}>
                      Qty: {item.quantity} {item.unit ? `• ${item.unit}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.itemSubtotal}>
                    ₹{(item.subtotal || item.price * item.quantity).toFixed(2)}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}

          {/* Financial Summary */}
          <Card style={styles.card}>
            <Text style={styles.cardHeader}>💰 Payment Summary</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Subtotal</Text>
              <Text style={styles.detailValue}>
                ₹{(order.subtotal || 0).toFixed(2)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Delivery Charge</Text>
              <Text style={styles.detailValue}>
                ₹{(order.deliveryCharge || 0).toFixed(2)}
              </Text>
            </View>
            {(order.discount || 0) > 0 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Discount</Text>
                <Text style={styles.discountValue}>
                  -₹{(order.discount || 0).toFixed(2)}
                </Text>
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalAmount}>
                ₹{order.totalAmount.toFixed(2)}
              </Text>
            </View>
          </Card>

          {/* Timeline & Lifecycle Timestamps */}
          <Card style={styles.card}>
            <Text style={styles.cardHeader}>🕒 Lifecycle Timestamps</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Assigned</Text>
              <Text style={styles.detailValue}>{formatTimestamp(order.assignedAt)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Accepted</Text>
              <Text style={styles.detailValue}>{formatTimestamp(order.acceptedAt)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Picked Up</Text>
              <Text style={styles.detailValue}>{formatTimestamp(order.pickedUpAt)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>OTP Verified</Text>
              <Text style={styles.detailValue}>
                {order.deliveryOtpVerified ? 'Verified' : 'Pending'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Delivered</Text>
              <Text style={styles.detailValue}>{formatTimestamp(order.deliveredAt)}</Text>
            </View>
            {order.codCollected && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>COD Collected</Text>
                <Text style={styles.detailValue}>
                  ₹{order.totalAmount.toFixed(2)}{order.codCollectedAt ? ` (${formatTimestamp(order.codCollectedAt)})` : ''}
                </Text>
              </View>
            )}
          </Card>

          {/* Customer Contact & Navigation Utility Actions */}
          <View style={styles.utilityActionRow}>
            <TouchableOpacity
              style={[styles.utilityBtn, !hasDestination && styles.utilityBtnDisabled]}
              onPress={handleNavigate}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Navigate to destination"
            >
              <Text style={styles.utilityBtnText}>📍 Navigate</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.utilityBtn, !hasPhone && styles.utilityBtnDisabled]}
              onPress={handleCallCustomer}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Call customer"
            >
              <Text
                style={[
                  styles.utilityBtnText,
                  !hasPhone && styles.utilityBtnTextDisabled,
                ]}
              >
                📞 Call Customer
              </Text>
            </TouchableOpacity>
          </View>

          {/* Phase 3 Action: Prominent Accept Delivery Button */}
          {canAccept && (
            <View style={styles.actionSection}>
              <TouchableOpacity
                style={[styles.acceptBtn, isAccepting && styles.btnDisabled]}
                onPress={handleOpenAcceptModal}
                disabled={isAccepting}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Accept Delivery"
              >
                {isAccepting ? (
                  <View style={styles.actionInProgressRow}>
                    <ActivityIndicator color={colors.textInverse} size="small" />
                    <Text style={styles.actionBtnText}>Accepting delivery...</Text>
                  </View>
                ) : (
                  <Text style={styles.actionBtnText}>✓ Accept Delivery</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Phase 4 Action: Prominent Confirm Store Pickup Button */}
          {canPickup && (
            <View style={styles.actionSection}>
              <TouchableOpacity
                style={[styles.pickupBtn, isPickingUp && styles.btnDisabled]}
                onPress={handleOpenPickupModal}
                disabled={isPickingUp}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Confirm Store Pickup"
              >
                {isPickingUp ? (
                  <View style={styles.actionInProgressRow}>
                    <ActivityIndicator color={colors.textInverse} size="small" />
                    <Text style={styles.actionBtnText}>Confirming pickup...</Text>
                  </View>
                ) : (
                  <Text style={styles.actionBtnText}>📦 Confirm Store Pickup</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Phase 6 Action: Prominent Complete Delivery Button */}
          {isOutForDelivery && isOtpVerified && (
            <View style={styles.actionSection}>
              {isCod && !hasConfirmedCash && (
                <View style={styles.actionRequirementHintBox}>
                  <Text style={styles.actionRequirementHintText}>
                    ⚠️ Please confirm cash collection above to enable completion.
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={[
                  styles.completeBtn,
                  (!canComplete || isCompleting) && styles.btnDisabled,
                ]}
                onPress={handleOpenCompleteModal}
                disabled={!canComplete || isCompleting}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Complete Delivery"
              >
                {isCompleting ? (
                  <View style={styles.actionInProgressRow}>
                    <ActivityIndicator color={colors.textInverse} size="small" />
                    <Text style={styles.actionBtnText}>Completing delivery...</Text>
                  </View>
                ) : (
                  <Text style={styles.actionBtnText}>✓ Complete Delivery</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Delivery Notes Display for Delivered Orders */}
          {isDelivered && order.deliveryNotes ? (
            <Card style={styles.card}>
              <Text style={styles.cardHeader}>📝 Delivery Notes</Text>
              <Text style={styles.deliveryNotesDisplayText}>{order.deliveryNotes}</Text>
            </Card>
          ) : null}
        </ScrollView>
      )}

      {/* Acceptance Confirmation Modal (Phase 3) */}
      {order && (
        <Modal
          visible={showConfirmAcceptModal}
          transparent
          animationType="fade"
          onRequestClose={handleCancelAccept}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Accept this delivery?</Text>
              <Text style={styles.modalSubtitle}>
                Please confirm that you want to accept this delivery order:
              </Text>

              <View style={styles.modalSummaryBox}>
                <View style={styles.modalSummaryRow}>
                  <Text style={styles.modalSummaryLabel}>Order:</Text>
                  <Text style={styles.modalSummaryValue}>
                    #{order.orderNumber || order.id}
                  </Text>
                </View>
                <View style={styles.modalSummaryRow}>
                  <Text style={styles.modalSummaryLabel}>Customer:</Text>
                  <Text style={styles.modalSummaryValue} numberOfLines={1}>
                    👤 {order.customerName || 'Customer'}
                  </Text>
                </View>
                <View style={styles.modalSummaryRow}>
                  <Text style={styles.modalSummaryLabel}>Destination:</Text>
                  <Text style={styles.modalSummaryValue} numberOfLines={2}>
                    📍 {order.deliveryAddressText || 'Destination specified'}
                  </Text>
                </View>
                <View style={styles.modalSummaryRow}>
                  <Text style={styles.modalSummaryLabel}>Amount:</Text>
                  <Text style={styles.modalSummaryValue}>
                    ₹{order.totalAmount.toFixed(2)} ({isPaid ? 'PAID' : isCod ? 'COD' : 'PENDING'})
                  </Text>
                </View>
              </View>

              <View style={styles.modalButtonRow}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn, isAccepting && styles.btnDisabled]}
                  onPress={handleCancelAccept}
                  disabled={isAccepting}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalConfirmBtn, isAccepting && styles.btnDisabled]}
                  onPress={handleConfirmAccept}
                  disabled={isAccepting}
                  activeOpacity={0.8}
                >
                  {isAccepting ? (
                    <View style={styles.actionInProgressRow}>
                      <ActivityIndicator color={colors.textInverse} size="small" />
                      <Text style={styles.modalConfirmBtnText}>Accepting...</Text>
                    </View>
                  ) : (
                    <Text style={styles.modalConfirmBtnText}>Accept</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Store Pickup Confirmation Modal (Phase 4) */}
      {order && (
        <Modal
          visible={showConfirmPickupModal}
          transparent
          animationType="fade"
          onRequestClose={handleCancelPickup}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Confirm store pickup?</Text>
              <Text style={styles.modalSubtitle}>
                Please confirm that you have collected the package from the store hub:
              </Text>

              <View style={styles.modalSummaryBox}>
                <View style={styles.modalSummaryRow}>
                  <Text style={styles.modalSummaryLabel}>Order:</Text>
                  <Text style={styles.modalSummaryValue}>
                    #{order.orderNumber || order.id}
                  </Text>
                </View>
                <View style={styles.modalSummaryRow}>
                  <Text style={styles.modalSummaryLabel}>Customer:</Text>
                  <Text style={styles.modalSummaryValue} numberOfLines={1}>
                    👤 {order.customerName || 'Customer'}
                  </Text>
                </View>
                <View style={styles.modalSummaryRow}>
                  <Text style={styles.modalSummaryLabel}>Destination:</Text>
                  <Text style={styles.modalSummaryValue} numberOfLines={2}>
                    📍 {order.deliveryAddressText || 'Destination specified'}
                  </Text>
                </View>
                {order.items && order.items.length > 0 && (
                  <View style={styles.modalSummaryRow}>
                    <Text style={styles.modalSummaryLabel}>Packages:</Text>
                    <Text style={styles.modalSummaryValue}>
                      📦 {order.items.length} item{order.items.length > 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.modalButtonRow}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn, isPickingUp && styles.btnDisabled]}
                  onPress={handleCancelPickup}
                  disabled={isPickingUp}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalConfirmBtn, isPickingUp && styles.btnDisabled]}
                  onPress={handleConfirmPickup}
                  disabled={isPickingUp}
                  activeOpacity={0.8}
                >
                  {isPickingUp ? (
                    <View style={styles.actionInProgressRow}>
                      <ActivityIndicator color={colors.textInverse} size="small" />
                      <Text style={styles.modalConfirmBtnText}>Confirming...</Text>
                    </View>
                  ) : (
                    <Text style={styles.modalConfirmBtnText}>Confirm Pickup</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Complete Delivery Confirmation Modal (Phase 6) */}
      {order && (
        <Modal
          visible={showConfirmCompleteModal}
          transparent
          animationType="fade"
          onRequestClose={handleCancelComplete}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Complete this delivery?</Text>
              <Text style={styles.modalSubtitle}>
                Please confirm that the package has been delivered to the customer:
              </Text>

              <View style={styles.modalSummaryBox}>
                <View style={styles.modalSummaryRow}>
                  <Text style={styles.modalSummaryLabel}>Order:</Text>
                  <Text style={styles.modalSummaryValue}>
                    #{order.orderNumber || order.id}
                  </Text>
                </View>
                <View style={styles.modalSummaryRow}>
                  <Text style={styles.modalSummaryLabel}>Customer:</Text>
                  <Text style={styles.modalSummaryValue} numberOfLines={1}>
                    👤 {order.customerName || 'Customer'}
                  </Text>
                </View>
                <View style={styles.modalSummaryRow}>
                  <Text style={styles.modalSummaryLabel}>Destination:</Text>
                  <Text style={styles.modalSummaryValue} numberOfLines={2}>
                    📍 {order.deliveryAddressText || 'Destination specified'}
                  </Text>
                </View>
                <View style={styles.modalSummaryRow}>
                  <Text style={styles.modalSummaryLabel}>Payment:</Text>
                  <Text style={styles.modalSummaryValue}>
                    {isCod ? 'Cash on Delivery (COD)' : 'Paid Online'}
                  </Text>
                </View>
                {isCod && (
                  <View style={styles.modalSummaryRow}>
                    <Text style={styles.modalSummaryLabel}>Cash:</Text>
                    <Text style={styles.modalSummaryValueHighlight}>
                      ₹{order.totalAmount.toFixed(2)} (Cash Collected)
                    </Text>
                  </View>
                )}
                {deliveryNotes.trim().length > 0 && (
                  <View style={styles.modalSummaryRow}>
                    <Text style={styles.modalSummaryLabel}>Notes:</Text>
                    <Text style={styles.modalSummaryValue} numberOfLines={2}>
                      {deliveryNotes.trim()}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.modalButtonRow}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn, isCompleting && styles.btnDisabled]}
                  onPress={handleCancelComplete}
                  disabled={isCompleting}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalCompleteConfirmBtn, isCompleting && styles.btnDisabled]}
                  onPress={handleConfirmComplete}
                  disabled={isCompleting}
                  activeOpacity={0.8}
                >
                  {isCompleting ? (
                    <View style={styles.actionInProgressRow}>
                      <ActivityIndicator color={colors.textInverse} size="small" />
                      <Text style={styles.modalConfirmBtnText}>Completing...</Text>
                    </View>
                  ) : (
                    <Text style={styles.modalConfirmBtnText}>Complete Delivery</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
  },
  backButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  headerRightPlaceholder: {
    width: 48,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  statusCard: {
    marginBottom: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  noticeAwaiting: {
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  noticeAwaitingTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.warningText,
    marginBottom: 2,
  },
  noticeAwaitingText: {
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 16,
  },
  noticePickup: {
    backgroundColor: colors.infoLight,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  noticePickupTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.infoText,
    marginBottom: 2,
  },
  noticePickupText: {
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 16,
  },
  noticeOut: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  noticeOutTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
    marginBottom: 2,
  },
  noticeOutText: {
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 16,
  },
  noticeAccepted: {
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  noticeAcceptedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.successText,
    marginBottom: 2,
  },
  noticeAcceptedText: {
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 16,
  },
  noticeCancelled: {
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  noticeCancelledTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.dangerText,
    marginBottom: 2,
  },
  noticeCancelledText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  noticeInfo: {
    backgroundColor: colors.infoLight,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  noticeInfoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.infoText,
    marginBottom: 2,
  },
  noticeInfoText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  otpCard: {
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  otpCardHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  otpInstruction: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  otpInputWrapper: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  otpTextInput: {
    width: '100%',
    maxWidth: 240,
    minHeight: 56,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 12,
    backgroundColor: colors.surfaceSecondary,
    fontSize: 28,
    letterSpacing: 14,
    textAlign: 'center',
    fontWeight: '800',
    color: colors.textPrimary,
    paddingVertical: 10,
  },
  otpInputErrorBorder: {
    borderColor: colors.danger,
  },
  otpValidationMsg: {
    color: colors.dangerText,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  verifyOtpBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  verifyOtpBtnText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '800',
  },
  verifiedCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.successBorder,
  },
  verifiedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  verifiedIcon: {
    fontSize: 24,
  },
  verifiedTextGroup: {
    flex: 1,
  },
  verifiedTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.successText,
  },
  verifiedSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  prepaidBox: {
    backgroundColor: colors.successLight,
    borderRadius: 8,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  prepaidTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.successText,
    marginBottom: 2,
  },
  prepaidDesc: {
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 16,
  },
  codBox: {
    backgroundColor: colors.warningLight,
    borderRadius: 8,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  codTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.warningText,
    marginBottom: spacing.xs,
  },
  codAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  codAmountLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  codAmountValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.warningText,
  },
  codInstruction: {
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 16,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  successBannerIcon: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.successText,
  },
  successBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.successText,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  errorBannerIcon: {
    fontSize: 16,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.dangerText,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  discountValue: {
    fontSize: 13,
    color: colors.successText,
    fontWeight: '700',
  },
  addressBody: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
    marginTop: 2,
  },
  landmarkBox: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  landmarkText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.infoText,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  itemQty: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemSubtotal: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginLeft: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  utilityActionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  utilityBtn: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: spacing.md,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  utilityBtnDisabled: {
    opacity: 0.5,
  },
  utilityBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  utilityBtnTextDisabled: {
    color: colors.textMuted,
  },
  actionSection: {
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  acceptBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.md + 2,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  pickupBtn: {
    backgroundColor: colors.primaryDark,
    borderRadius: 12,
    paddingVertical: spacing.md + 2,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  actionBtnText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  actionInProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  modalSummaryBox: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.xs + 2,
  },
  modalSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalSummaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    width: 80,
  },
  modalSummaryValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'right',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    minHeight: 48,
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  modalConfirmBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textInverse,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorIcon: {
    fontSize: 44,
    marginBottom: spacing.md,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  errorDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  returnBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  returnBtnText: {
    color: colors.textInverse,
    fontWeight: '700',
    fontSize: 14,
  },
  codConfirmationContainer: {
    marginTop: spacing.sm,
  },
  confirmCashBtn: {
    backgroundColor: colors.primaryDark,
    borderRadius: 10,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  confirmCashBtnText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '800',
  },
  cashConfirmedBox: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.success,
    borderRadius: 10,
    padding: spacing.sm,
  },
  cashConfirmedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cashConfirmedText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.successText,
  },
  undoCashBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.surfaceSecondary,
  },
  undoCashBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  notesContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  notesInput: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 13,
    color: colors.textPrimary,
    minHeight: 44,
  },
  actionRequirementHintBox: {
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  actionRequirementHintText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warningText,
    textAlign: 'center',
  },
  completeBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.md + 2,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  deliveryNotesDisplayText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  modalSummaryValueHighlight: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: colors.successText,
    textAlign: 'right',
  },
  modalCompleteConfirmBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
});
