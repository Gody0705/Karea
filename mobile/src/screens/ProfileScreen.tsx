import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CURRENT_USER } from '../data/mockData';
import { COLORS, SHADOWS, RADIUS } from '../constants/theme';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 48 - 16) / 3;

export const ProfileScreen: React.FC = () => {
  const [user, setUser] = useState(CURRENT_USER);
  const [tokensCount, setTokensCount] = useState(1250);
  const [creditsCount, setCreditsCount] = useState(340);

  const handleAddPhoto = () => {
    Alert.alert(
      'Ajouter une photo',
      'Choisissez une photo de votre galerie pour enrichir votre profil.',
      [{ text: 'Annuler', style: 'cancel' }, { text: 'Ouvrir Galerie' }]
    );
  };

  const handleVIPPress = () => {
    Alert.alert(
      '🌟 Devenir Membre VIP',
      'Profitez d’appels vidéo illimités, d’un badge exclusif et de réductions sur les tokens !'
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* En-tête avec titre et bouton paramètres */}
      <View style={styles.topHeader}>
        <Text style={styles.pageTitle}>Mon Profil</Text>
        <TouchableOpacity style={styles.settingsButton} activeOpacity={0.75}>
          <Ionicons name="settings-outline" size={22} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Carte Profil principale */}
        <View style={[styles.profileCard, SHADOWS.card]}>
          {/* Avatar avec badge de modification */}
          <View style={styles.avatarContainer}>
            <Image source={{ uri: user.avatar }} style={styles.avatar} />
            <TouchableOpacity style={styles.editAvatarBadge} activeOpacity={0.8}>
              <Ionicons name="camera" size={14} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          {/* Nom, drapeau et identifiant */}
          <View style={styles.userInfoWrapper}>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userFlag}>{user.countryFlag}</Text>
            </View>

            <Text style={styles.userIdText}>ID : {user.userIdCode}</Text>

            {/* Badge de niveau */}
            <View style={styles.levelBadge}>
              <Ionicons name="shield-checkmark" size={13} color={COLORS.primary} />
              <Text style={styles.levelText}>Niveau {user.level} VIP</Text>
            </View>
          </View>
        </View>

        {/* Statistiques en ligne (Fans | Suivis | Amis) */}
        <View style={[styles.statsRowCard, SHADOWS.soft]}>
          <TouchableOpacity style={styles.statBox} activeOpacity={0.7}>
            <Text style={styles.statValue}>{user.fansCount}</Text>
            <Text style={styles.statLabel}>Fans</Text>
          </TouchableOpacity>
          <View style={styles.statSeparator} />

          <TouchableOpacity style={styles.statBox} activeOpacity={0.7}>
            <Text style={styles.statValue}>{user.followingCount}</Text>
            <Text style={styles.statLabel}>Suivis</Text>
          </TouchableOpacity>
          <View style={styles.statSeparator} />

          <TouchableOpacity style={styles.statBox} activeOpacity={0.7}>
            <Text style={styles.statValue}>{user.friendsCount}</Text>
            <Text style={styles.statLabel}>Amis</Text>
          </TouchableOpacity>
        </View>

        {/* Deux cartes côte à côte : Tokens & Crédits */}
        <View style={styles.walletRow}>
          {/* Carte Tokens */}
          <View style={[styles.walletCard, SHADOWS.soft]}>
            <View style={styles.walletHeader}>
              <View style={styles.goldIconBg}>
                <Ionicons name="sparkles" size={16} color={COLORS.gold} />
              </View>
              <Text style={styles.walletTitle}>Tokens</Text>
            </View>
            <Text style={styles.walletAmount}>{tokensCount}</Text>
            <TouchableOpacity style={styles.walletActionBtn} activeOpacity={0.8}>
              <Text style={styles.walletActionText}>Recharger +</Text>
            </TouchableOpacity>
          </View>

          {/* Carte Crédits */}
          <View style={[styles.walletCard, SHADOWS.soft]}>
            <View style={styles.walletHeader}>
              <View style={styles.blueIconBg}>
                <Ionicons name="wallet" size={16} color={COLORS.primary} />
              </View>
              <Text style={styles.walletTitle}>Crédits</Text>
            </View>
            <Text style={styles.walletAmount}>{creditsCount}</Text>
            <TouchableOpacity style={styles.walletActionBtn} activeOpacity={0.8}>
              <Text style={styles.walletActionText}>Retrait €</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bannière "Devenir VIP" */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={handleVIPPress}
          style={[styles.vipCard, SHADOWS.glow]}
        >
          <LinearGradient
            colors={[COLORS.primaryLight, '#BBDEFB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.vipGradient}
          >
            <View style={styles.vipLeft}>
              <View style={styles.vipCrownBadge}>
                <Ionicons name="trophy" size={20} color={COLORS.gold} />
              </View>
              <View>
                <Text style={styles.vipTitle}>Devenir Membre VIP 👑</Text>
                <Text style={styles.vipSubtitle}>
                  Appels prioritaires, filtres exclusifs & cadeaux offerts
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.primaryDark} />
          </LinearGradient>
        </TouchableOpacity>

        {/* Trois icônes d'actions rapides */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity style={styles.quickActionItem} activeOpacity={0.7}>
            <View style={styles.quickActionIconBg}>
              <Ionicons name="person-outline" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.quickActionLabel}>Modifier profil</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionItem} activeOpacity={0.7}>
            <View style={styles.quickActionIconBg}>
              <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.quickActionLabel}>Vérification</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionItem} activeOpacity={0.7}>
            <View style={styles.quickActionIconBg}>
              <Ionicons name="options-outline" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.quickActionLabel}>Préférences</Text>
          </TouchableOpacity>
        </View>

        {/* Section Photos avec grille et bouton "+" */}
        <View style={[styles.photosSection, SHADOWS.soft]}>
          <View style={styles.photosHeader}>
            <Text style={styles.photosTitle}>Mes Photos ({user.photos.length})</Text>
            <Text style={styles.photosSubtitle}>Ajoutez jusqu'à 6 photos</Text>
          </View>

          <View style={styles.photosGrid}>
            {user.photos.map((photo, index) => (
              <View key={index} style={styles.photoWrapper}>
                <Image source={{ uri: photo }} style={styles.photoItem} />
              </View>
            ))}

            {/* Bouton d'ajout "+" */}
            {user.photos.length < 6 && (
              <TouchableOpacity
                style={styles.addPhotoButton}
                onPress={handleAddPhoto}
                activeOpacity={0.75}
              >
                <Ionicons name="add" size={32} color={COLORS.primary} />
                <Text style={styles.addPhotoText}>Ajouter</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  settingsButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: RADIUS.lg,
    marginBottom: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: COLORS.primaryLight,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  userInfoWrapper: {
    marginLeft: 16,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  userFlag: {
    fontSize: 16,
  },
  userIdText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
    marginTop: 6,
    gap: 4,
  },
  levelText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  statsRowCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statSeparator: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
  },
  walletRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  walletCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: 14,
    borderRadius: RADIUS.lg,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  goldIconBg: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.goldLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blueIconBg: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  walletAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
  },
  walletActionBtn: {
    backgroundColor: COLORS.background,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  walletActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  vipCard: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: 16,
  },
  vipGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  vipLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  vipCrownBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.soft,
  },
  vipTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  vipSubtitle: {
    fontSize: 11,
    color: COLORS.primaryDark,
    opacity: 0.85,
    marginTop: 2,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    padding: 14,
    borderRadius: RADIUS.lg,
    marginBottom: 16,
  },
  quickActionItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickActionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
  },
  photosSection: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: RADIUS.lg,
  },
  photosHeader: {
    marginBottom: 12,
  },
  photosTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  photosSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoWrapper: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE * 1.25,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  photoItem: {
    width: '100%',
    height: '100%',
  },
  addPhotoButton: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE * 1.25,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 4,
  },
});
