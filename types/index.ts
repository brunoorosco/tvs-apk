/**
 * Tipos e interfaces para o aplicativo de TV
 */

export interface DeviceInfo {
  model: string;
  platform: "android-tv" | "ios" | "web";
  version: string;
  appVersion: string;
}

export interface PairingResponse {
  deviceToken: string;
  deviceId: string;
  deviceName?: string;
  expiresIn?: number;
}

export interface MediaItem {
  id: string;
  type: "image" | "video" | "html" | "stream";
  url: string;
  duration?: number; // milliseconds
  checksum?: string; // MD5 hash
  fileSize?: number; // bytes
  localPath?: string;
  metadata?: {
    title?: string;
    description?: string;
    tags?: string[];
  };
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  items: MediaItem[];
  schedule?: PlaylistSchedule;
  updatedAt?: string;
  version?: number;
}

export interface PlaylistSchedule {
  enabled: boolean;
  timezone?: string;
  rules?: Array<{
    start: string; // HH:mm
    end: string; // HH:mm
    days: number[]; // 0-6 (sun-sat)
  }>;
}

export interface SyncConfig {
  playlists: Playlist[];
  metadata: {
    lastUpdated: string;
    version: number;
  };
}

export interface HeartbeatData {
  deviceId: string;
  status: "online" | "offline" | "error";
  timestamp: string;
  uptime?: number; // milliseconds
  storageUsed?: number; // bytes
  temperature?: number; // celsius
}

export interface HeartbeatResponse {
  commands?: Array<{
    id: string;
    type: "sync" | "restart" | "unpair" | "update-config" | "screenshot" | "clear_cache" | "sync_playlist";
    payload?: any;
  }>;
  nextHeartbeatIn?: number; // milliseconds
}

export interface ErrorReport {
  message: string;
  stack?: string;
  timestamp: string;
  context?: {
    screen?: string;
    action?: string;
  };
}

export interface StorageInfo {
  used: number; // bytes
  total: number; // bytes
  percentage: number;
}

export interface DeviceState {
  isPaired: boolean;
  deviceToken: string | null;
  deviceId: string | null;
  deviceName: string | null;
  autoStartEnabled: boolean;
}

export interface PlaylistState {
  playlists: Playlist[];
  currentPlaylistIndex: number;
  currentItemIndex: number;
  isOffline: boolean;
  isLoading: boolean;
  lastSyncTime: number | null;
}
