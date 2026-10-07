import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../types';
import { COLORS, SHADOWS, RADIUS } from '../constants/theme';
import { GiftModal } from '../components/GiftModal';

type UserProfileScreenRouteProp = RouteProp<RootStackParamList, 'UserProfile'>;

const { width } = Dimensions.get('window');

export const UserProfileScreen: React.FC = () => {
  const route = useRoute<UserProfileScreenRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = route.params;

  const [isFollowing, setIsFollowing] = useState(user.isFollowed || false);
  const [isGiftModalVisible, setIsGiftModalVisible] = useState(false);

  const handleStartCall = () => {
    navigation.navigate('VideoCall', { user });
  };

  const handleOpenChat = () => {
    navigation.navigate('Chat', { user });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Photo principale grand format */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: user.avatar }} style={styles.mainImage} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(26,26,46,0.9)']}
            style={styles.gradientOverlay}
          />

          {/* Boutons retour et options */}
          <SafeAreaView style={styles.navBar}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.circleIconButton}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={22} color={COLORS.white} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.circleIconButton} activeOpacity={0.8}>
              <Ionicons name="ellipsis-horizontal" size={22} color={COLORS.white} />
            </TouchableOpacity>
          </SafeAreaView>

          {/* Informations superposées sur la photo */}
          <View style={styles.heroInfo}>
            <View style={styles.badgeRow}>
              <View style={[styles.statusBadge, { backgroundColor: user.status === 'online' ? COLORS.online : COLORS.busy }]}>
                <Text style={styles.statusBadgeText}>
                  {user.status === 'online' ? '● En ligne' : '● Occupé'}
                </Text>
              </View>
              <View style={styles.levelBadge}>
                <Ionicons name="trophy" size={12} color={COLORS.gold} />
                <Text style={styles.levelBadgeText}>Niveau {user.level}</Text>
              </View>
            </View>

            <View style={styles.nameHeaderRow}>
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userFlag}>{user.countryFlag}</Text>
            </View>

            <Text style={styles.userSubDetails}>
              {user.age} ans • {user.country} • ID: {user.userIdCode}
            </Text>
          </View>
        </View>

        {/* Section Statistiques */}
        <View style={[styles.statsCard, SHADOWS.card]}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{user.fansCount}</Text>
            <Text style={styles.statLabel}>Fans</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{user.followingCount}</Text>
            <Text style={styles.statLabel}>Suivis</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{user.friendsCount}</Text>
            <Text style={styles.statLabel}>Amis</Text>
          </View>
        </View>

        {/* Section Biographie */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>À propos</Text>
          <Text style={styles.bioText}>{user.bio}</Text>
        </View>

        {/* Section Galerie de photos */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Photos ({user.photos.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
            {user.photos.map((photo, index) => (
              <Image key={index} source={{ uri: photo }} style={styles.galleryImage} />
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Barre d'action fixe en bas */}
      <SafeAreaView style={styles.bottomBarWrapper}>
        <View style={[styles.bottomBar, SHADOWS.glow]}>
          {/* Bouton Suivre */}
          <TouchableOpacity
            style={[styles.followBtn, isFollowing && styles.followBtnActive]}
            onPress={() => setIsFollowing(!isFollowing)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isFollowing ? 'checkmark-circle' : 'person-add'}
              size={18}
              color={isFollowing ? COLORS.primary : COLORS.white}
            />
            <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
              {isFollowing ? 'Suivi' : 'Suivre'}
            </Text>
          </TouchableOpacity>

          {/* Bouton Message */}
          <TouchableOpacity
            style={styles.chatBtn}
            onPress={handleOpenChat}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubble-ellipses" size={20} color={COLORS.primary} />
          </TouchableOpacity>

          {/* Bouton Cadeau */}
          <TouchableOpacity
            style={styles.giftBtn}
            onPress={() => setIsGiftModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="gift" size={20} color={COLORS.gold} />
          </TouchableOpacity>

          {/* Bouton Appel Vidéo Direct */}
          <TouchableOpacity
            style={styles.videoCallBtn}
            onPress={handleStartCall}
            activeOpacity={0.85}
          >
            <Ionicons name="videocam" size={20} color={COLORS.white} />
            <Text style={styles.videoCallBtnText}>Appel vidéo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <GiftModal
        visible={isGiftModalVisible}
        onClose={() => setIsGiftModalVisible(false)}
        onSendGift={(gift) => {
          alert(`Cadeau ${gift.name} ${gift.emoji} envoyé à ${user.name} !`);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  imageContainer: {
    width: width,
    height: width * 1.15,
    position: 'relative',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  navBar: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  circleIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroInfo: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  statusBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  levelBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '600',
  },
  nameHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    color: COLORS.white,
    fontSize: 26,
    fontWeight: '800',
  },
  userFlag: {
    fontSize: 22,
  },
  userSubDetails: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    marginTop: 4,
  },
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: -20,
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
    zIndex: 5,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
  },
  sectionCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  bioText: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 21,
  },
  galleryScroll: {
    marginTop: 8,
  },
  galleryImage: {
    width: 110,
    height: 140,
    borderRadius: RADIUS.md,
    marginRight: 10,
  },
  bottomBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 8,
    borderRadius: RADIUS.full,
    gap: 8,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    gap: 6,
  },
  followBtnActive: {
    backgroundColor: COLORS.primaryLight,
  },
  followBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  followBtnTextActive: {
    color: COLORS.primary,
  },
  chatBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  giftBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.goldLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoCallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: RADIUS.full,
    gap: 8,
  },
  videoCallBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
