/**
 * Grocery Choice Delivery App - Delivery History Tab (Phase 6)
 * Displays completed deliveries fetched from the backend history API.
 * Features automatic focus refresh, pull-to-refresh, and clean delivery details display.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Header } from '@/components/common/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/common/Badge';
import { deliveryApi } from '@/api/deliveryApi';
import { useAuth } from '@/context/AuthContext';
import { colors, spacing } from '@/theme';
import { DeliveryOrder } from '@/types';

export default function HistoryTabScreen() {
  const { logout } = useAuth();
  const [completedOrders, setCompletedOrders] = useState<DeliveryOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const fetchHistory = useCallback(async (isPullRefresh = false) => {
    if (isPullRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const data = await deliveryApi.getDeliveryHistory();
      setCompletedOrders(Array.isArray(data) ? data : []);
      setLastRefreshedAt(new Date());
    } catch (err: any) {
      if (err?.status === 401) {
        await logout();
      } else if (err?.status === 403) {
        setErrorMessage('Access restricted to delivery partners only.');
      } else {
        setErrorMessage(
          err?.message || 'Unable to load delivery history. Please check your connection and try again.'
        );
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [logout]);

  // Load history automatically whenever the History tab receives focus
  useFocusEffect(
    useCallback(() => {
      fetchHistory(false);
    }, [fetchHistory])
  );

  const handleManualRefresh = () => {
    fetchHistory(false);
  };

  const formatDeliveredDate = (deliveredAt?: string | null, createdAt?: string | null) => {
    const rawDate = deliveredAt || createdAt;
    if (!rawDate) return null;
    try {
      const date = new Date(rawDate);
      return `${date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Delivery History"
        subtitle="Completed deliveries log"
        rightAction={<Badge label={`${completedOrders.length} Completed`} variant="success" />}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchHistory(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading && completedOrders.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Checking delivery history...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.emptyContainer}>
            <Card style={styles.infoCard}>
              <Text style={styles.icon}>⚠️</Text>
              <Text style={styles.title}>Unable to Load History</Text>
              <Text style={styles.desc}>{errorMessage}</Text>
              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={handleManualRefresh}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Retry loading delivery history"
              >
                <Text style={styles.refreshBtnText}>🔄 Retry</Text>
              </TouchableOpacity>
            </Card>
          </View>
        ) : completedOrders.length > 0 ? (
          <View style={styles.listContainer}>
            {completedOrders.map((order) => {
              const formattedDate = formatDeliveredDate(order.deliveredAt, order.createdAt);
              return (
                <Card key={order.id} style={styles.orderCard}>
                  <View style={styles.orderHeaderRow}>
                    <Text style={styles.orderNumber}>
                      #{order.orderNumber || order.id}
                    </Text>
                    <Badge label="Delivered" variant="success" />
                  </View>

                  <Text style={styles.customerName}>
                    👤 {order.customerName || 'Customer'}
                  </Text>

                  <Text style={styles.destinationText} numberOfLines={2}>
                    📍 {order.deliveryAddressText || 'Destination'}
                    {order.deliveryAddressLandmark ? ` (${order.deliveryAddressLandmark})` : ''}
                  </Text>

                  {order.items && order.items.length > 0 && (
                    <Text style={styles.itemsSummaryText} numberOfLines={1}>
                      📦 {order.items.length} item{order.items.length === 1 ? '' : 's'}
                      {' • '}
                      {order.items.map((i) => `${i.productName} (x${i.quantity})`).join(', ')}
                    </Text>
                  )}

                  <View style={styles.orderFooterRow}>
                    <Text style={styles.orderAmount}>
                      ₹{order.totalAmount.toFixed(2)} ({order.paymentMethod})
                    </Text>
                    {formattedDate && (
                      <Text style={styles.deliveredAtText}>
                        ✓ {formattedDate}
                      </Text>
                    )}
                  </View>
                </Card>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Card style={styles.infoCard}>
              <Text style={styles.icon}>📜</Text>
              <Text style={styles.title}>No Deliveries Yet</Text>
              <Text style={styles.subtitle}>
                Your completed deliveries will appear here.
              </Text>
              <Text style={styles.desc}>
                Once you complete a delivery with doorstep OTP verification and COD collection, the completed order is safely archived and logged in your delivery history.
              </Text>

              <View style={styles.featureBox}>
                <Text style={styles.featureItem}>
                  ✓ Active orders automatically move here upon completion
                </Text>
                <Text style={styles.featureItem}>
                  ✓ Doorstep OTP and COD settlement recorded per order
                </Text>
                <Text style={styles.featureItem}>
                  ✓ Delivery timestamps and destination details preserved
                </Text>
              </View>

              {lastRefreshedAt ? (
                <Text style={styles.timestampText}>
                  Last checked: {lastRefreshedAt.toLocaleTimeString()}
                </Text>
              ) : null}

              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={handleManualRefresh}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Refresh delivery history"
              >
                <Text style={styles.refreshBtnText}>🔄 Check for Updates</Text>
              </TouchableOpacity>
            </Card>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  listContainer: {
    gap: spacing.md,
  },
  orderCard: {
    padding: spacing.md,
  },
  orderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  customerName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  destinationText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    lineHeight: 16,
  },
  itemsSummaryText: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  orderFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.xs,
  },
  orderAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  deliveredAtText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.successText,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  infoCard: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryDark,
    textAlign: 'center',
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  desc: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  featureBox: {
    width: '100%',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  featureItem: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '600',
    lineHeight: 16,
  },
  timestampText: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  refreshBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: 10,
    alignItems: 'center',
  },
  refreshBtnText: {
    color: colors.textInverse,
    fontSize: 13,
    fontWeight: '700',
  },
});

