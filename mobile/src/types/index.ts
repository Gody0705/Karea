export type UserStatus = 'online' | 'busy' | 'offline';

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  country: string;
  countryFlag: string;
  status: UserStatus;
  avatar: string;
  bio: string;
  photos: string[];
  isPopular?: boolean;
  isFollowed?: boolean;
  pricePerMinute?: number;
  fansCount: number;
  followingCount: number;
  friendsCount: number;
  level: number;
  userIdCode: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  isRead: boolean;
  isSentByMe: boolean;
}

export interface Conversation {
  id: string;
  user: UserProfile;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isOnline: boolean;
}

export interface Visitor {
  id: string;
  user: UserProfile;
  visitedAt: string;
}

export type RootStackParamList = {
  MainTabs: undefined;
  UserProfile: { user: UserProfile };
  Chat: { conversation: Conversation } | { user: UserProfile };
  VideoCall: { user: UserProfile; isRandom?: boolean };
};

export type BottomTabParamList = {
  Discovery: undefined;
  RandomCall: undefined;
  Messages: undefined;
  Profile: undefined;
};
