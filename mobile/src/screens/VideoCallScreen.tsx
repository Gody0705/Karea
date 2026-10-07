import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../types';
import { CURRENT_USER } from '../data/mockData';
import { COLORS, SHADOWS, RADIUS } from '../constants/theme';
import { GiftModal } from '../components/GiftModal';

type VideoCallScreenRouteProp = RouteProp<RootStackParamList, 'VideoCall'>;

const { width, height } = Dimensions.get('window');

export const VideoCallScreen: React.FC = () => {
  const route = useRoute<VideoCallScreenRouteProp>();
  const navigation = useNavigation();
  const { user, isRandom } = route.params;

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isGiftModalVisible, setIsGiftModalVisible] = useState(false);
  const [sentGiftMessage, setSentGiftMessage] = useState<string | null>(null);

  // Minuteur d'appel
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleHangUp = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Flux vidéo du partenaire (Plein écran) */}
      <Image
        source={{ uri: user.photos[1] || user.avatar }}
        style={styles.fullScreenVideo}
        resizeMode="cover"
      />

      {/* Dégradés pour la lisibilité de l'interface */}
      <LinearGradient
        colors={['rgba(0,0,0,0.7)', 'transparent']}
        style={styles.topGradient}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={styles.bottomGradient}
      />

      {/* Miniature PIP de sa propre caméra en haut à droite */}
      <View style={[styles.pipContainer, SHADOWS.card]}>
        {!isCameraOff ? (
          <Image source={{ uri: CURRENT_USER.avatar }} style={styles.pipVideo} resizeMode="cover" />
        ) : (
          <View style={styles.pipDisabled}>
            <Ionicons name="videocam-off" size={20} color={COLORS.white} />
          </View>
        )}
        <View style={styles.pipBadge}>
          <Text style={styles.pipBadgeText}>Vous</Text>
        </View>
      </View>

      <SafeAreaView style={styles.overlayContent}>
        {/* En-tête de l'appel */}
        <View style={styles.header}>
          <View style={styles.partnerInfo}>
            <Text style={styles.partnerName}>
              {user.name} {user.countryFlag}
            </Text>
            <View style={styles.timerBadge}>
              <View style={styles.recordingDot} />
              <Text style={styles.timerText}>{formatDuration(callDuration)}</Text>
            </View>
          </View>

          {isRandom && (
            <View style={styles.randomModeBadge}>
              <Ionicons name="shuffle" size={12} color={COLORS.white} />
              <Text style={styles.randomModeText}>Salon Aléatoire</Text>
            </View>
          )}
        </View>

        {/* Message d'animation de cadeau reçu/envoyé */}
        {sentGiftMessage && (
          <View style={styles.giftAlert}>
            <Text style={styles.giftAlertText}>{sentGiftMessage}</Text>
          </View>
        )}

        {/* Barre de contrôle d'appel en bas */}
        <View style={styles.controlsWrapper}>
          {/* Bouton Couper Micro */}
          <TouchableOpacity
            style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
            onPress={() => setIsMuted(!isMuted)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isMuted ? 'mic-off' : 'mic'}
              size={24}
              color={isMuted ? COLORS.danger : COLORS.white}
            />
          </TouchableOpacity>

          {/* Bouton Couper Caméra */}
          <TouchableOpacity
            style={[styles.controlBtn, isCameraOff && styles.controlBtnActive]}
            onPress={() => setIsCameraOff(!isCameraOff)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isCameraOff ? 'videocam-off' : 'videocam'}
              size={24}
              color={isCameraOff ? COLORS.danger : COLORS.white}
            />
          </TouchableOpacity>

          {/* Bouton Envoyer Cadeau */}
          <TouchableOpacity
            style={[styles.controlBtn, styles.giftBtn]}
            onPress={() => setIsGiftModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="gift" size={24} color={COLORS.gold} />
          </TouchableOpacity>

          {/* Bouton Raccrocher (Rouge) */}
          <TouchableOpacity
            style={[styles.hangUpBtn, SHADOWS.glow]}
            onPress={handleHangUp}
            activeOpacity={0.85}
          >
            <Ionicons name="call" size={28} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <GiftModal
        visible={isGiftModalVisible}
        onClose={() => setIsGiftModalVisible(false)}
        onSendGift={(gift) => {
          setSentGiftMessage(`Vous avez envoyé ${gift.name} ${gift.emoji} !`);
          setTimeout(() => setSentGiftMessage(null), 3000);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullScreenVideo: {
    width: width,
    height: height,
    position: 'absolute',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  pipContainer: {
    position: 'absolute',
    top: 54,
    right: 16,
    width: 105,
    height: 145,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.white,
    zIndex: 20,
    backgroundColor: '#1E1E2D',
  },
  pipVideo: {
    width: '100%',
    height: '100%',
  },
  pipDisabled: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pipBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  pipBadgeText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: '700',
  },
  overlayContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  header: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    maxWidth: width - 130,
  },
  partnerInfo: {
    gap: 4,
  },
  partnerName: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '800',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
    gap: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.online,
  },
  timerText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  randomModeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 115, 232, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 4,
    marginTop: 4,
  },
  randomModeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
  },
  giftAlert: {
    alignSelf: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  giftAlertText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  controlsWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginBottom: 34,
  },
  controlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  controlBtnActive: {
    backgroundColor: COLORS.white,
  },
  giftBtn: {
    backgroundColor: 'rgba(255, 184, 0, 0.25)',
    borderColor: COLORS.gold,
  },
  hangUpBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
