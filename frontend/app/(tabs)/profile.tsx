import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api, clearToken } from '../../utils/api';
import { Colors } from '../../constants/Colors';

const GOAL_LABELS: Record<string, string> = {
  fat_loss: 'Fat Loss', muscle_gain: 'Muscle Gain', body_recomposition: 'Body Recomposition',
};

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    try {
      const res = await api('/auth/me');
      if (res.ok) setUser(await res.json());
    } catch (e) {}
    setLoading(false);
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await api('/auth/logout', { method: 'POST' });
          await clearToken();
          router.replace('/');
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name || 'U')[0].toUpperCase()}</Text>
          </View>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>
        </View>

        {user?.onboarding_complete && (
          <>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Body Stats</Text>
              <InfoRow icon="human-male-height" label="Height" value={`${user?.height_cm || '-'} cm`} />
              <InfoRow icon="weight-kilogram" label="Weight" value={`${user?.weight_kg || '-'} kg`} />
              <InfoRow icon="cake-variant" label="Age" value={`${user?.age || '-'} years`} />
              <InfoRow icon="gender-male-female" label="Gender" value={user?.gender || '-'} />
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Fitness Goals</Text>
              <InfoRow icon="target" label="Goal" value={GOAL_LABELS[user?.fitness_goal] || user?.fitness_goal || '-'} />
              <InfoRow icon="dumbbell" label="Experience" value={user?.training_experience || '-'} />
              <InfoRow icon="home-city" label="Workout Location" value={user?.workout_location || '-'} />
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Diet Preferences</Text>
              <InfoRow icon="food-apple" label="Food Preference" value={user?.food_preference || '-'} />
              <InfoRow icon="alert-circle" label="Allergies" value={user?.allergies || 'None'} />
              <InfoRow icon="currency-inr" label="Daily Budget" value={`₹${user?.daily_budget || '-'}`} />
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Daily Targets</Text>
              <InfoRow icon="fire" label="Calories" value={`${user?.target_calories || '-'} cal`} />
              <InfoRow icon="molecule" label="Protein" value={`${user?.protein_g || '-'}g`} />
              <InfoRow icon="barley" label="Carbs" value={`${user?.carbs_g || '-'}g`} />
              <InfoRow icon="water" label="Fats" value={`${user?.fats_g || '-'}g`} />
            </View>
          </>
        )}

        <TouchableOpacity testID="logout-btn" style={styles.logoutBtn} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <MaterialCommunityIcons name={icon as any} size={20} color={Colors.textTertiary} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, marginBottom: 20 },
  profileCard: {
    backgroundColor: Colors.cardBg, borderRadius: 16, padding: 24,
    alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: '900', color: Colors.primaryFg },
  userName: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  userEmail: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  sectionCard: {
    backgroundColor: Colors.cardBg, borderRadius: 12, padding: 20, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 14 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoLabel: { color: Colors.textSecondary, fontSize: 14 },
  infoValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, marginTop: 12, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.error,
  },
  logoutText: { color: Colors.error, fontSize: 16, fontWeight: '700' },
});
