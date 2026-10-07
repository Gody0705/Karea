import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { DiscoveryScreen } from '../screens/DiscoveryScreen';
import { RandomCallScreen } from '../screens/RandomCallScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { BottomTabParamList } from '../types';
import { COLORS, SHADOWS, RADIUS } from '../constants/theme';

const Tab = createBottomTabNavigator<BottomTabParamList>();

export const BottomTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      {/* Onglet 1 : Découverte */}
      <Tab.Screen
        name="Discovery"
        component={DiscoveryScreen}
        options={{
          tabBarLabel: 'Découverte',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'planet' : 'planet-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* Onglet 2 : Appel Aléatoire */}
      <Tab.Screen
        name="RandomCall"
        component={RandomCallScreen}
        options={{
          tabBarLabel: 'Appel Direct',
          tabBarIcon: ({ focused, color, size }) => (
            <View style={styles.centerTabWrapper}>
              <View style={[styles.centerTabIcon, SHADOWS.glow]}>
                <Ionicons name="videocam" size={24} color={COLORS.white} />
              </View>
            </View>
          ),
        }}
      />

      {/* Onglet 3 : Messages */}
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          tabBarLabel: 'Messages',
          tabBarBadge: 3,
          tabBarBadgeStyle: styles.tabBadge,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* Onglet 4 : Profil */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profil',
          tabBarIcon: ({ focused, color, size }) => (
            <View style={styles.profileIconContainer}>
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={24}
                color={color}
              />
              <View style={styles.profileDot} />
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    height: Platform.OS === 'ios' ? 88 : 68,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    paddingTop: 8,
    ...SHADOWS.card,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  tabBadge: {
    backgroundColor: COLORS.badgeRed,
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    lineHeight: 16,
  },
  centerTabWrapper: {
    top: -12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerTabIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  profileIconContainer: {
    position: 'relative',
  },
  profileDot: {
    position: 'absolute',
    top: -1,
    right: -2,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.primary,
  },
});
