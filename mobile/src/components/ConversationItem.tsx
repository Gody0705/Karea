import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Conversation } from '../types';
import { COLORS, SHADOWS, RADIUS } from '../constants/theme';

interface ConversationItemProps {
  conversation: Conversation;
  onPress: () => void;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  onPress,
}) => {
  const { user, lastMessage, lastMessageTime, unreadCount, isOnline } = conversation;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.container, SHADOWS.soft]}
    >
      {/* Avatar avec pastille en ligne */}
      <View style={styles.avatarWrapper}>
        <Image source={{ uri: user.avatar }} style={styles.avatar} />
        {isOnline && <View style={styles.onlineBadge} />}
      </View>

      {/* Détails du message */}
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {user.name}
            </Text>
            <Text style={styles.flag}>{user.countryFlag}</Text>
          </View>
          <Text style={[styles.time, unreadCount > 0 && styles.timeUnread]}>
            {lastMessageTime}
          </Text>
        </View>

        <View style={styles.messageRow}>
          <Text
            style={[styles.message, unreadCount > 0 && styles.messageUnread]}
            numberOfLines={1}
          >
            {lastMessage}
          </Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.primaryLight,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: COLORS.online,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginRight: 6,
  },
  flag: {
    fontSize: 14,
  },
  time: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  timeUnread: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  message: {
    fontSize: 13,
    color: COLORS.textMuted,
    flex: 1,
    marginRight: 8,
  },
  messageUnread: {
    color: COLORS.text,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: COLORS.badgeRed,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
  },
});
