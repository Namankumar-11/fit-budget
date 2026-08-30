import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

type IconName = 'view-dashboard' | 'food-apple' | 'dumbbell' | 'chart-line' | 'account-circle';

const TAB_CONFIG: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Dashboard', icon: 'view-dashboard' },
  { name: 'diet', title: 'Diet', icon: 'food-apple' },
  { name: 'workout', title: 'Workout', icon: 'dumbbell' },
  { name: 'progress', title: 'Progress', icon: 'chart-line' },
  { name: 'profile', title: 'Profile', icon: 'account-circle' },
];

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      {TAB_CONFIG.map(tab => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name={tab.icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.background,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: 65,
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
