import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../../utils/api';
import { Colors } from '../../constants/Colors';

interface MealItem {
  name: string; quantity: string; calories: number; protein: number; carbs: number; fats: number; cost: number;
}
interface Meal {
  meal_type: string; items: MealItem[]; total_calories: number; total_protein: number; total_cost: number;
}

const MEAL_ICONS: Record<string, string> = {
  breakfast: 'coffee', lunch: 'food', dinner: 'food-turkey', snacks: 'cookie',
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
        <TouchableOpacity testID="upgrade-premium-btn" style={styles.upgradeBtn} onPress={onUpgrade}>
          <MaterialCommunityIcons name="crown" size={16} color={Colors.primaryFg} />
          <Text style={styles.upgradeBtnText}>Go Premium</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function DietScreen() {
  const [plan, setPlan] = useState<any>(null);
  const [planId, setPlanId] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState<any>(null);
  const [tier, setTier] = useState('free');
  const [tipsLocked, setTipsLocked] = useState(false);
  const [altsLocked, setAltsLocked] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState('breakfast');

  useEffect(() => { fetchDietPlan(); }, []);

  const fetchDietPlan = async () => {
    try {
      const res = await api('/diet/current');
      if (res.ok) {
        const data = await res.json();
        setPlan(data.plan_data || null);
        setPlanId(data.plan_id || '');
        setGenStatus(data.generation_status || null);
        setTier(data.subscription_tier || 'free');
        setTipsLocked(data.plan_data?.tips_locked || false);
        setAltsLocked(data.plan_data?.alternatives_locked || false);
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
      const res = await api('/diet/generate', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setPlan(data.plan_data);
        setPlanId(data.plan_id || '');
        setGenStatus(data.generation_status || genStatus);
        if (data.cached) {
          Alert.alert('Cached Plan', 'Showing your recent plan (cached for 7 days). Free users get fresh plans weekly.\n\nUpgrade to Premium for instant regeneration!');
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

  const searchFoods = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await api(`/foods/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setSearchResults(await res.json());
    } catch (_e) {}
    setSearching(false);
  };

  const logFood = async (food: any) => {
    const today = new Date().toISOString().split('T')[0];
    try {
      await api('/food-log', {
        method: 'POST',
        body: JSON.stringify({
          food_name: food.name, quantity_g: parseFloat(food.serving) || 100,
          calories: food.calories, protein: food.protein, carbs: food.carbs,
          fats: food.fats, meal_type: selectedMealType, date: today,
        }),
      });
      Alert.alert('Logged!', `${food.name} added to ${selectedMealType}`);
    } catch (_e) {
      Alert.alert('Error', 'Failed to log food');
    }
  };

  const handleUnlock = async () => {
    try {
      await api('/subscription/unlock-plan', {
        method: 'POST',
        body: JSON.stringify({ plan_id: planId, plan_type: 'diet' }),
      });
      fetchDietPlan();
      Alert.alert('Unlocked!', 'Full tips & alternatives are now visible for this plan.');
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
          fetchDietPlan();
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
            <Text style={styles.title}>Diet Plan</Text>
            <Text style={styles.subtitle}>AI-powered meal plan within your budget</Text>
          </View>
          {tier === 'premium' && (
            <View style={styles.premiumBadge}>
              <MaterialCommunityIcons name="crown" size={14} color={Colors.warning} />
              <Text style={styles.premiumText}>PRO</Text>
            </View>
          )}
        </View>

        <GenerationBadge status={genStatus} />

        <TouchableOpacity
          testID="generate-diet-btn"
          style={[styles.generateBtn, generating && styles.disabledBtn]}
          onPress={generatePlan}
          disabled={generating}
        >
          {generating ? (
            <View style={styles.generatingRow}>
              <ActivityIndicator color={Colors.primaryFg} />
              <Text style={styles.generateBtnText}>  GENERATING WITH AI...</Text>
            </View>
          ) : (
            <View style={styles.generatingRow}>
              <MaterialCommunityIcons name="robot" size={20} color={Colors.primaryFg} />
              <Text style={styles.generateBtnText}>  {plan ? 'REGENERATE PLAN' : 'GENERATE DIET PLAN'}</Text>
            </View>
          )}
        </TouchableOpacity>

        {plan && plan.meals && plan.meals.map((meal: Meal, idx: number) => (
          <View key={idx} style={styles.mealCard}>
            <View style={styles.mealHeader}>
              <MaterialCommunityIcons name={(MEAL_ICONS[meal.meal_type] || 'food') as any} size={24} color={Colors.primary} />
              <Text style={styles.mealType}>{meal.meal_type.toUpperCase()}</Text>
              <Text style={styles.mealStats}>{meal.total_calories} cal • {meal.total_protein}g P • ₹{meal.total_cost}</Text>
            </View>
            {meal.items.map((item, i) => (
              <View key={i} style={styles.foodItem}>
                <View style={styles.foodLeft}>
                  <Text style={styles.foodName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.foodQuantity} numberOfLines={1}>{item.quantity}</Text>
                </View>
                <View style={styles.foodRight}>
                  <Text style={styles.foodCal}>{item.calories} cal</Text>
                  <Text style={styles.foodProtein}>{item.protein}g P</Text>
                </View>
              </View>
            ))}
          </View>
        ))}

        {plan && plan.daily_totals && (
          <View style={styles.totalsCard}>
            <Text style={styles.totalsTitle}>Daily Totals</Text>
            <View style={styles.totalsRow}>
              <View style={styles.totalItem}>
                <Text style={styles.totalValue}>{plan.daily_totals.calories}</Text>
                <Text style={styles.totalLabel}>Calories</Text>
              </View>
              <View style={styles.totalItem}>
                <Text style={[styles.totalValue, { color: Colors.primary }]}>{plan.daily_totals.protein}g</Text>
                <Text style={styles.totalLabel}>Protein</Text>
              </View>
              <View style={styles.totalItem}>
                <Text style={[styles.totalValue, { color: Colors.secondary }]}>₹{plan.daily_totals.cost}</Text>
                <Text style={styles.totalLabel}>Cost</Text>
              </View>
            </View>
          </View>
        )}

        {plan && altsLocked && (
          <LockedSection title="Budget Alternatives" onUnlock={handleUnlock} onUpgrade={handleUpgrade} />
        )}

        {plan && !altsLocked && plan.alternatives && plan.alternatives.length > 0 && (
          <View style={styles.altCard}>
            <Text style={styles.altTitle}>Budget Alternatives</Text>
            {plan.alternatives.map((alt: any, i: number) => (
              <View key={i} style={styles.altRow}>
                <Text style={styles.altOriginal} numberOfLines={2}>{alt.original}</Text>
                <MaterialCommunityIcons name="arrow-right" size={16} color={Colors.primary} style={styles.altArrow} />
                <Text style={styles.altNew} numberOfLines={2}>{alt.alternative}</Text>
              </View>
            ))}
          </View>
        )}

        {plan && tipsLocked && (
          <LockedSection title="Pro Tips" onUnlock={handleUnlock} onUpgrade={handleUpgrade} />
        )}

        {plan && !tipsLocked && plan.tips && plan.tips.length > 0 && (
          <View style={styles.tipsCard}>
            <View style={styles.tipsHeader}>
              <Text style={styles.tipsTitle}>Pro Tips</Text>
              {tier === 'premium' && <Text style={styles.premiumLabel}>ALL UNLOCKED</Text>}
            </View>
            {plan.tips.map((tip: string, i: number) => (
              <View key={i} style={styles.tipRow}>
                <MaterialCommunityIcons name="lightbulb-on" size={18} color={Colors.warning} />
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.title, { marginTop: 32 }]}>Quick Log Food</Text>
        <View style={styles.mealTypeRow}>
          {['breakfast', 'lunch', 'snacks', 'dinner'].map(m => (
            <TouchableOpacity
              key={m}
              testID={`meal-type-${m}`}
              style={[styles.mealTypeChip, selectedMealType === m && styles.mealTypeChipActive]}
              onPress={() => setSelectedMealType(m)}
            >
              <Text style={[styles.mealTypeText, selectedMealType === m && styles.mealTypeTextActive]}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          testID="food-search-input"
          style={styles.searchInput}
          placeholder="Search foods worldwide..."
          placeholderTextColor={Colors.textTertiary}
          value={searchQuery}
          onChangeText={searchFoods}
        />
        {searching && <ActivityIndicator color={Colors.primary} style={{ marginVertical: 8 }} />}
        {searchResults.map((food, i) => (
          <TouchableOpacity key={i} testID={`food-result-${i}`} style={styles.searchResult} onPress={() => logFood(food)}>
            <View style={styles.resultLeft}>
              <Text style={styles.resultName} numberOfLines={1}>{food.name}</Text>
              <Text style={styles.resultServing}>{food.serving} • ₹{food.price_inr} • {(food.cuisine || 'global').replace('_', ' ')}</Text>
            </View>
            <View style={styles.resultRight}>
              <Text style={styles.resultCal}>{food.calories} cal</Text>
              <Text style={styles.resultProtein}>{food.protein}g P</Text>
            </View>
          </TouchableOpacity>
        ))}
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
  premiumText: { color: Colors.warning, fontSize: 12, fontWeight: '800' },
  genBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 14,
    alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.border,
  },
  genBadgeText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  generateBtn: { backgroundColor: Colors.primary, borderRadius: 4, paddingVertical: 16, alignItems: 'center', marginBottom: 20 },
  disabledBtn: { opacity: 0.6 },
  generatingRow: { flexDirection: 'row', alignItems: 'center' },
  generateBtnText: { color: Colors.primaryFg, fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  mealCard: {
    backgroundColor: Colors.cardBg, borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  mealHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  mealType: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  mealStats: { color: Colors.textSecondary, fontSize: 12 },
  foodItem: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border, alignItems: 'center',
  },
  foodLeft: { flex: 1, marginRight: 12 },
  foodName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '500' },
  foodQuantity: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  foodRight: { alignItems: 'flex-end', flexShrink: 0, minWidth: 70 },
  foodCal: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  foodProtein: { color: Colors.primary, fontSize: 12 },
  totalsCard: {
    backgroundColor: Colors.cardBg, borderRadius: 12, padding: 20, marginBottom: 16,
    borderWidth: 2, borderColor: Colors.primary,
  },
  totalsTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  totalItem: { alignItems: 'center' },
  totalValue: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  totalLabel: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 },
  // Locked Content
  lockedCard: {
    backgroundColor: Colors.cardBg, borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.warning, borderStyle: 'dashed',
  },
  lockedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  lockedTitle: { color: Colors.warning, fontSize: 16, fontWeight: '700' },
  lockedDesc: { color: Colors.textSecondary, fontSize: 13, marginBottom: 14, lineHeight: 19 },
  lockedBtns: { flexDirection: 'row', gap: 10 },
  unlockBtn: {
    flex: 1, borderWidth: 1, borderColor: Colors.warning, borderRadius: 6,
    paddingVertical: 10, alignItems: 'center',
  },
  unlockBtnText: { color: Colors.warning, fontSize: 13, fontWeight: '700' },
  upgradeBtn: {
    flex: 1, backgroundColor: Colors.primary, borderRadius: 6,
    paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  upgradeBtnText: { color: Colors.primaryFg, fontSize: 13, fontWeight: '700' },
  // Alternatives
  altCard: {
    backgroundColor: Colors.cardBg, borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  altTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  altRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  altOriginal: { color: Colors.textSecondary, fontSize: 14, flex: 1 },
  altArrow: { flexShrink: 0 },
  altNew: { color: Colors.primary, fontSize: 14, fontWeight: '600', flex: 1 },
  // Tips
  tipsCard: {
    backgroundColor: Colors.cardBg, borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  tipsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tipsTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  premiumLabel: { color: Colors.success, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  tipRow: { flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'flex-start' },
  tipText: { color: Colors.textSecondary, fontSize: 14, flex: 1 },
  // Food search
  mealTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  mealTypeChip: {
    backgroundColor: Colors.surface, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  mealTypeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  mealTypeText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  mealTypeTextActive: { color: Colors.primaryFg },
  searchInput: {
    backgroundColor: Colors.surface, borderRadius: 8, padding: 14, color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.border, fontSize: 16, marginBottom: 12,
  },
  searchResult: {
    backgroundColor: Colors.cardBg, borderRadius: 8, padding: 14, marginBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  resultLeft: { flex: 1, marginRight: 12 },
  resultName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  resultServing: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  resultRight: { alignItems: 'flex-end', flexShrink: 0, minWidth: 70 },
  resultCal: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  resultProtein: { color: Colors.primary, fontSize: 12 },
});
