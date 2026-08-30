import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../../utils/api';
import { Colors } from '../../constants/Colors';

const DAY_COLORS: Record<string, string> = {
  Monday: '#CCFF00', Tuesday: '#007AFF', Wednesday: '#FF3B30',
  Thursday: '#34C759', Friday: '#FFD60A', Saturday: '#FF9500', Sunday: '#AF52DE',
};

function GenerationBadge({ status }: { status: any }) {
  if (!status) return null;
  return (
    <View style={styles.genBadge}>
      <MaterialCommunityIcons name="lightning-bolt" size={14} color={Colors.primaryFg} />
      <Text style={styles.genBadgeText}>{status.remaining}/{status.limit} generations left</Text>
    </View>
  );
}

function LockedSection({ title, onUnlock, onUpgrade }: { title: string; onUnlock: () => void; onUpgrade: () => void }) {
  return (
    <View style={styles.lockedCard}>
      <View style={styles.lockedHeader}>
        <MaterialCommunityIcons name="lock" size={20} color={Colors.warning} />
        <Text style={styles.lockedTitle}>{title}</Text>
      </View>
      <Text style={styles.lockedDesc}>Upgrade to Premium to unlock all {title.toLowerCase()}, or unlock this plan only.</Text>
      <View style={styles.lockedBtns}>
        <TouchableOpacity testID={`unlock-${title.toLowerCase()}-btn`} style={styles.unlockBtn} onPress={onUnlock}>
          <Text style={styles.unlockBtnText}>Unlock This Plan</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="upgrade-premium-workout-btn" style={styles.upgradeBtn} onPress={onUpgrade}>
          <MaterialCommunityIcons name="crown" size={16} color={Colors.primaryFg} />
          <Text style={styles.upgradeBtnText}>Go Premium</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function WorkoutScreen() {
  const [plan, setPlan] = useState<any>(null);
  const [planId, setPlanId] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState<any>(null);
  const [tier, setTier] = useState('free');
  const [tipsLocked, setTipsLocked] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  useEffect(() => { fetchWorkoutPlan(); }, []);

  const fetchWorkoutPlan = async () => {
    try {
      const res = await api('/workout/current');
      if (res.ok) {
        const data = await res.json();
        setPlan(data.plan_data || null);
        setPlanId(data.plan_id || '');
        setGenStatus(data.generation_status || null);
        setTier(data.subscription_tier || 'free');
        setTipsLocked(data.plan_data?.tips_locked || false);
      }
    } catch (_e) {}
    setLoading(false);
  };

  const generatePlan = async () => {
    if (genStatus && genStatus.remaining <= 0) {
      Alert.alert('Limit Reached', `You've used all ${genStatus.limit} generations this month.\n\nUpgrade to Premium for 60/month!`);
      return;
    }
    setGenerating(true);
    try {
      const res = await api('/workout/generate', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setPlan(data.plan_data);
        setPlanId(data.plan_id || '');
        setGenStatus(data.generation_status || genStatus);
        if (data.cached) {
          Alert.alert('Cached Plan', 'Showing your recent plan (cached 7 days). Upgrade to Premium for instant regen!');
        }
      } else if (res.status === 429) {
        const err = await res.json();
        Alert.alert('Limit Reached', err.detail);
      } else {
        const err = await res.json();
        Alert.alert('Error', err.detail || 'Failed to generate');
      }
    } catch (_e) {
      Alert.alert('Error', 'Network error');
    }
    setGenerating(false);
  };

  const handleUnlock = async () => {
    try {
      await api('/subscription/unlock-plan', {
        method: 'POST',
        body: JSON.stringify({ plan_id: planId, plan_type: 'workout' }),
      });
      fetchWorkoutPlan();
      Alert.alert('Unlocked!', 'Full tips are now visible for this plan.');
    } catch (_e) {}
  };

  const handleUpgrade = async () => {
    Alert.alert(
      'Upgrade to Premium',
      'India: ₹79/month (₹599/year)\nGlobal: $1.99/month ($14.99/year)\n\nGet 60 AI generations/month, all tips, all alternatives!',
      [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Upgrade', onPress: async () => {
          await api('/subscription/upgrade', { method: 'POST' });
          fetchWorkoutPlan();
          Alert.alert('Welcome to Premium!', 'All features unlocked.');
        }},
      ]
    );
  };

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>Workout Plan</Text>
            <Text style={styles.subtitle}>Personalized training for your goals</Text>
          </View>
          {tier === 'premium' && (
            <View style={styles.premiumBadge}>
              <MaterialCommunityIcons name="crown" size={14} color={Colors.warning} />
              <Text style={styles.premiumBadgeText}>PRO</Text>
            </View>
          )}
        </View>

        <GenerationBadge status={genStatus} />

        <TouchableOpacity
          testID="generate-workout-btn"
          style={[styles.generateBtn, generating && styles.disabledBtn]}
          onPress={generatePlan}
          disabled={generating}
        >
          {generating ? (
            <View style={styles.row}>
              <ActivityIndicator color={Colors.primaryFg} />
              <Text style={styles.generateBtnText}>  GENERATING WITH AI...</Text>
            </View>
          ) : (
            <View style={styles.row}>
              <MaterialCommunityIcons name="robot" size={20} color={Colors.primaryFg} />
              <Text style={styles.generateBtnText}>  {plan ? 'REGENERATE PLAN' : 'GENERATE WORKOUT PLAN'}</Text>
            </View>
          )}
        </TouchableOpacity>

        {plan && (
          <View style={styles.planHeader}>
            <Text style={styles.planName}>{plan.plan_name}</Text>
            <Text style={styles.planDays}>{plan.days_per_week} days/week</Text>
          </View>
        )}

        {plan && plan.days && plan.days.map((day: any, idx: number) => {
          const isExpanded = expandedDay === day.day;
          const dayColor = DAY_COLORS[day.day] || Colors.primary;
          return (
            <View key={idx}>
              <TouchableOpacity
                testID={`day-${day.day}`}
                style={styles.dayCard}
                onPress={() => setExpandedDay(isExpanded ? null : day.day)}
              >
                <View style={[styles.dayIndicator, { backgroundColor: dayColor }]} />
                <View style={styles.dayInfo}>
                  <Text style={styles.dayName}>{day.day}</Text>
                  <Text style={styles.dayFocus}>{day.focus}</Text>
                </View>
                <View style={styles.dayMeta}>
                  <Text style={styles.dayDuration}>{day.duration_minutes} min</Text>
                  <MaterialCommunityIcons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={22} color={Colors.textTertiary} />
                </View>
              </TouchableOpacity>
              {isExpanded && day.exercises && (
                <View style={styles.exercisesContainer}>
                  {day.exercises.map((ex: any, i: number) => (
                    <View key={i} style={styles.exerciseCard}>
                      <View style={styles.exerciseRow}>
                        <View style={styles.exNumber}>
                          <Text style={styles.exNumberText}>{i + 1}</Text>
                        </View>
                        <View style={styles.exInfo}>
                          <Text style={styles.exName}>{ex.name}</Text>
                          <View style={styles.exDetails}>
                            <View style={styles.exTag}>
                              <Text style={styles.exTagText}>{ex.sets} sets</Text>
                            </View>
                            <View style={styles.exTag}>
                              <Text style={styles.exTagText}>{ex.reps} reps</Text>
                            </View>
                            <View style={styles.exTag}>
                              <MaterialCommunityIcons name="timer-outline" size={14} color={Colors.textSecondary} />
                              <Text style={styles.exTagText}> {ex.rest_seconds}s</Text>
                            </View>
                          </View>
                          {ex.notes && <Text style={styles.exNotes}>{ex.notes}</Text>}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {plan && tipsLocked && (
          <LockedSection title="Training Tips" onUnlock={handleUnlock} onUpgrade={handleUpgrade} />
        )}

        {plan && !tipsLocked && plan.tips && plan.tips.length > 0 && (
          <View style={styles.tipsCard}>
            <View style={styles.tipsHeader}>
              <Text style={styles.tipsTitle}>Training Tips</Text>
              {tier === 'premium' && <Text style={styles.premiumLabel}>ALL UNLOCKED</Text>}
            </View>
            {plan.tips.map((tip: string, i: number) => (
              <View key={i} style={styles.tipRow}>
                <MaterialCommunityIcons name="check-circle" size={18} color={Colors.success} />
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { color: Colors.textSecondary, fontSize: 14, marginTop: 4, marginBottom: 12 },
  premiumBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,214,10,0.15)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
  },
  premiumBadgeText: { color: Colors.warning, fontSize: 12, fontWeight: '800' },
  genBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 14,
    alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.border,
  },
  genBadgeText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  generateBtn: { backgroundColor: Colors.primary, borderRadius: 4, paddingVertical: 16, alignItems: 'center', marginBottom: 20 },
  disabledBtn: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  generateBtnText: { color: Colors.primaryFg, fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  planHeader: {
    backgroundColor: Colors.cardBg, borderRadius: 12, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.cardBorder, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  planName: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, flex: 1, marginRight: 8 },
  planDays: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  dayCard: {
    backgroundColor: Colors.cardBg, borderRadius: 12, padding: 16, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder,
  },
  dayIndicator: { width: 4, height: 40, borderRadius: 2, marginRight: 14 },
  dayInfo: { flex: 1, marginRight: 8 },
  dayName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  dayFocus: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  dayMeta: { alignItems: 'flex-end', gap: 4 },
  dayDuration: { color: Colors.textSecondary, fontSize: 13 },
  exercisesContainer: { backgroundColor: Colors.surface, borderRadius: 8, padding: 12, marginBottom: 12, marginTop: -4 },
  exerciseCard: { marginBottom: 12 },
  exerciseRow: { flexDirection: 'row', gap: 12 },
  exNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  exNumberText: { color: Colors.primaryFg, fontWeight: '800', fontSize: 13 },
  exInfo: { flex: 1, flexShrink: 1 },
  exName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  exDetails: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  exTag: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceHighlight,
    borderRadius: 4, paddingVertical: 4, paddingHorizontal: 8,
  },
  exTagText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '500' },
  exNotes: { color: Colors.textTertiary, fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  // Locked
  lockedCard: {
    backgroundColor: Colors.cardBg, borderRadius: 12, padding: 16, marginTop: 12, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.warning, borderStyle: 'dashed',
  },
  lockedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  lockedTitle: { color: Colors.warning, fontSize: 16, fontWeight: '700' },
  lockedDesc: { color: Colors.textSecondary, fontSize: 13, marginBottom: 14, lineHeight: 19 },
  lockedBtns: { flexDirection: 'row', gap: 10 },
  unlockBtn: { flex: 1, borderWidth: 1, borderColor: Colors.warning, borderRadius: 6, paddingVertical: 10, alignItems: 'center' },
  unlockBtnText: { color: Colors.warning, fontSize: 13, fontWeight: '700' },
  upgradeBtn: {
    flex: 1, backgroundColor: Colors.primary, borderRadius: 6,
    paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  upgradeBtnText: { color: Colors.primaryFg, fontSize: 13, fontWeight: '700' },
  // Tips
  tipsCard: {
    backgroundColor: Colors.cardBg, borderRadius: 12, padding: 16, marginTop: 12,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  tipsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tipsTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  premiumLabel: { color: Colors.success, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  tipRow: { flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'flex-start' },
  tipText: { color: Colors.textSecondary, fontSize: 14, flex: 1 },
});
