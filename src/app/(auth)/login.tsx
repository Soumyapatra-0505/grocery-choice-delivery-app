/**
 * Grocery Choice Delivery App - Login Screen
 * Supports password authentication and 6-digit OTP authentication.
 * Strictly enforces DELIVERY role validation.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/common/Badge';
import { colors, spacing } from '@/theme';
import { APP_CONFIG } from '@/constants/config';

type AuthMethod = 'password' | 'otp';

export default function LoginScreen() {
  const {
    loginWithPassword,
    sendOtp,
    verifyOtpAndLogin,
    authError,
    clearAuthError,
  } = useAuth();

  const [authMethod, setAuthMethod] = useState<AuthMethod>('password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Countdown timer for OTP resend cooldown
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  const handleTabChange = (method: AuthMethod) => {
    setAuthMethod(method);
    setLocalError(null);
    setSuccessMessage(null);
    clearAuthError();
  };

  // Password Login Handler
  const handlePasswordLogin = async () => {
    if (!identifier.trim()) {
      setLocalError('Please enter your registered mobile number or email.');
      return;
    }
    if (!password) {
      setLocalError('Please enter your password.');
      return;
    }

    setLocalError(null);
    setIsLoading(true);
    try {
      const result = await loginWithPassword(identifier.trim(), password);
      if (!result.success) {
        setLocalError(result.error || 'Authentication failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Send OTP Handler
  const handleSendOtp = async () => {
    if (!identifier.trim()) {
      setLocalError('Please enter your registered mobile number or email.');
      return;
    }

    setLocalError(null);
    setSuccessMessage(null);
    setIsLoading(true);
    try {
      const res = await sendOtp(identifier.trim());
      if (res.success) {
        setOtpSent(true);
        setOtpCooldown(res.resendCooldownSeconds || APP_CONFIG.OTP_RESEND_COOLDOWN_SECONDS);
        setSuccessMessage(res.message || '6-digit OTP sent successfully');
      } else {
        setLocalError(res.message || 'Failed to dispatch OTP');
      }
    } catch (err: any) {
      setLocalError(err.message || 'Unable to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Verify OTP Handler
  const handleVerifyOtp = async () => {
    if (!identifier.trim()) {
      setLocalError('Identifier is required.');
      return;
    }
    if (!otp.trim() || otp.trim().length !== APP_CONFIG.OTP_LENGTH) {
      setLocalError(`Please enter the ${APP_CONFIG.OTP_LENGTH}-digit numeric OTP.`);
      return;
    }

    setLocalError(null);
    setIsLoading(true);
    try {
      const result = await verifyOtpAndLogin(identifier.trim(), otp.trim());
      if (!result.success) {
        setLocalError(result.error || 'Invalid OTP code');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const displayError = localError || authError;

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerSection}>
          <View style={styles.badgeWrapper}>
            <Badge label="Rider Operations" variant="info" />
          </View>
          <Text style={styles.brandTitle}>Grocery Choice</Text>
          <Text style={styles.brandSubtitle}>Delivery Partner Portal</Text>
          <Text style={styles.brandDesc}>
            Sign in to access assigned orders, package pickup, and doorstep fulfillment.
          </Text>
        </View>

        <Card style={styles.authCard}>
          {/* Method Selector Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tabButton, authMethod === 'password' && styles.tabActive]}
              onPress={() => handleTabChange('password')}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.tabText, authMethod === 'password' && styles.tabTextActive]}
              >
                Password
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, authMethod === 'otp' && styles.tabActive]}
              onPress={() => handleTabChange('otp')}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.tabText, authMethod === 'otp' && styles.tabTextActive]}
              >
                6-Digit OTP
              </Text>
            </TouchableOpacity>
          </View>

          {/* Feedback Messages */}
          {displayError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{displayError}</Text>
            </View>
          ) : null}

          {successMessage ? (
            <View style={styles.successBanner}>
              <Text style={styles.successBannerText}>{successMessage}</Text>
            </View>
          ) : null}

          {/* Input Fields */}
          <Input
            label="Mobile Number or Email"
            placeholder="e.g. 9876543210 or rider@store.com"
            value={identifier}
            onChangeText={(val) => {
              setIdentifier(val);
              if (displayError) {
                setLocalError(null);
                clearAuthError();
              }
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {authMethod === 'password' ? (
            <>
              <Input
                label="Password"
                placeholder="Enter your rider password"
                value={password}
                onChangeText={(val) => {
                  setPassword(val);
                  if (displayError) {
                    setLocalError(null);
                    clearAuthError();
                  }
                }}
                isPassword
              />

              <Button
                title="Sign In as Delivery Partner"
                onPress={handlePasswordLogin}
                loading={isLoading}
                disabled={isLoading}
                style={styles.submitBtn}
              />
            </>
          ) : (
            <>
              {otpSent && (
                <Input
                  label="6-Digit Verification Code"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChangeText={(val) => {
                    setOtp(val);
                    if (displayError) {
                      setLocalError(null);
                      clearAuthError();
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={6}
                />
              )}

              {otpSent ? (
                <Button
                  title="Verify OTP & Sign In"
                  onPress={handleVerifyOtp}
                  loading={isLoading}
                  disabled={isLoading}
                  style={styles.submitBtn}
                />
              ) : (
                <Button
                  title="Send 6-Digit OTP"
                  onPress={handleSendOtp}
                  loading={isLoading}
                  disabled={isLoading}
                  style={styles.submitBtn}
                />
              )}

              {otpSent && (
                <View style={styles.resendWrapper}>
                  {otpCooldown > 0 ? (
                    <Text style={styles.cooldownText}>
                      Resend code in {otpCooldown}s
                    </Text>
                  ) : (
                    <TouchableOpacity
                      onPress={handleSendOtp}
                      disabled={isLoading}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.resendLink}>Resend OTP</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          )}
        </Card>

        {/* Security Notice */}
        <View style={styles.footerNotice}>
          <Text style={styles.footerNoticeText}>
            Authorized personnel only. Access is strictly restricted to approved Grocery Choice delivery partners.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
    justifyContent: 'center',
  },
  headerSection: {
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  badgeWrapper: {
    marginBottom: spacing.sm,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
  },
  brandDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    lineHeight: 20,
  },
  authCard: {
    width: '100%',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    padding: 4,
    marginBottom: spacing.lg,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    color: colors.dangerText,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  successBanner: {
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  successBannerText: {
    color: colors.successText,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  submitBtn: {
    marginTop: spacing.sm,
  },
  resendWrapper: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  cooldownText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  resendLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '700',
  },
  footerNotice: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  footerNoticeText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
