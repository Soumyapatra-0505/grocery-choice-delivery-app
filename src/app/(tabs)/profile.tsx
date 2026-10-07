/**
 * Grocery Choice Delivery App - Rider Profile Tab
 * Displays authenticated delivery partner details and Sign Out action.
 */

import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { Header } from '@/components/common/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/common/Badge';
import { colors, spacing } from '@/theme';

export default function ProfileTabScreen() {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Rider Profile"
        subtitle="Partner account details"
        rightAction={<Badge label={user?.role || 'DELIVERY'} variant="success" />}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Card */}
        <Card style={styles.card}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'R'}
              </Text>
            </View>
            <View style={styles.riderSummary}>
              <Text style={styles.riderName}>{user?.fullName || 'Delivery Partner'}</Text>
              <Text style={styles.riderRole}>Role: {user?.role || 'DELIVERY'}</Text>
              <View style={styles.statusPill}>
                <Badge
                  label={user?.status === 'ACTIVE' ? 'Active Account' : String(user?.status || 'Active')}
                  variant={user?.status === 'ACTIVE' ? 'success' : 'warning'}
                />
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Mobile Number</Text>
            <Text style={styles.fieldValue}>{user?.phone || 'Not registered'}</Text>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Email Address</Text>
            <Text style={styles.fieldValue}>{user?.email || 'Not registered'}</Text>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Designation</Text>
            <Text style={styles.fieldValue}>{user?.designation || 'Delivery Partner'}</Text>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Store Hub</Text>
            <Text style={styles.fieldValue}>{user?.storeHub || 'Primary Distribution Hub'}</Text>
          </View>
        </Card>

        {/* Operational Guidelines Card */}
        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>📋 Operational Guidelines</Text>
          <Text style={styles.infoText}>
            • Always verify package contents and items before confirming store pickup.
          </Text>
          <Text style={styles.infoText}>
            • Doorstep 4-digit verification code is required from customer for every delivery.
          </Text>
          <Text style={styles.infoText}>
            • Collect physical cash on delivery (COD) before completing cash orders.
          </Text>
        </Card>

        {/* Sign Out Button */}
        <Button
          title="Sign Out"
          variant="outline"
          onPress={logout}
          style={styles.logoutBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  card: {
    marginBottom: spacing.lg,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textInverse,
  },
  riderSummary: {
    flex: 1,
  },
  riderName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  riderRole: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusPill: {
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.sm,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  fieldLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  fieldValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: colors.surfaceSecondary,
    borderColor: colors.borderLight,
    marginBottom: spacing.xl,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  infoText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  logoutBtn: {
    marginTop: spacing.xs,
  },
});
