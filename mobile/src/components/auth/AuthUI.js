/**
 * Peças das telas de entrada (login, cadastro, recuperar senha, completar CPF),
 * no mesmo visual do novo Início: topo roxo profundo com o logo e a folha branca do formulário.
 * No App Parceiros as cores viram verde-azulado.
 */
import React, {useState} from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {IS_PARTNER_APP} from '../../config/appVariant';
import {F} from '../../theme/home';

export const A = IS_PARTNER_APP
  ? {deep: '#134E4A', primary: '#0F766E', soft: '#CCFBF1', text: '#99F6E4'}
  : {deep: '#3B1A78', primary: '#6D28D9', soft: '#EDE9FE', text: '#DDD6FE'};
const INK = '#1E1B2E';
const MUTED = '#6B6880';

function appIcon() {
  try {
    return require('../../assets/images/app-icon.png');
  } catch {
    return null;
  }
}

export function AuthLayout({title, subtitle, onBack, children, footer, compactHero}) {
  const icon = appIcon();
  return (
    <View style={[styles.root, {backgroundColor: A.deep}]}>
      <StatusBar barStyle="light-content" backgroundColor={A.deep} />
      <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{flexGrow: 1}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.hero, compactHero && {paddingBottom: 28}]}>
            <View style={styles.circle1} />
            <View style={styles.circle2} />
            {onBack ? (
              <TouchableOpacity onPress={onBack} style={styles.back} accessibilityLabel="Voltar" testID="voltar">
                <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            ) : null}
            <View style={styles.brand}>
              <View style={styles.logo}>
                {icon ? <Image source={icon} style={{width: 40, height: 40}} resizeMode="contain" /> : <Ionicons name="paw" size={28} color={A.primary} />}
              </View>
              <Text style={[styles.brandName, F.heavy]}>{IS_PARTNER_APP ? 'Liga do Bem Parceiros' : 'Liga do Bem'}</Text>
            </View>
            <Text style={[styles.title, F.heavy]}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, F.regular, {color: A.text}]}>{subtitle}</Text> : null}
          </View>
          <View style={styles.sheet}>
            {children}
            {footer ? <View style={{marginTop: 'auto', paddingTop: 20}}>{footer}</View> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export function Field({label, icon, error, hint, ok, secure, right, style, ...props}) {
  const [show, setShow] = useState(false);
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{marginBottom: 14}, style]}>
      {label ? <Text style={[styles.label, F.bold]}>{label}</Text> : null}
      <View style={[styles.inputBox, focus && {borderColor: A.primary}, error && {borderColor: '#DC2626'}]}>
        {icon ? <Ionicons name={icon} size={19} color={focus ? A.primary : MUTED} /> : null}
        <TextInput
          style={[styles.input, F.regular]}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={secure && !show}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          {...props}
        />
        {ok ? <Ionicons name="checkmark-circle" size={20} color="#16A34A" /> : null}
        {secure ? (
          <TouchableOpacity onPress={() => setShow(v => !v)} hitSlop={8} accessibilityLabel={show ? 'Esconder senha' : 'Mostrar senha'}>
            <Ionicons name={show ? 'eye-outline' : 'eye-off-outline'} size={20} color={MUTED} />
          </TouchableOpacity>
        ) : null}
        {right}
      </View>
      {error ? <Text style={[styles.error, F.semibold]}>{error}</Text> : hint ? <Text style={[styles.hint, F.regular]}>{hint}</Text> : null}
    </View>
  );
}

export function PrimaryButton({title, onPress, loading, disabled, icon, testID, style}) {
  return (
    <TouchableOpacity
      style={[styles.primary, {backgroundColor: A.primary}, (disabled || loading) && {opacity: 0.55}, style]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      testID={testID}>
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={20} color="#FFFFFF" /> : null}
          <Text style={[styles.primaryText, F.heavy]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function SecondaryButton({title, onPress, icon, testID, disabled, style}) {
  return (
    <TouchableOpacity
      style={[styles.secondary, {borderColor: A.primary}, disabled && {opacity: 0.55}, style]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      testID={testID}>
      {icon ? <Ionicons name={icon} size={20} color={A.primary} /> : null}
      <Text style={[styles.secondaryText, F.heavy, {color: A.primary}]}>{title}</Text>
    </TouchableOpacity>
  );
}

export function LinkText({children, onPress, testID, style}) {
  return (
    <Pressable onPress={onPress} hitSlop={8} testID={testID} accessibilityRole="link">
      <Text style={[{color: A.primary, fontSize: 14}, F.bold, style]}>{children}</Text>
    </Pressable>
  );
}

export function Divider({text = 'ou'}) {
  return (
    <View style={styles.divider}>
      <View style={styles.line} />
      <Text style={[styles.dividerText, F.semibold]}>{text}</Text>
      <View style={styles.line} />
    </View>
  );
}

export function Note({icon = 'shield-checkmark', children}) {
  return (
    <View style={[styles.note, {backgroundColor: A.soft}]}>
      <Ionicons name={icon} size={18} color={A.primary} />
      <Text style={[styles.noteText, F.regular]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  hero: {paddingHorizontal: 24, paddingTop: 28, paddingBottom: 44, overflow: 'hidden'},
  circle1: {position: 'absolute', right: -50, top: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.07)'},
  circle2: {position: 'absolute', right: 70, bottom: -70, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.05)'},
  back: {width: 44, height: 44, marginLeft: -10, marginBottom: 4, alignItems: 'center', justifyContent: 'center'},
  brand: {flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22},
  logo: {width: 52, height: 52, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center'},
  brandName: {color: '#FFFFFF', fontSize: 18},
  title: {color: '#FFFFFF', fontSize: 28, lineHeight: 34},
  subtitle: {fontSize: 15, marginTop: 6, lineHeight: 21},
  sheet: {flexGrow: 1, backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -20, padding: 24, paddingBottom: 32},
  label: {fontSize: 13, color: INK, marginBottom: 6},
  inputBox: {flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: '#E7E4F0', backgroundColor: '#FAFAFD', borderRadius: 14, paddingHorizontal: 14, minHeight: 52},
  input: {flex: 1, fontSize: 16, color: INK, paddingVertical: 12},
  error: {color: '#B91C1C', fontSize: 12, marginTop: 5},
  hint: {color: MUTED, fontSize: 12, marginTop: 5},
  primary: {height: 54, borderRadius: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 6},
  primaryText: {color: '#FFFFFF', fontSize: 16},
  secondary: {height: 52, borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10},
  secondaryText: {fontSize: 15},
  divider: {flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18},
  line: {flex: 1, height: 1, backgroundColor: '#ECEAF3'},
  dividerText: {color: MUTED, fontSize: 13},
  note: {flexDirection: 'row', gap: 10, alignItems: 'center', borderRadius: 14, padding: 12, marginBottom: 16},
  noteText: {flex: 1, fontSize: 13, color: INK, lineHeight: 18},
});
