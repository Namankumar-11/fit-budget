import { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { api, setToken } from '../utils/api';
import { Colors } from '../constants/Colors';

export default function AuthCallback() {
  const router = useRouter();
  const rootNavState = useRootNavigationState();
  const processed = useRef(false);
  const [status, setStatus] = useState('Signing you in...');

  useEffect(() => {
    // Wait for navigator to be fully mounted before navigating
    if (!rootNavState?.key) return;
    if (processed.current) return;
    processed.current = true;

    const processAuth = async () => {
      let sessionId = '';
      if (Platform.OS === 'web') {
        // Web: extract session_id from URL hash
        try {
          const hash = window.location.hash;
          const match = hash.match(/session_id=([^&]+)/);
          if (match) sessionId = match[1];
        } catch (_e) {
          // Not on web
        }
      }

      if (!sessionId) {
        setStatus('No session found. Redirecting...');
        // Small delay to ensure navigation is ready
        setTimeout(() => router.replace('/'), 100);
        return;
      }

      try {
        setStatus('Verifying your account...');
        const res = await api('/auth/google-session', {
          method: 'POST',
          body: JSON.stringify({ session_id: sessionId }),
        });
        if (res.ok) {
          const data = await res.json();
          await setToken(data.session_token);
          setStatus('Success! Redirecting...');
          if (data.onboarding_complete) {
            router.replace('/(tabs)');
          } else {
            router.replace('/onboarding');
          }
        } else {
          setStatus('Authentication failed. Redirecting...');
          setTimeout(() => router.replace('/'), 500);
        }
      } catch (_e) {
        setStatus('Something went wrong. Redirecting...');
        setTimeout(() => router.replace('/'), 500);
      }
    };

    processAuth();
  }, [rootNavState?.key]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.text}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  text: { color: Colors.textSecondary, marginTop: 16, fontSize: 16, textAlign: 'center', paddingHorizontal: 32 },
});
