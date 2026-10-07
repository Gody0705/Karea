import React from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ConversationItem } from '../components/ConversationItem';
import { VisitorItem } from '../components/VisitorItem';
import { MOCK_CONVERSATIONS, MOCK_VISITORS } from '../data/mockData';
import { Conversation, Visitor, RootStackParamList } from '../types';
import { COLORS, SHADOWS, RADIUS } from '../constants/theme';

export const MessagesScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleConversationPress = (conversation: Conversation) => {
    navigation.navigate('Chat', { conversation });
  };

  const handleVisitorPress = (visitor: Visitor) => {
    navigation.navigate('UserProfile', { user: visitor.user });
  };

  const totalUnread = MOCK_CONVERSATIONS.reduce(
    (acc, item) => acc + item.unreadCount,
    0
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Barre supérieure Messages */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.headerTitle}>Messages</Text>
          {totalUnread > 0 && (
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeText}>{totalUnread}</Text>
            </View>
          )}
        </View>

        <View style={styles.headerIcons}>
          {/* Nouveau message */}
          <TouchableOpacity style={styles.iconButton} activeOpacity={0.75}>
            <Ionicons name="create-outline" size={22} color={COLORS.primaryDark} />
          </TouchableOpacity>

          {/* Notifications avec badge */}
          <TouchableOpacity style={styles.iconButton} activeOpacity={0.75}>
            <Ionicons name="notifications-outline" size={22} color={COLORS.primaryDark} />
            <View style={styles.notifBadge} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={MOCK_CONVERSATIONS}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Section Visiteurs récents */}
            <View style={styles.visitorsSection}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionTitleLeft}>
                  <Ionicons name="eye-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.sectionTitle}>Visiteurs récents</Text>
                </View>
                <Text style={styles.seeAllText}>Voir tout</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.visitorsScroll}
              >
                {MOCK_VISITORS.map((visitor) => (
                  <VisitorItem
                    key={visitor.id}
                    visitor={visitor}
                    onPress={() => handleVisitorPress(visitor)}
                  />
                ))}
              </ScrollView>
            </View>

            {/* En-tête des conversations */}
            <View style={styles.conversationsHeader}>
              <Text style={styles.sectionTitle}>Boîte de réception</Text>
              <Text style={styles.convCountText}>
                {MOCK_CONVERSATIONS.length} discussions
              </Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <ConversationItem
            conversation={item}
            onPress={() => handleConversationPress(item)}
          />
        )}
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  totalBadge: {
    backgroundColor: COLORS.badgeRed,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  totalBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.badgeRed,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  visitorsSection: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginTop: 14,
    marginBottom: 16,
    ...SHADOWS.soft,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  seeAllText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  visitorsScroll: {
    paddingVertical: 4,
  },
  conversationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  convCountText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
});
