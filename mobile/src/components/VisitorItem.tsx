import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Visitor } from '../types';
import { COLORS, RADIUS } from '../constants/theme';

interface VisitorItemProps {
  visitor: Visitor;
  onPress: () => void;
}

export const VisitorItem: React.FC<VisitorItemProps> = ({ visitor, onPress }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={styles.container}
    >
      <View style={styles.avatarBorder}>
        <Image source={{ uri: visitor.user.avatar }} style={styles.avatar} />
        <View style={styles.flagBadge}>
          <Text style={styles.flagText}>{visitor.user.countryFlag}</Text>
        </View>
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {visitor.user.name.split(' ')[0]}
      </Text>
      <Text style={styles.time}>{visitor.visitedAt}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginRight: 16,
    width: 68,
  },
  avatarBorder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: COLORS.primary,
    padding: 2,
    position: 'relative',
    backgroundColor: COLORS.white,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 27,
  },
  flagBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  flagText: {
    fontSize: 10,
  },
  name: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 6,
    textAlign: 'center',
  },
  time: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 1,
    textAlign: 'center',
  },
});
