/**
 * Grocery Choice Delivery App - Active Delivery Card Component
 * Optimized for outdoor readability, clear status, and large touch targets.
 * Tapping navigates to /order/[id].
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/common/Badge';
import { colors, spacing } from '@/theme';
import { DeliveryOrder } from '@/types';

interface DeliveryCardProps {
  order: DeliveryOrder;
}

export const DeliveryCard: React.FC<DeliveryCardProps> = ({ order }) => {
  const router = useRouter();

  const handlePress = () => {
    router.push(`/order/${order.id}` as any);
  };

  // Determine operational status badge
  const getStatusBadge = () => {
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
      if (!order.acceptedAt) {
        return <Badge label="Awaiting Acceptance" variant="warning" />;
      }
      return <Badge label="Ready for Pickup" variant="info" />;
    }
    if (order.status === 'DELIVERED') {
      return <Badge label="Delivered" variant="success" />;
    }
    if (order.status === 'CANCELLED') {
      return <Badge label="Cancelled" variant="danger" />;
    }
    return <Badge label={String(order.status)} variant="default" />;
  };

  // Determine payment badge
  const isCod =
    order.paymentMethod?.toLowerCase().includes('cash') ||
    order.paymentMethod?.toLowerCase().includes('cod');
  const isPaid = order.paymentStatus === 'PAID';

  const formatTimestamp = (iso?: string | null) => {
    if (!iso) return null;
    try {
      const date = new Date(iso);
      if (isNaN(date.getTime())) return null;
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  };

  const relevantTime = order.deliveredAt
    ? `🎉 Delivered ${formatTimestamp(order.deliveredAt)}`
    : order.pickedUpAt
    ? `📦 Picked up ${formatTimestamp(order.pickedUpAt)}`
    : order.acceptedAt
    ? `✓ ${formatTimestamp(order.acceptedAt)}`
    : formatTimestamp(order.assignedAt || order.createdAt)
    ? `🕒 ${formatTimestamp(order.assignedAt || order.createdAt)}`
    : null;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      style={styles.touchable}
    >
      <Card style={styles.card}>
        {/* Header row: Order # and Status */}
        <View style={styles.headerRow}>
          <View style={styles.orderNumberContainer}>
            <Text style={styles.orderLabel}>ORDER</Text>
            <Text style={styles.orderNumber}>#{order.orderNumber || order.id}</Text>
          </View>
          <View style={styles.badgeContainer}>{getStatusBadge()}</View>
        </View>

        {/* Customer Information */}
        <View style={styles.customerRow}>
          <Text style={styles.customerName}>
            👤 {order.customerName || 'Customer'}
          </Text>
          {relevantTime && (
            <Text style={styles.timeText}>{relevantTime}</Text>
          )}
        </View>

        {/* Address & Landmark */}
        <View style={styles.addressSection}>
          <Text style={styles.addressLabel}>📍 Delivery Address:</Text>
          <Text style={styles.addressText} numberOfLines={2}>
            {order.deliveryAddressText || 'Address not specified'}
          </Text>
          {order.deliveryAddressLandmark ? (
            <Text style={styles.landmarkText} numberOfLines={1}>
              🏢 Near {order.deliveryAddressLandmark}
            </Text>
          ) : null}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Footer: Payment badge, Total amount, and Navigation hint */}
        <View style={styles.footerRow}>
          <View style={styles.paymentInfo}>
            {isPaid ? (
              <Badge label="PAID ONLINE" variant="success" />
            ) : isCod ? (
              <Badge label="COLLECT CASH (COD)" variant="warning" />
            ) : (
              <Badge label={order.paymentMethod || 'PAYMENT PENDING'} variant="default" />
            )}
            <Text style={styles.amountText}>₹{order.totalAmount.toFixed(2)}</Text>
          </View>

          <View style={styles.actionHint}>
            <Text style={styles.actionHintText}>View Details ›</Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  touchable: {
    marginBottom: spacing.md,
  },
  card: {
    padding: spacing.md + 2,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  orderNumberContainer: {
    flex: 1,
  },
  orderLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  badgeContainer: {
    marginLeft: spacing.sm,
  },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  timeText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  addressSection: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  addressLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  addressText: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  landmarkText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.infoText,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.xs,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  actionHint: {
    paddingHorizontal: spacing.xs,
  },
  actionHintText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
  },
});
