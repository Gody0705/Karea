import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, RADIUS } from '../constants/theme';

interface Gift {
  id: string;
  name: string;
  emoji: string;
  cost: number;
}

const GIFTS: Gift[] = [
  { id: '1', name: 'Rose', emoji: '🌹', cost: 10 },
  { id: '2', name: 'Cœur', emoji: '💖', cost: 25 },
  { id: '3', name: 'Chocolats', emoji: '🍫', cost: 50 },
  { id: '4', name: 'Bague', emoji: '💍', cost: 100 },
  { id: '5', name: 'Couronne VIP', emoji: '👑', cost: 250 },
  { id: '6', name: 'Voiture de sport', emoji: '🏎️', cost: 500 },
  { id: '7', name: 'Fusée Diamant', emoji: '🚀', cost: 1000 },
  { id: '8', name: 'Château Royal', emoji: '🏰', cost: 2000 },
];

interface GiftModalProps {
  visible: boolean;
  onClose: () => void;
  onSendGift: (gift: Gift) => void;
  userTokens?: number;
}

export const GiftModal: React.FC<GiftModalProps> = ({
  visible,
  onClose,
  onSendGift,
  userTokens = 1250,
}) => {
  const [selectedGift, setSelectedGift] = useState<Gift | null>(GIFTS[0]);

  const handleSend = () => {
    if (selectedGift) {
      onSendGift(selectedGift);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheetContainer}>
          {/* Poignée de drag */}
          <View style={styles.handle} />

          {/* En-tête avec solde */}
          <View style={styles.header}>
            <Text style={styles.title}>Envoyer un cadeau virtuel 🎁</Text>
            <View style={styles.tokenBadge}>
              <Ionicons name="sparkles" size={14} color={COLORS.gold} />
              <Text style={styles.tokenText}>{userTokens} Tokens</Text>
            </View>
          </View>

          {/* Grille de cadeaux */}
          <FlatList
            data={GIFTS}
            keyExtractor={(item) => item.id}
            numColumns={4}
            contentContainerStyle={styles.giftList}
            renderItem={({ item }) => {
              const isSelected = selectedGift?.id === item.id;
              return (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setSelectedGift(item)}
                  style={[
                    styles.giftCard,
                    isSelected && styles.giftCardSelected,
                  ]}
                >
                  <Text style={styles.giftEmoji}>{item.emoji}</Text>
                  <Text style={styles.giftName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.costBadge}>
                    <Text style={styles.costText}>{item.cost}</Text>
                    <Ionicons name="diamond" size={10} color={COLORS.gold} />
                  </View>
                </TouchableOpacity>
              );
            }}
          />

          {/* Bouton d'action */}
          <View style={styles.footer}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.sendButton,
                SHADOWS.glow,
                !selectedGift && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
            >
              <Ionicons name="gift" size={18} color={COLORS.white} />
              <Text style={styles.sendButtonText}>
                {selectedGift
                  ? `Envoyer (${selectedGift.cost} Tokens)`
                  : 'Sélectionnez un cadeau'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 32,
    maxHeight: 460,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  tokenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.goldLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.4)',
    gap: 4,
  },
  tokenText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8A5D00',
  },
  giftList: {
    paddingBottom: 16,
  },
  giftCard: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    margin: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  giftCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  giftEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  giftName: {
    fontSize: 11,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  costBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  costText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  footer: {
    marginTop: 8,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    gap: 8,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.textLight,
  },
  sendButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
