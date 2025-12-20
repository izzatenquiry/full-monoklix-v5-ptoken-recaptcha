
import type { ComponentType } from 'react';

export type Language = 'en' | 'ms';

export type View =
  | 'home'
  | 'get-started'
  | 'ai-text-suite'
  | 'ai-image-suite'
  | 'ai-video-suite'
  | 'ai-prompt-library-suite'
  | 'gallery'
  | 'settings'
  | 'api-generator'
  | 'master-dashboard'
  | 'token-master'
  | 'admin-suite'
  | 'ugc-gen';

export type UserRole = 'admin' | 'user' | 'special_user';

export type UserStatus = 'lifetime' | 'admin' | 'inactive' | 'pending_payment' | 'subscription' | 'trial';

export interface NavItem {
  id: View | 'logout' | 'support-group';
  label: string;
  icon: ComponentType<{ className?: string }>;
  section: 'main' | 'free' | 'ugc' | 'bottom' | 'admin';
  url?: string;
  isNew?: boolean;
  isExternal?: boolean;
  roles?: UserRole[];
  disabledForStatus?: UserStatus[];
  hideForStatus?: UserStatus[];
  isSpecial?: boolean;
  description?: string;
}

export type HistoryItemType = 'Image' | 'Video' | 'Storyboard' | 'Canvas' | 'Audio' | 'Copy';

export interface HistoryItem {
  id: string;
  userId?: string;
  type: HistoryItemType;
  prompt: string;
  result: string | Blob; 
  timestamp: number;
}

export interface AiLogItem {
  id: string;
  userId: string;
  timestamp: number;
  model: string;
  prompt: string;
  output: string;
  tokenCount: number;
  cost?: number;
  status: 'Success' | 'Error';
  error?: string;
  mediaOutput?: string | Blob;
}

export interface Tutorial {
  title: string;
  description: string;
  thumbnailUrl: string;
}

export interface TutorialContent {
  mainVideoUrl: string;
  mainTitle: string;
  mainDescription: string;
  tutorials: Tutorial[];
}

export interface User {
  id: string;
  email: string;
  createdAt: string;
  fullName?: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  apiKey?: string | null;
  avatarUrl?: string;
  username: string;
  subscriptionExpiry?: number;
  totalImage?: number;
  totalVideo?: number;
  lastSeenAt?: string;
  forceLogoutAt?: string;
  appVersion?: string;
  personalAuthToken?: string | null;
  recaptchaToken?: string | null;
  proxyServer?: string | null;
  batch_02?: string | null;
  lastDevice?: string | null;
}

export type LoginResult = { success: true; user: User } | { success: false; message: string };

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: 'New Feature' | 'Improvement' | 'Maintenance' | 'General' | 'Ciri Baru' | 'Penambahbaikan' | 'Penyelenggaraan' | 'Umum';
  createdAt: string;
}

export type PlatformSystemStatus = 'operational' | 'degraded' | 'outage';

export interface PlatformStatus {
  status: PlatformSystemStatus;
  message: string;
  lastUpdated: string;
}

export interface ErrorModalContent {
  title: string;
  message: string;
  suggestion?: string;
  errorCode?: string;
}

export interface BatchItem {
  prompt: string;
  image?: {
    base64: string;
    mimeType: string;
  };
}

export type BatchProcessorPreset = BatchItem[];

export interface ViralPrompt {
  id: number;
  title: string;
  author: string;
  imageUrl: string;
  prompt: string;
}

export interface WelcomeAnimationProps {
  onAnimationEnd: () => void;
  language: Language;
}
