/**
 * Grocery Choice Delivery App - Semantic Status Badge
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing } from '@/theme';

interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default';
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'default',
  style,
}) => {
  const getContainerStyle = () => {
    switch (variant) {
      case 'success':
        return styles.successBg;
      case 'warning':
        return styles.warningBg;
      case 'danger':
        return styles.dangerBg;
      case 'info':
        return styles.infoBg;
      default:
        return styles.defaultBg;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'success':
        return styles.successText;
      case 'warning':
        return styles.warningText;
      case 'danger':
        return styles.dangerText;
      case 'info':
        return styles.infoText;
      default:
        return styles.defaultText;
    }
  };

  return (
    <View style={[styles.badge, getContainerStyle(), style]}>
      <Text style={[styles.text, getTextStyle()]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  successBg: {
    backgroundColor: colors.successLight,
    borderColor: colors.successBorder,
  },
  successText: {
    color: colors.successText,
  },
  warningBg: {
    backgroundColor: colors.warningLight,
    borderColor: colors.warningBorder,
  },
  warningText: {
    color: colors.warningText,
  },
  dangerBg: {
    backgroundColor: colors.dangerLight,
    borderColor: colors.dangerBorder,
  },
  dangerText: {
    color: colors.dangerText,
  },
  infoBg: {
    backgroundColor: colors.infoLight,
    borderColor: colors.infoBorder,
  },
  infoText: {
    color: colors.infoText,
  },
  defaultBg: {
    backgroundColor: colors.surfaceSecondary,
    borderColor: colors.border,
  },
  defaultText: {
    color: colors.textSecondary,
  },
});
