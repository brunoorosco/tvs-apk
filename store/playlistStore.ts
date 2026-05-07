import { MMKV } from "react-native-mmkv";
import { create } from "zustand";

const storage = new MMKV();
const CACHE_KEY = "cachedPlaylists";
const LAST_SYNC_KEY = "lastPlaylistSync";

interface MediaItem {
  id: string;
  type: "image" | "video" | "html";
  url: string;
  duration?: number;
  checksum?: string;
  fileSize?: number;
  localPath?: string;
}

interface Playlist {
  id: string;
  name: string;
  items: MediaItem[];
  schedule?: any;
  updatedAt?: string;
}

interface PlaylistState {
  playlists: Playlist[];
  currentPlaylistIndex: number;
  currentItemIndex: number;
  isOffline: boolean;
  isLoading: boolean;
  lastSyncTime: number | null;
  setPlaylists: (playlists: Playlist[]) => Promise<void>;
  nextItem: () => void;
  previousItem: () => void;
  setCurrentPlaylist: (index: number) => void;
  setCurrentItem: (index: number) => void;
  setOffline: (offline: boolean) => void;
  setLoading: (loading: boolean) => void;
  loadFromCache: () => Promise<void>;
  clearCache: () => Promise<void>;
  getCurrentItem: () => MediaItem | null;
  getCurrentPlaylist: () => Playlist | null;
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],
  currentPlaylistIndex: 0,
  currentItemIndex: 0,
  isOffline: false,
  isLoading: true,
  lastSyncTime: null,

  setPlaylists: async (playlists) => {
    const timestamp = new Date().toISOString();
    const playlistsWithTime = playlists.map((p) => ({
      ...p,
      updatedAt: timestamp,
    }));
    
    storage.set(CACHE_KEY, JSON.stringify(playlistsWithTime));
    storage.set(LAST_SYNC_KEY, Date.now().toString());
    
    set({
      playlists: playlistsWithTime,
      isLoading: false,
      lastSyncTime: Date.now(),
      currentItemIndex: 0,
      currentPlaylistIndex: 0,
    });
  },

  nextItem: () => {
    const state = get();
    const currentPlaylist = state.playlists[state.currentPlaylistIndex];
    if (!currentPlaylist || currentPlaylist.items.length === 0) return;

    const nextIndex =
      (state.currentItemIndex + 1) % currentPlaylist.items.length;
    set({ currentItemIndex: nextIndex });
  },

  previousItem: () => {
    const state = get();
    const currentPlaylist = state.playlists[state.currentPlaylistIndex];
    if (!currentPlaylist || currentPlaylist.items.length === 0) return;

    const prevIndex =
      state.currentItemIndex === 0
        ? currentPlaylist.items.length - 1
        : state.currentItemIndex - 1;
    set({ currentItemIndex: prevIndex });
  },

  setCurrentPlaylist: (index) => {
    const state = get();
    if (index >= 0 && index < state.playlists.length) {
      set({ currentPlaylistIndex: index, currentItemIndex: 0 });
    }
  },

  setCurrentItem: (index) => {
    const state = get();
    const currentPlaylist = state.playlists[state.currentPlaylistIndex];
    if (currentPlaylist && index >= 0 && index < currentPlaylist.items.length) {
      set({ currentItemIndex: index });
    }
  },

  setOffline: (offline) => set({ isOffline: offline }),
  setLoading: (loading) => set({ isLoading: loading }),

  loadFromCache: async () => {
    try {
      const cached = storage.getString(CACHE_KEY);
      const lastSync = storage.getString(LAST_SYNC_KEY);
      
      if (cached) {
        set({
          playlists: JSON.parse(cached),
          isOffline: true,
          lastSyncTime: lastSync ? parseInt(lastSync) : null,
        });
      }
    } catch (e) {
      console.error("Erro ao carregar cache de playlists:", e);
    }
  },

  clearCache: async () => {
    storage.delete(CACHE_KEY);
    storage.delete(LAST_SYNC_KEY);
    set({ playlists: [], lastSyncTime: null });
  },

  getCurrentItem: () => {
    const state = get();
    const currentPlaylist = state.playlists[state.currentPlaylistIndex];
    return currentPlaylist?.items[state.currentItemIndex] || null;
  },

  getCurrentPlaylist: () => {
    const state = get();
    return state.playlists[state.currentPlaylistIndex] || null;
  },
}));
