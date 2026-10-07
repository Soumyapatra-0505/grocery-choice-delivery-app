/**
 * Grocery Choice Delivery App - Active Deliveries Screen
 * Displays assigned active orders with filter chips and pull-to-refresh.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { deliveryApi } from '@/api/deliveryApi';
import { DeliveryCard } from '@/components/delivery/DeliveryCard';
import { Header } from '@/components/common/Header';
import { Button } from '@/components/ui/Button';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { useAuth } from '@/context/AuthContext';
import { colors, spacing } from '@/theme';
import { DeliveryOrder, ActiveDeliveryFilter } from '@/types';

export default function ActiveDeliveriesScreen() {
  const { logout } = useAuth();

  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [filter, setFilter] = useState<ActiveDeliveryFilter>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const data = await deliveryApi.getAssignedDeliveries();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err: any) {
      if (err?.status === 401) {
        // Expired session -> Logout
        await logout();
      } else if (err?.status === 403) {
        setErrorMessage('Access restricted to delivery partners only.');
      } else {
        setErrorMessage(
          err?.message || 'Unable to load deliveries. Please check your connection and try again.'
        );
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [logout]);

  // Refresh active deliveries on screen focus or tab switch
  useFocusEffect(
    useCallback(() => {
      fetchOrders(false);
    }, [fetchOrders])
  );

  const handleRefresh = () => {
    fetchOrders(true);
  };

  // Filter orders client-side
  const filteredOrders = useMemo(() => {
    // Exclude completed or cancelled orders from Active Deliveries view
    const activeOnly = orders.filter(
      (o) => o && o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
    );

    switch (filter) {
      case 'TO_ACCEPT':
        return activeOnly.filter(
          (o) => o.status === 'PROCESSING' && !o.acceptedAt
        );
      case 'TO_PICKUP':
        return activeOnly.filter(
          (o) => o.status === 'PROCESSING' && !!o.acceptedAt
        );
      case 'OUT_FOR_DELIVERY':
        return activeOnly.filter((o) => o.status === 'OUT_FOR_DELIVERY');
      case 'ALL':
      default:
        return activeOnly;
    }
  }, [orders, filter]);

  // Counts for filter pills
  const counts = useMemo(() => {
    const active = orders.filter(
      (o) => o && o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
    );
    return {
      all: active.length,
      toAccept: active.filter((o) => o.status === 'PROCESSING' && !o.acceptedAt).length,
      toPickup: active.filter((o) => o.status === 'PROCESSING' && !!o.acceptedAt).length,
      outForDelivery: active.filter((o) => o.status === 'OUT_FOR_DELIVERY').length,
    };
  }, [orders]);

  const renderFilterChip = (
    key: ActiveDeliveryFilter,
    label: string,
    count: number
  ) => {
    const isActive = filter === key;
    return (
      <TouchableOpacity
        style={[styles.chip, isActive && styles.chipActive]}
        onPress={() => setFilter(key)}
        activeOpacity={0.8}
      >
        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
          {label} ({count})
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Active Deliveries"
        subtitle="Orders assigned to you"
        rightAction={
          <TouchableOpacity
            style={styles.refreshIconBtn}
            onPress={handleRefresh}
            disabled={isRefreshing || isLoading}
          >
            <Text style={styles.refreshIconText}>🔄</Text>
          </TouchableOpacity>
        }
      />

      {/* Filter Row */}
      <View style={styles.filterBar}>
        {renderFilterChip('ALL', 'All Active', counts.all)}
        {renderFilterChip('TO_ACCEPT', 'To Accept', counts.toAccept)}
        {renderFilterChip('TO_PICKUP', 'To Pickup', counts.toPickup)}
        {renderFilterChip('OUT_FOR_DELIVERY', 'Out for Delivery', counts.outForDelivery)}
      </View>

      {/* Content States */}
      {isLoading ? (
        <LoadingIndicator message="Loading assigned deliveries..." />
      ) : errorMessage ? (
        <View style={styles.stateContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.stateTitle}>Unable to load deliveries</Text>
          <Text style={styles.stateDesc}>{errorMessage}</Text>
          <Button
            title="Try Again"
            onPress={() => fetchOrders(false)}
            size="md"
            style={styles.retryBtn}
          />
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.stateContainer}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.stateTitle}>No active deliveries</Text>
          <Text style={styles.stateDesc}>
            {filter === 'ALL'
              ? 'New deliveries assigned to you will appear here.'
              : 'No orders match the selected status filter.'}
          </Text>
          <Button
            title="Refresh Deliveries"
            variant="outline"
            onPress={handleRefresh}
            size="md"
            style={styles.retryBtn}
          />
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <DeliveryCard order={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.textInverse,
    fontWeight: '700',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  errorIcon: {
    fontSize: 44,
    marginBottom: spacing.md,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  stateDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  retryBtn: {
    minWidth: 160,
  },
  refreshIconBtn: {
    padding: spacing.xs,
  },
  refreshIconText: {
    fontSize: 18,
  },
});
