import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../utils/api';
import { Colors } from '../constants/Colors';

const STEPS = ['Personal Info', 'Fitness Goals', 'Diet Preferences', 'Budget'];
const GOALS = ['fat_loss', 'muscle_gain', 'body_recomposition'];
const EXPERIENCE = ['beginner', 'intermediate', 'advanced'];
const LOCATIONS = ['gym', 'home'];
const FOOD_PREFS = ['veg', 'non-veg', 'eggitarian'];

function Chip({ label, selected, onPress, testID }: { label: string; selected: boolean; onPress: () => void; testID: string }) {
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    age: '', gender: 'male', height_cm: '', weight_kg: '',
    fitness_goal: 'fat_loss', training_experience: 'beginner',
    workout_location: 'gym', food_preference: 'non-veg',
    allergies: '', daily_budget: '200',
  });

  const update = (key: string, value: string) => setForm(p => ({ ...p, [key]: value }));

  const next = () => {
    if (step === 0 && (!form.age || !form.height_cm || !form.weight_kg)) {
      Alert.alert('Required', 'Please fill all fields'); return;
    }
    if (step < 3) setStep(step + 1);
    else handleSubmit();
  };

  const handleSubmit = async () => {
    if (!form.daily_budget) { Alert.alert('Required', 'Enter your daily food budget'); return; }
    setLoading(true);
    try {
      const res = await api('/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          age: parseInt(form.age), gender: form.gender,
          height_cm: parseFloat(form.height_cm), weight_kg: parseFloat(form.weight_kg),
          fitness_goal: form.fitness_goal, training_experience: form.training_experience,
          workout_location: form.workout_location, food_preference: form.food_preference,
          allergies: form.allergies, daily_budget: parseInt(form.daily_budget),
        }),
      });
      if (res.ok) {
        router.replace('/(tabs)');
      } else {
        const d = await res.json();
        Alert.alert('Error', d.detail || 'Failed to save');
        setLoading(false);
      }
    } catch (e) {
      Alert.alert('Error', 'Network error');
      setLoading(false);
    }
  };

  const renderStep0 = () => (
    <>
      <Text style={styles.stepTitle}>Tell us about yourself</Text>
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Age</Text>
        <TextInput testID="age-input" style={styles.input} value={form.age} onChangeText={v => update('age', v)} placeholder="25" placeholderTextColor={Colors.textTertiary} keyboardType="numeric" />
      </View>
      <Text style={styles.label}>Gender</Text>
      <View style={styles.chipRow}>
        <Chip testID="gender-male" label="Male" selected={form.gender === 'male'} onPress={() => update('gender', 'male')} />
        <Chip testID="gender-female" label="Female" selected={form.gender === 'female'} onPress={() => update('gender', 'female')} />
      </View>
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Height (cm)</Text>
        <TextInput testID="height-input" style={styles.input} value={form.height_cm} onChangeText={v => update('height_cm', v)} placeholder="175" placeholderTextColor={Colors.textTertiary} keyboardType="numeric" />
      </View>
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Weight (kg)</Text>
        <TextInput testID="weight-input" style={styles.input} value={form.weight_kg} onChangeText={v => update('weight_kg', v)} placeholder="70" placeholderTextColor={Colors.textTertiary} keyboardType="numeric" />
      </View>
    </>
  );

  const renderStep1 = () => (
    <>
      <Text style={styles.stepTitle}>Your Fitness Goals</Text>
      <Text style={styles.label}>What's your goal?</Text>
      <View style={styles.chipRow}>
        {GOALS.map(g => (
          <Chip key={g} testID={`goal-${g}`} label={g.replace('_', ' ').toUpperCase()} selected={form.fitness_goal === g} onPress={() => update('fitness_goal', g)} />
        ))}
      </View>
      <Text style={[styles.label, { marginTop: 16 }]}>Training Experience</Text>
      <View style={styles.chipRow}>
        {EXPERIENCE.map(e => (
          <Chip key={e} testID={`exp-${e}`} label={e.toUpperCase()} selected={form.training_experience === e} onPress={() => update('training_experience', e)} />
        ))}
      </View>
      <Text style={[styles.label, { marginTop: 16 }]}>Workout Location</Text>
      <View style={styles.chipRow}>
        {LOCATIONS.map(l => (
          <Chip key={l} testID={`loc-${l}`} label={l.toUpperCase()} selected={form.workout_location === l} onPress={() => update('workout_location', l)} />
        ))}
      </View>
    </>
  );

  const renderStep2 = () => (
    <>
      <Text style={styles.stepTitle}>Diet Preferences</Text>
      <Text style={styles.label}>Food Preference</Text>
      <View style={styles.chipRow}>
        {FOOD_PREFS.map(f => (
          <Chip key={f} testID={`food-${f}`} label={f.toUpperCase()} selected={form.food_preference === f} onPress={() => update('food_preference', f)} />
        ))}
      </View>
      <View style={[styles.inputContainer, { marginTop: 16 }]}>
        <Text style={styles.label}>Any Allergies? (optional)</Text>
        <TextInput testID="allergies-input" style={styles.input} value={form.allergies} onChangeText={v => update('allergies', v)} placeholder="e.g., peanuts, dairy" placeholderTextColor={Colors.textTertiary} />
      </View>
    </>
  );

  const renderStep3 = () => (
    <>
      <Text style={styles.stepTitle}>Your Daily Food Budget</Text>
      <Text style={styles.budgetDesc}>How much do you spend on food per day?</Text>
      <View style={styles.budgetInputRow}>
        <Text style={styles.rupee}>₹</Text>
        <TextInput
          testID="budget-input"
          style={[styles.input, styles.budgetInput]}
          value={form.daily_budget}
          onChangeText={v => update('daily_budget', v)}
          placeholder="200"
          placeholderTextColor={Colors.textTertiary}
          keyboardType="numeric"
        />
        <Text style={styles.perDay}>/day</Text>
      </View>
      <View style={styles.budgetTips}>
        {['₹100-150: Basic', '₹150-250: Standard', '₹250-400: Premium'].map(t => (
          <View key={t} style={styles.tipRow}>
            <MaterialCommunityIcons name="check-circle" size={18} color={Colors.primary} />
            <Text style={styles.tipText}>{t}</Text>
          </View>
        ))}
      </View>
    </>
  );

  const renderSteps = [renderStep0, renderStep1, renderStep2, renderStep3];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.progressRow}>
            {STEPS.map((s, i) => (
              <View key={s} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
            ))}
          </View>
          <Text style={styles.stepLabel}>Step {step + 1} of {STEPS.length}</Text>
          {renderSteps[step]()}
        </ScrollView>
        <View style={styles.footer}>
          {step > 0 && (
            <TouchableOpacity testID="back-btn" style={styles.backBtn} onPress={() => setStep(step - 1)}>
              <Text style={styles.backBtnText}>BACK</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            testID="next-btn"
            style={[styles.nextBtn, loading && styles.disabledBtn]}
            onPress={next}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.primaryFg} />
            ) : (
              <Text style={styles.nextBtnText}>{step === 3 ? 'FINISH' : 'NEXT'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, paddingBottom: 100 },
  progressRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  progressDot: { flex: 1, height: 4, backgroundColor: Colors.surface, borderRadius: 2 },
  progressDotActive: { backgroundColor: Colors.primary },
  stepLabel: { color: Colors.textTertiary, fontSize: 12, marginBottom: 24, letterSpacing: 1 },
  stepTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, marginBottom: 24 },
  inputContainer: { marginBottom: 16 },
  label: { color: Colors.textSecondary, fontSize: 14, marginBottom: 8, fontWeight: '500' },
  input: {
    backgroundColor: Colors.surface, borderRadius: 4, borderWidth: 1,
    borderColor: Colors.border, padding: 16, color: Colors.textPrimary, fontSize: 16,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: Colors.surface, borderRadius: 4, borderWidth: 1,
    borderColor: Colors.border, paddingVertical: 12, paddingHorizontal: 20,
  },
  chipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  chipTextSelected: { color: Colors.primaryFg },
  budgetDesc: { color: Colors.textSecondary, fontSize: 16, marginBottom: 24 },
  budgetInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  rupee: { color: Colors.primary, fontSize: 32, fontWeight: '700', marginRight: 8 },
  budgetInput: { flex: 1, fontSize: 32, fontWeight: '700', textAlign: 'center' },
  perDay: { color: Colors.textSecondary, fontSize: 18, marginLeft: 8 },
  budgetTips: { gap: 12 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tipText: { color: Colors.textSecondary, fontSize: 14 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', padding: 24, gap: 12, backgroundColor: Colors.background,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  backBtn: {
    flex: 1, borderWidth: 1, borderColor: Colors.primary, borderRadius: 4,
    paddingVertical: 16, alignItems: 'center',
  },
  backBtnText: { color: Colors.primary, fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  nextBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: 4, paddingVertical: 16, alignItems: 'center' },
  nextBtnText: { color: Colors.primaryFg, fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  disabledBtn: { opacity: 0.6 },
});
