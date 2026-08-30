import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../../utils/api';
import { Colors } from '../../constants/Colors';

function SimpleBarChart({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartBars}>
        {data.map((d, i) => (
          <View key={i} style={styles.chartBarCol}>
            <Text style={styles.chartValue}>{d.value}</Text>
            <View style={[styles.chartBar, { height: Math.max((d.value / maxVal) * 120, 4) }]} />
            <Text style={styles.chartLabel}>{d.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function ProgressScreen() {
  const [weights, setWeights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWeight, setNewWeight] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchWeights(); }, []);

  const fetchWeights = async () => {
    try {
      const res = await api('/progress/weight?days=30');
      if (res.ok) setWeights(await res.json());
    } catch (e) {}
    setLoading(false);
  };

  const logWeight = async () => {
    const wt = parseFloat(newWeight);
    if (!wt || wt < 20 || wt > 300) {
      Alert.alert('Invalid', 'Enter a valid weight (20-300 kg)');
      return;
    }
    setSaving(true);
    const today = new Date().toISOString().split('T')[0];
    try {
      const res = await api('/progress/weight', {
        method: 'POST',
        body: JSON.stringify({ weight_kg: wt, date: today }),
      });
      if (res.ok) {
        setNewWeight('');
        fetchWeights();
        Alert.alert('Saved!', `Weight logged: ${wt} kg`);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to save');
    }
    setSaving(false);
  };

  const chartData = [...weights]
    .reverse()
    .slice(-10)
    .map(w => ({
      label: w.date ? w.date.slice(5) : '',
      value: w.weight_kg,
    }));

  const startWeight = weights.length > 0 ? weights[weights.length - 1]?.weight_kg : null;
  const currentWeight = weights.length > 0 ? weights[0]?.weight_kg : null;
  const weightChange = startWeight && currentWeight ? (currentWeight - startWeight).toFixed(1) : null;

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Progress</Text>
          <Text style={styles.subtitle}>Track your fitness journey</Text>

          <View style={styles.logCard}>
            <Text style={styles.logTitle}>Log Today's Weight</Text>
            <View style={styles.logRow}>
              <TextInput
                testID="weight-input"
                style={styles.weightInput}
                value={newWeight}
                onChangeText={setNewWeight}
                placeholder="70.5"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="decimal-pad"
              />
              <Text style={styles.kgLabel}>kg</Text>
              <TouchableOpacity
                testID="save-weight-btn"
                style={[styles.saveBtn, saving && styles.disabledBtn]}
                onPress={logWeight}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.primaryFg} size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>SAVE</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {currentWeight && (
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{currentWeight} kg</Text>
                <Text style={styles.statLabel}>Current</Text>
              </View>
              {startWeight && (
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{startWeight} kg</Text>
                  <Text style={styles.statLabel}>Start</Text>
                </View>
              )}
              {weightChange && (
                <View style={styles.statCard}>
                  <Text style={[styles.statValue, { color: parseFloat(weightChange) <= 0 ? Colors.success : Colors.warning }]}>
                    {parseFloat(weightChange) > 0 ? '+' : ''}{weightChange} kg
                  </Text>
                  <Text style={styles.statLabel}>Change</Text>
                </View>
              )}
            </View>
          )}

          {chartData.length > 0 && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Weight Trend</Text>
              <SimpleBarChart data={chartData} />
            </View>
          )}

          {weights.length > 0 && (
            <View style={styles.historyCard}>
              <Text style={styles.historyTitle}>History</Text>
              {weights.slice(0, 15).map((w, i) => (
                <View key={i} style={styles.historyRow}>
                  <Text style={styles.historyDate}>{w.date}</Text>
                  <Text style={styles.historyWeight}>{w.weight_kg} kg</Text>
                </View>
              ))}
            </View>
          )}

          {weights.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="scale-bathroom" size={60} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No weight entries yet</Text>
              <Text style={styles.emptySubtext}>Start logging your weight to track progress</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { color: Colors.textSecondary, fontSize: 14, marginTop: 4, marginBottom: 20 },
  logCard: {
    backgroundColor: Colors.cardBg, borderRadius: 12, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  logTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 14 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  weightInput: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 4, padding: 14,
    color: Colors.textPrimary, fontSize: 20, fontWeight: '700', borderWidth: 1, borderColor: Colors.border,
  },
  kgLabel: { color: Colors.textSecondary, fontSize: 18, fontWeight: '600' },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 4, paddingVertical: 14, paddingHorizontal: 24 },
  saveBtnText: { color: Colors.primaryFg, fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  disabledBtn: { opacity: 0.6 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: Colors.cardBg, borderRadius: 12, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 },
  chartCard: {
    backgroundColor: Colors.cardBg, borderRadius: 12, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  chartTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },
  chartContainer: {},
  chartBars: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 160, paddingBottom: 24 },
  chartBarCol: { alignItems: 'center', flex: 1 },
  chartValue: { color: Colors.textSecondary, fontSize: 10, marginBottom: 4 },
  chartBar: { width: 20, backgroundColor: Colors.primary, borderRadius: 4 },
  chartLabel: { color: Colors.textTertiary, fontSize: 10, marginTop: 4 },
  historyCard: {
    backgroundColor: Colors.cardBg, borderRadius: 12, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  historyTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 14 },
  historyRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  historyDate: { color: Colors.textSecondary, fontSize: 14 },
  historyWeight: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  emptyState: { alignItems: 'center', marginTop: 40, gap: 8 },
  emptyText: { color: Colors.textSecondary, fontSize: 18, fontWeight: '600' },
  emptySubtext: { color: Colors.textTertiary, fontSize: 14 },
});
