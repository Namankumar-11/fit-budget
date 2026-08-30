import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Alert
} from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { api, setToken, getToken } from '../utils/api';
import { Colors } from '../constants/Colors';

export default function AuthScreen() {
  const router = useRouter();
  const rootNavState = useRootNavigationState();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const checkAuth = async () => {
    try {
      const token = await getToken();
      if (token) {
        const res = await api('/auth/me');
        if (res.ok) {
          const user = await res.json();
          if (user.onboarding_complete) {
            router.replace('/(tabs)');
          } else {
            router.replace('/onboarding');
          }
          return;
        }
      }
    } catch (_e) {
      // Auth check failed, show login
    }
    setLoading(false);
  };

  useEffect(() => {
    // Wait for navigator to be mounted before auto-redirect
    if (!rootNavState?.key) return;
    checkAuth();
  }, [rootNavState?.key]);

  const handleSubmit = async () => {
    if (!email || !password || (!isLogin && !name)) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    setSubmitting(true);
    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const body = isLogin ? { email, password } : { email, password, name };
      const res = await api(endpoint, { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Error', data.detail || 'Something went wrong');
        setSubmitting(false);
        return;
      }
      await setToken(data.session_token);
      if (data.onboarding_complete) {
        router.replace('/(tabs)');
      } else {
        router.replace('/onboarding');
      }
    } catch (_e) {
      Alert.alert('Error', 'Network error. Please try again.');
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (Platform.OS === 'web') {
      // Web: redirect to Emergent auth page
      const redirectUrl = window.location.origin + '/auth-callback';
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    } else {
      // Mobile (Android/iOS): use WebBrowser auth session
      setGoogleLoading(true);
      try {
        const redirectUrl = Linking.createURL('/auth-callback');
        const result = await WebBrowser.openAuthSessionAsync(
          `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`,
          redirectUrl
        );

        if (result.type === 'success' && result.url) {
          // Extract session_id from the returned URL hash
          const urlStr = result.url;
          const hashIndex = urlStr.indexOf('#');
          if (hashIndex !== -1) {
            const hash = urlStr.substring(hashIndex);
            const match = hash.match(/session_id=([^&]+)/);
            if (match) {
              const sessionId = match[1];
              const res = await api('/auth/google-session', {
                method: 'POST',
                body: JSON.stringify({ session_id: sessionId }),
              });
              if (res.ok) {
                const data = await res.json();
                await setToken(data.session_token);
                if (data.onboarding_complete) {
                  router.replace('/(tabs)');
                } else {
                  router.replace('/onboarding');
                }
              } else {
                Alert.alert('Error', 'Google sign-in failed. Please try again.');
              }
            } else {
              Alert.alert('Error', 'Could not process Google sign-in. Please try again.');
            }
          } else {
            Alert.alert('Error', 'Google sign-in was not completed.');
          }
        } else if (result.type === 'cancel' || result.type === 'dismiss') {
          // User cancelled - do nothing
        }
      } catch (_e) {
        Alert.alert('Error', 'Google sign-in failed. Please try again.');
      }
      setGoogleLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <MaterialCommunityIcons name="dumbbell" size={48} color={Colors.primary} />
            <Text style={styles.title}>FitBudget</Text>
            <Text style={styles.subtitle}>Smart Fitness & Diet Planner</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.formTitle}>{isLogin ? 'Welcome Back' : 'Create Account'}</Text>

            {!isLogin && (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  testID="name-input"
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                testID="email-input"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  testID="password-input"
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  placeholderTextColor={Colors.textTertiary}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  testID="toggle-password-btn"
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <MaterialCommunityIcons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={22}
                    color={Colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              testID="submit-btn"
              style={[styles.primaryBtn, submitting && styles.disabledBtn]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={Colors.primaryFg} />
              ) : (
                <Text style={styles.primaryBtnText}>{isLogin ? 'LOGIN' : 'SIGN UP'}</Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              testID="google-login-btn"
              style={[styles.googleBtn, googleLoading && styles.disabledBtn]}
              onPress={handleGoogleLogin}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color={Colors.textPrimary} />
              ) : (
                <>
                  <MaterialCommunityIcons name="google" size={22} color={Colors.textPrimary} />
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity testID="toggle-auth-btn" onPress={() => setIsLogin(!isLogin)}>
              <Text style={styles.toggleText}>
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <Text style={styles.toggleLink}>{isLogin ? 'Sign Up' : 'Login'}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 36, fontWeight: '900', color: Colors.primary, marginTop: 12, letterSpacing: 2 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4, letterSpacing: 1 },
  form: { width: '100%' },
  formTitle: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, marginBottom: 24 },
  inputContainer: { marginBottom: 16 },
  label: { color: Colors.textSecondary, fontSize: 14, marginBottom: 8 },
  input: {
    backgroundColor: Colors.surface, borderRadius: 4, borderWidth: 1, borderColor: Colors.border,
    padding: 16, color: Colors.textPrimary, fontSize: 16,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1 },
  eyeBtn: { position: 'absolute', right: 16 },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: 4, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
  },
  disabledBtn: { opacity: 0.6 },
  primaryBtnText: { color: Colors.primaryFg, fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textTertiary, marginHorizontal: 16, fontSize: 12 },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface, borderRadius: 4, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 14, marginBottom: 24, gap: 10,
  },
  googleBtnText: { color: Colors.textPrimary, fontSize: 16, fontWeight: '500' },
  toggleText: { color: Colors.textSecondary, textAlign: 'center', fontSize: 14 },
  toggleLink: { color: Colors.primary, fontWeight: '700' },
});
