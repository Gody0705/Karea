import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Message, UserProfile } from '../types';
import { COLORS, SHADOWS, RADIUS } from '../constants/theme';
import { GiftModal } from '../components/GiftModal';

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;

export const ChatScreen: React.FC = () => {
  const route = useRoute<ChatScreenRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const partner: UserProfile =
    'conversation' in route.params
      ? route.params.conversation.user
      : route.params.user;

  const [inputMessage, setInputMessage] = useState('');
  const [isGiftModalVisible, setIsGiftModalVisible] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm1',
      senderId: partner.id,
      text: `Salut ! Enchanté de faire ta connaissance ✨`,
      timestamp: '18:30',
      isRead: true,
      isSentByMe: false,
    },
    {
      id: 'm2',
      senderId: 'me',
      text: `Hello ${partner.name.split(' ')[0]} ! Pareil pour moi 😊 Tu viens d'où exactement ?`,
      timestamp: '18:32',
      isRead: true,
      isSentByMe: true,
    },
    {
      id: 'm3',
      senderId: partner.id,
      text: `Je suis à ${partner.country}. Tu es libre pour un appel vidéo ?`,
      timestamp: '18:35',
      isRead: true,
      isSentByMe: false,
    },
  ]);

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: 'me',
      text: inputMessage.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isRead: false,
      isSentByMe: true,
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputMessage('');
  };

  const handleStartCall = () => {
    navigation.navigate('VideoCall', { user: partner });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* En-tête du Chat */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.profileHeaderTouch}
          onPress={() => navigation.navigate('UserProfile', { user: partner })}
          activeOpacity={0.8}
        >
          <View style={styles.avatarWrapper}>
            <Image source={{ uri: partner.avatar }} style={styles.avatar} />
            <View style={styles.onlineDot} />
          </View>

          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.nameText} numberOfLines={1}>
                {partner.name}
              </Text>
              <Text style={styles.flagText}>{partner.countryFlag}</Text>
            </View>
            <Text style={styles.statusText}>En ligne actuellement</Text>
          </View>
        </TouchableOpacity>

        {/* Bouton d'appel vidéo en haut à droite */}
        <TouchableOpacity
          style={[styles.callHeaderBtn, SHADOWS.soft]}
          onPress={handleStartCall}
          activeOpacity={0.8}
        >
          <Ionicons name="videocam" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Corps des messages */}
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubbleContainer,
                item.isSentByMe
                  ? styles.myBubbleContainer
                  : styles.theirBubbleContainer,
              ]}
            >
              <View
                style={[
                  styles.messageBubble,
                  item.isSentByMe ? styles.myBubble : styles.theirBubble,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    item.isSentByMe ? styles.myMessageText : styles.theirMessageText,
                  ]}
                >
                  {item.text}
                </Text>
                <Text
                  style={[
                    styles.timeText,
                    item.isSentByMe ? styles.myTimeText : styles.theirTimeText,
                  ]}
                >
                  {item.timestamp}
                </Text>
              </View>
            </View>
          )}
        />

        {/* Barre de saisie */}
        <View style={styles.inputBarContainer}>
          {/* Bouton Cadeau */}
          <TouchableOpacity
            style={styles.giftIconBtn}
            onPress={() => setIsGiftModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="gift-outline" size={22} color={COLORS.gold} />
          </TouchableOpacity>

          {/* Champ de saisie */}
          <TextInput
            style={styles.textInput}
            placeholder="Écrivez un message..."
            placeholderTextColor={COLORS.textLight}
            value={inputMessage}
            onChangeText={setInputMessage}
            multiline
          />

          {/* Bouton Envoyer */}
          <TouchableOpacity
            style={[
              styles.sendButton,
              !inputMessage.trim() && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!inputMessage.trim()}
            activeOpacity={0.8}
          >
            <Ionicons name="send" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <GiftModal
        visible={isGiftModalVisible}
        onClose={() => setIsGiftModalVisible(false)}
        onSendGift={(gift) => {
          const giftMsg: Message = {
            id: Date.now().toString(),
            senderId: 'me',
            text: `🎁 A envoyé un cadeau : ${gift.name} ${gift.emoji}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isRead: false,
            isSentByMe: true,
          };
          setMessages((prev) => [...prev, giftMsg]);
        }}
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 6,
  },
  profileHeaderTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 4,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.online,
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  headerInfo: {
    marginLeft: 10,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nameText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  flagText: {
    fontSize: 13,
  },
  statusText: {
    fontSize: 11,
    color: COLORS.online,
    fontWeight: '600',
  },
  callHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardContainer: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  bubbleContainer: {
    marginVertical: 4,
    flexDirection: 'row',
  },
  myBubbleContainer: {
    justifyContent: 'flex-end',
  },
  theirBubbleContainer: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
  },
  myBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  myMessageText: {
    color: COLORS.white,
  },
  theirMessageText: {
    color: COLORS.text,
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myTimeText: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  theirTimeText: {
    color: COLORS.textLight,
  },
  inputBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  giftIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.goldLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 14,
    color: COLORS.text,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.textLight,
  },
});
