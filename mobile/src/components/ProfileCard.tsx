import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { UserProfile } from '../types';
import { COLORS, SHADOWS, RADIUS } from '../constants/theme';

interface ProfileCardProps {
  profile: UserProfile;
  onPress: () => void;
  onCallPress: () => void;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  onPress,
  onCallPress,
}) => {
  const getStatusDetails = () => {
    switch (profile.status) {
      case 'online':
        return { color: COLORS.online, label: 'En ligne' };
      case 'busy':
        return { color: COLORS.busy, label: 'Occupé' };
      case 'offline':
      default:
        return { color: COLORS.offline, label: 'Hors ligne' };
    }
  };

  const status = getStatusDetails();

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[styles.container, SHADOWS.card]}
    >
      <Image source={{ uri: profile.avatar }} style={styles.image} resizeMode="cover" />

      {/* Dégradé supérieur pour la lisibilité du badge */}
      <LinearGradient
        colors={['rgba(0,0,0,0.45)', 'transparent']}
        style={styles.topGradient}
      />

      {/* Badge de statut en haut à gauche */}
      <View style={styles.statusBadge}>
        <View style={[styles.statusDot, { backgroundColor: status.color }]} />
        <Text style={styles.statusText}>{status.label}</Text>
      </View>

      {/* Dégradé inférieur pour le pseudo et actions */}
      <LinearGradient
        colors={['transparent', 'rgba(13, 71, 161, 0.4)', 'rgba(26, 26, 46, 0.95)']}
        style={styles.bottomGradient}
      />

      {/* Informations & Bouton appel en bas */}
      <View style={styles.bottomContent}>
        <View style={styles.textContainer}>
          <View style={styles.nameRow}>
            <Text style={styles.nameText} numberOfLines={1}>
              {profile.name}
            </Text>
            <Text style={styles.flagText}>{profile.countryFlag}</Text>
          </View>
          <Text style={styles.ageCountryText}>
            {profile.age} ans • {profile.country}
          </Text>
        </View>

        {/* Bouton d'appel vidéo (caméra dans cercle bleu) */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onCallPress}
          style={[styles.callButton, SHADOWS.glow]}
        >
          <Ionicons name="videocam" size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.38,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
    marginBottom: 16,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  statusBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    backdropFilter: 'blur(10px)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 5,
  },
  statusText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '600',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
  },
  bottomContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
    marginRight: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nameText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  flagText: {
    fontSize: 13,
  },
  ageCountryText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    marginTop: 2,
  },
  callButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
});
