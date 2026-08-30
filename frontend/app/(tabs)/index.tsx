import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../../utils/api';
import { Colors } from '../../constants/Colors';

interface DashboardData {
  user: any;
  today: { calories_consumed: number; protein_consumed: number; carbs_consumed: number; fats_consumed: number; food_logs: any[] };
  targets: { calories: number; protein: number; carbs: number; fats: number };
  has_diet_plan: boolean;
  has_workout_plan: boolean;
  latest_weight: any;
}

function MacroBar({ label, current, target, color }: { label: string; current: number; target: number; color: string }) {
  const pct = Math.min((current / target) * 100, 100);
  return (
    <View style={styles.macroItem}>
      <View style={styles.macroHeader}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>{current}<Text style={styles.macroTarget}>/{target}g</Text></Text>
      </View>
      <View style={styles.macroTrack}>
        <View style={[styles.macroFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const pct = Math.min((consumed / target) * 100, 100);
  const remaining = Math.max(target - consumed, 0);
  return (
    <View style={styles.calorieCard}>
      <View style={styles.calorieCircle}>
        <Text style={styles.calorieNumber}>{consumed}</Text>
        <Text style={styles.calorieUnit}>cal eaten</Text>
      </View>
      <View style={styles.calorieInfo}>
        <View style={styles.calorieRow}>
          <MaterialCommunityIcons name="fire" size={20} color={Colors.primary} />
          <Text style={styles.calorieText}>Target: {target} cal</Text>
        </View>
        <View style={styles.calorieRow}>
          <MaterialCommunityIcons name="minus-circle" size={20} color={Colors.secondary} />
          <Text style={styles.calorieText}>Remaining: {remaining} cal</Text>
        </View>
        <View style={styles.caloriePctTrack}>
          <View style={[styles.caloriePctFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.caloriePctText}>{Math.round(pct)}% of daily goal</Text>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api('/dashboard');
      if (res.ok) {
        setData(await res.json());
      } else if (res.status === 401) {
        router.replace('/');
      }
    } catch (e) {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchDashboard(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchDashboard(); };

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  if (!data) {
    return <View style={styles.loadingContainer}><Text style={styles.errorText}>Failed to load dashboard</Text></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {data.user?.name || 'User'}</Text>
            <Text style={styles.dateText}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          </View>
          <MaterialCommunityIcons name="bell-outline" size={26} color={Colors.textSecondary} />
        </View>

        <CalorieRing consumed={data.today.calories_consumed} target={data.targets.calories} />

        <View style={styles.macrosCard}>
          <Text style={styles.sectionTitle}>Today's Macros</Text>
          <MacroBar label="Protein" current={data.today.protein_consumed} target={data.targets.protein} color="#CCFF00" />
          <MacroBar label="Carbs" current={data.today.carbs_consumed} target={data.targets.carbs} color="#007AFF" />
          <MacroBar label="Fats" current={data.today.fats_consumed} target={data.targets.fats} color="#FF3B30" />
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity testID="quick-log-food" style={styles.actionBtn} onPress={() => router.push('/(tabs)/diet')}>
            <MaterialCommunityIcons name="plus-circle" size={28} color={Colors.primary} />
            <Text style={styles.actionText}>Log Food</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="quick-view-workout" style={styles.actionBtn} onPress={() => router.push('/(tabs)/workout')}>
            <MaterialCommunityIcons name="dumbbell" size={28} color={Colors.secondary} />
            <Text style={styles.actionText}>Workout</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="quick-log-weight" style={styles.actionBtn} onPress={() => router.push('/(tabs)/progress')}>
            <MaterialCommunityIcons name="scale-bathroom" size={28} color={Colors.warning} />
            <Text style={styles.actionText}>Log Weight</Text>
          </TouchableOpacity>
        </View>

        {!data.has_diet_plan && (
          <TouchableOpacity testID="generate-diet-cta" style={styles.ctaCard} onPress={() => router.push('/(tabs)/diet')}>
            <MaterialCommunityIcons name="food-apple" size={32} color={Colors.primary} />
            <View style={styles.ctaContent}>
              <Text style={styles.ctaTitle}>Generate Your Diet Plan</Text>
              <Text style={styles.ctaDesc}>AI-powered Indian meal plan within your budget</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}

        {!data.has_workout_plan && (
          <TouchableOpacity testID="generate-workout-cta" style={styles.ctaCard} onPress={() => router.push('/(tabs)/workout')}>
            <MaterialCommunityIcons name="dumbbell" size={32} color={Colors.secondary} />
            <View style={styles.ctaContent}>
              <Text style={styles.ctaTitle}>Generate Workout Plan</Text>
              <Text style={styles.ctaDesc}>Personalized training based on your goals</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}

        {data.today.food_logs.length > 0 && (
          <View style={styles.logsCard}>
            <Text style={styles.sectionTitle}>Today's Food Log</Text>
            {data.today.food_logs.slice(0, 5).map((log: any, i: number) => (
              <View key={i} style={styles.logRow}>
                <View style={styles.logLeft}>
                  <Text style={styles.logFood} numberOfLines={1}>{log.food_name}</Text>
                  <Text style={styles.logMeal}>{log.meal_type} • {log.quantity_g}g</Text>
                </View>
                <View style={styles.logRight}>
                  <Text style={styles.logCal}>{log.calories} cal</Text>
                  <Text style={styles.logProtein}>{log.protein}g protein</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {data.latest_weight && (
          <View style={styles.weightCard}>
            <MaterialCommunityIcons name="scale-bathroom" size={24} color={Colors.warning} />
            <Text style={styles.weightText}>Current Weight: {data.latest_weight.weight_kg} kg</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: Colors.textSecondary, fontSize: 16 },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  dateText: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  calorieCard: {
    backgroundColor: Colors.cardBg, borderRadius: 12, padding: 20,
    flexDirection: 'row', alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  calorieCircle: {
    width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center', marginRight: 20,
  },
  calorieNumber: { fontSize: 28, fontWeight: '900', color: Colors.primary },
  calorieUnit: { fontSize: 11, color: Colors.textSecondary },
  calorieInfo: { flex: 1 },
  calorieRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  calorieText: { color: Colors.textSecondary, fontSize: 14 },
  caloriePctTrack: { height: 6, backgroundColor: Colors.surface, borderRadius: 3, marginTop: 8 },
  caloriePctFill: { height: 6, backgroundColor: Colors.primary, borderRadius: 3 },
  caloriePctText: { color: Colors.textTertiary, fontSize: 12, marginTop: 4 },
  macrosCard: {
    backgroundColor: Colors.cardBg, borderRadius: 12, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },
  macroItem: { marginBottom: 14 },
  macroHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  macroLabel: { color: Colors.textSecondary, fontSize: 14, fontWeight: '500' },
  macroValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  macroTarget: { color: Colors.textTertiary, fontWeight: '400' },
  macroTrack: { height: 8, backgroundColor: Colors.surface, borderRadius: 4 },
  macroFill: { height: 8, borderRadius: 4 },
  quickActions: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  actionBtn: {
    flex: 1, backgroundColor: Colors.cardBg, borderRadius: 12, padding: 16,
    alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  actionText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  ctaCard: {
    backgroundColor: Colors.cardBg, borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center', marginBottom: 12,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  ctaContent: { flex: 1, marginLeft: 16 },
  ctaTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  ctaDesc: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  logsCard: {
    backgroundColor: Colors.cardBg, borderRadius: 12, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  logRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border, alignItems: 'center',
  },
  logLeft: { flex: 1, marginRight: 12 },
  logFood: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  logMeal: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  logRight: { alignItems: 'flex-end', flexShrink: 0, minWidth: 70 },
  logCal: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  logProtein: { color: Colors.primary, fontSize: 12, marginTop: 2 },
  weightCard: {
    backgroundColor: Colors.cardBg, borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  weightText: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600' },
});
