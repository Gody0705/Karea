import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProfileCard } from '../components/ProfileCard';
import { MOCK_PROFILES } from '../data/mockData';
import { UserProfile, RootStackParamList } from '../types';
import { COLORS, SHADOWS, RADIUS } from '../constants/theme';

export const DiscoveryScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [activeSubTab, setActiveSubTab] = useState<'popular' | 'follow'>('popular');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtrage selon le sous-onglet sélectionné
  const filteredProfiles = MOCK_PROFILES.filter((profile) => {
    const matchesTab =
      activeSubTab === 'popular' ? profile.isPopular : profile.isFollowed;
    const matchesSearch =
      profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.country.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleProfilePress = (profile: UserProfile) => {
    navigation.navigate('UserProfile', { user: profile });
  };

  const handleCallPress = (profile: UserProfile) => {
    navigation.navigate('VideoCall', { user: profile });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Barre supérieure personnalisée */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Ionicons name="planet" size={20} color={COLORS.primary} />
          </View>
          <Text style={styles.appTitle}>Karea</Text>
        </View>

        {/* Sous-onglets Populaire / Suivre */}
        <View style={styles.subTabsContainer}>
          <TouchableOpacity
            style={[
              styles.subTabButton,
              activeSubTab === 'popular' && styles.subTabButtonActive,
            ]}
            onPress={() => setActiveSubTab('popular')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.subTabText,
                activeSubTab === 'popular' && styles.subTabTextActive,
              ]}
            >
              Populaire
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.subTabButton,
              activeSubTab === 'follow' && styles.subTabButtonActive,
            ]}
            onPress={() => setActiveSubTab('follow')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.subTabText,
                activeSubTab === 'follow' && styles.subTabTextActive,
              ]}
            >
              Suivre
            </Text>
          </TouchableOpacity>
        </View>

        {/* Indicateur de pièces & filtre */}
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.coinBadge} activeOpacity={0.8}>
            <Ionicons name="sparkles" size={14} color={COLORS.gold} />
            <Text style={styles.coinText}>1.2K</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Barre de recherche discrète */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            placeholder="Rechercher un pays, un pseudo..."
            placeholderTextColor={COLORS.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={COLORS.textLight} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Grille de profils 2 colonnes */}
      <FlatList
        data={filteredProfiles}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <ProfileCard
            profile={item}
            onPress={() => handleProfilePress(item)}
            onCallPress={() => handleCallPress(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>Aucun profil trouvé</Text>
            <Text style={styles.emptySubtitle}>
              {activeSubTab === 'follow'
                ? "Vous ne suivez pas encore d'utilisateurs dans cette section."
                : 'Essayez de modifier votre recherche.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primaryDark,
    letterSpacing: -0.5,
  },
  subTabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.full,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  subTabButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  subTabButtonActive: {
    backgroundColor: COLORS.primary,
    ...SHADOWS.soft,
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  subTabTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.goldLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.3)',
  },
  coinText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8A5D00',
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    padding: 0,
  },
  gridContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
});
