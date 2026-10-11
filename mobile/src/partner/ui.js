/** Componentes visuais simples do App Parceiros. */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {COLORS} from './PartnerContext';

export function Card({children, style}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
  testID,
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({pressed}) => [
        styles.button,
        {backgroundColor: v.bg, borderColor: v.border},
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.buttonInner}>
          {icon}
          <Text style={[styles.buttonText, {color: v.fg}]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const VARIANTS = {
  primary: {bg: COLORS.primary, fg: '#FFFFFF', border: COLORS.primary},
  secondary: {bg: '#FFFFFF', fg: COLORS.primary, border: COLORS.primary},
  danger: {bg: '#FFFFFF', fg: COLORS.bad, border: '#FCA5A5'},
  ghost: {bg: 'transparent', fg: COLORS.primary, border: 'transparent'},
};

export function Field({label, hint, error, style, ...props}) {
  return (
    <View style={[styles.field, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor="#94A3B8"
        style={[
          styles.input,
          props.multiline && styles.multiline,
          error && styles.inputError,
        ]}
        {...props}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function SectionTitle({children, right}) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function Empty({text}) {
  return <Text style={styles.empty}>{text}</Text>;
}

export function Badge({text, tone = 'ok'}) {
  const t = {
    ok: [COLORS.okSoft, COLORS.ok],
    bad: [COLORS.badSoft, COLORS.bad],
    warn: [COLORS.warnSoft, COLORS.warn],
    muted: ['#F1F5F9', COLORS.muted],
  }[tone];
  return (
    <View style={[styles.badge, {backgroundColor: t[0]}]}>
      <Text style={[styles.badgeText, {color: t[1]}]}>{text}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: COLORS.bg},
  content: {padding: 16, paddingBottom: 40},
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  button: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonInner: {flexDirection: 'row', alignItems: 'center', gap: 8},
  buttonText: {fontSize: 16, fontWeight: '700'},
  disabled: {opacity: 0.5},
  pressed: {opacity: 0.85},
  field: {marginBottom: 12},
  label: {fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6},
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    color: COLORS.text,
  },
  multiline: {minHeight: 90, textAlignVertical: 'top'},
  inputError: {borderColor: COLORS.bad},
  error: {color: COLORS.bad, fontSize: 12, marginTop: 4},
  hint: {color: COLORS.muted, fontSize: 12, marginTop: 4},
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {fontSize: 17, fontWeight: '800', color: COLORS.text},
  empty: {
    color: COLORS.muted,
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 15,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeText: {fontSize: 12, fontWeight: '700'},
  title: {fontSize: 22, fontWeight: '800', color: COLORS.text},
  muted: {color: COLORS.muted, fontSize: 14},
  row: {flexDirection: 'row', alignItems: 'center'},
});
