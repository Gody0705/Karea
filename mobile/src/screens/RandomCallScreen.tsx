import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RadarPulse } from '../components/RadarPulse';
import { MOCK_PROFILES } from '../data/mockData';
import { RootStackParamList } from '../types';
import { COLORS, SHADOWS, RADIUS } from '../constants/theme';

const { width } = Dimensions.get('window');

type GenderFilter = 'all' | 'female' | 'male';
type RegionFilter = 'all' | 'africa' | 'europe' | 'asia';

export const RandomCallScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [isSearching, setIsSearching] = useState(false);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all');
  const [tokensCount, setTokensCount] = useState(1250);

  const handleToggleSearch = () => {
    if (isSearching) {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    // Simulation de recherche et découverte d'un partenaire après 3 secondes
    setTimeout(() => {
      setIsSearching(false);
      // Sélectionne un profil au hasard parmi les personnes en ligne
      const onlineProfiles = MOCK_PROFILES.filter((p) => p.status === 'online');
      const randomMatch =
        onlineProfiles[Math.floor(Math.random() * onlineProfiles.length)] ||
        MOCK_PROFILES[0];

      navigation.navigate('VideoCall', { user: randomMatch, isRandom: true });
    }, 3200);
  };

  return (
    <LinearGradient
      colors={[COLORS.primaryDark, '#1565C0', COLORS.primary]}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />
      <SafeAreaView style={styles.safeArea}>
        {/* En-tête avec titre et solde */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Appel Aléatoire</Text>
            <Text style={styles.headerSubtitle}>
              Rencontrez des personnes du monde entier en direct
            </Text>
          </View>

          <TouchableOpacity style={styles.tokenPill} activeOpacity={0.8}>
            <Ionicons name="sparkles" size={14} color={COLORS.gold} />
            <Text style={styles.tokenText}>{tokensCount}</Text>
          </TouchableOpacity>
        </View>

        {/* Zone centrale : Radar & pulsation */}
        <View style={styles.radarSection}>
          <RadarPulse isSearching={isSearching} size={width * 0.65} />

          {/* Texte explicatif au centre */}
          <View style={styles.centerStatusWrapper}>
            <Ionicons
              name={isSearching ? 'planet' : 'videocam'}
              size={32}
              color={COLORS.white}
              style={isSearching && styles.pulsingIcon}
            />
            <Text style={styles.centerStatusTitle}>
              {isSearching
                ? 'Recherche en cours...'
                : 'Cliquez pour commencer'}
            </Text>
            <Text style={styles.centerStatusDesc}>
              {isSearching
                ? 'Connexion avec un partenaire compatible'
                : 'Filtrez vos préférences ci-dessous'}
            </Text>
          </View>
        </View>

        {/* Section Filtres rapides */}
        <View style={[styles.filtersCard, SHADOWS.card]}>
          <Text style={styles.filterTitle}>Préférences de recherche</Text>

          {/* Filtre Genre */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Genre :</Text>
            <View style={styles.filterButtonGroup}>
              <TouchableOpacity
                style={[
                  styles.filterBtn,
                  genderFilter === 'all' && styles.filterBtnActive,
                ]}
                onPress={() => setGenderFilter('all')}
                disabled={isSearching}
              >
                <Text
                  style={[
                    styles.filterBtnText,
                    genderFilter === 'all' && styles.filterBtnTextActive,
                  ]}
                >
                  Tous
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterBtn,
                  genderFilter === 'female' && styles.filterBtnActive,
                ]}
                onPress={() => setGenderFilter('female')}
                disabled={isSearching}
              >
                <Text
                  style={[
                    styles.filterBtnText,
                    genderFilter === 'female' && styles.filterBtnTextActive,
                  ]}
                >
                  Femmes
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterBtn,
                  genderFilter === 'male' && styles.filterBtnActive,
                ]}
                onPress={() => setGenderFilter('male')}
                disabled={isSearching}
              >
                <Text
                  style={[
                    styles.filterBtnText,
                    genderFilter === 'male' && styles.filterBtnTextActive,
                  ]}
                >
                  Hommes
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Filtre Localisation */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Région :</Text>
            <View style={styles.filterButtonGroup}>
              <TouchableOpacity
                style={[
                  styles.filterBtn,
                  regionFilter === 'all' && styles.filterBtnActive,
                ]}
                onPress={() => setRegionFilter('all')}
                disabled={isSearching}
              >
                <Text
                  style={[
                    styles.filterBtnText,
                    regionFilter === 'all' && styles.filterBtnTextActive,
                  ]}
                >
                  Monde entier 🌍
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterBtn,
                  regionFilter === 'africa' && styles.filterBtnActive,
                ]}
                onPress={() => setRegionFilter('africa')}
                disabled={isSearching}
              >
                <Text
                  style={[
                    styles.filterBtnText,
                    regionFilter === 'africa' && styles.filterBtnTextActive,
                  ]}
                >
                  Afrique 🌍
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Bouton d'action principal en bas */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              isSearching ? styles.actionButtonSearching : SHADOWS.glow,
            ]}
            onPress={handleToggleSearch}
            activeOpacity={0.85}
          >
            <Ionicons
              name={isSearching ? 'close-circle' : 'videocam'}
              size={22}
              color={isSearching ? COLORS.danger : COLORS.primaryDark}
            />
            <Text
              style={[
                styles.actionButtonText,
                isSearching && styles.actionButtonTextSearching,
              ]}
            >
              {isSearching ? 'Annuler la recherche' : 'Commencer la recherche'}
            </Text>
          </TouchableOpacity>

          {/* Indicateur de crédits */}
          <View style={styles.costInfoRow}>
            <Ionicons name="information-circle-outline" size={14} color="rgba(255, 255, 255, 0.75)" />
            <Text style={styles.costInfoText}>
              20 Tokens / minute • Salon public sécurisé
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  tokenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  tokenText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  radarSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginVertical: 10,
  },
  centerStatusWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  pulsingIcon: {
    transform: [{ scale: 1.1 }],
  },
  centerStatusTitle: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  centerStatusDesc: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  filtersCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: RADIUS.lg,
  },
  filterTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    width: 60,
  },
  filterButtonGroup: {
    flexDirection: 'row',
    flex: 1,
    gap: 6,
  },
  filterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  filterBtnActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  filterBtnText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '700',
  },
  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 14,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: 15,
    borderRadius: RADIUS.full,
    gap: 10,
  },
  actionButtonSearching: {
    backgroundColor: '#FFEAEA',
  },
  actionButtonText: {
    color: COLORS.primaryDark,
    fontSize: 16,
    fontWeight: '800',
  },
  actionButtonTextSearching: {
    color: COLORS.danger,
  },
  costInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 6,
  },
  costInfoText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
  },
});
