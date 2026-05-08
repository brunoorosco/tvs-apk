import * as FileSystem from "expo-file-system";
import { create } from "zustand";

const CACHE_FILE = `${FileSystem.cacheDirectory}playlist_cache.json`;

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
    
    try {
      const data = {
        playlists: playlistsWithTime,
        lastSyncTime: Date.now()
      };
      await FileSystem.writeAsStringAsync(CACHE_FILE, JSON.stringify(data));
    } catch (error) {
      console.error("Erro ao salvar cache no FileSystem:", error);
    }
    
    set((state) => {
      let newPlaylistIndex = state.currentPlaylistIndex;
      let newItemIndex = state.currentItemIndex;

      const currentPlaylistId = state.playlists[state.currentPlaylistIndex]?.id;
      const currentItemId = state.playlists[state.currentPlaylistIndex]?.items[state.currentItemIndex]?.id;

      if (playlistsWithTime.length > 0) {
        if (currentPlaylistId) {
          const foundPlaylistIndex = playlistsWithTime.findIndex(p => p.id === currentPlaylistId);
          if (foundPlaylistIndex !== -1) {
            newPlaylistIndex = foundPlaylistIndex;
            if (currentItemId) {
              const foundItemIndex = playlistsWithTime[foundPlaylistIndex].items.findIndex(i => i.id === currentItemId);
              if (foundItemIndex !== -1) {
                newItemIndex = foundItemIndex;
              } else {
                newItemIndex = 0;
              }
            }
          } else {
            newPlaylistIndex = 0;
            newItemIndex = 0;
          }
        }
      } else {
        newPlaylistIndex = 0;
        newItemIndex = 0;
      }

      if (newPlaylistIndex >= playlistsWithTime.length) newPlaylistIndex = 0;
      if (playlistsWithTime[newPlaylistIndex] && newItemIndex >= playlistsWithTime[newPlaylistIndex].items.length) {
        newItemIndex = 0;
      }

      return {
        playlists: playlistsWithTime,
        isLoading: false,
        lastSyncTime: Date.now(),
        currentPlaylistIndex: newPlaylistIndex,
        currentItemIndex: newItemIndex,
      };
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
      const fileInfo = await FileSystem.getInfoAsync(CACHE_FILE);
      if (fileInfo.exists) {
        const content = await FileSystem.readAsStringAsync(CACHE_FILE);
        const data = JSON.parse(content);
        
        set({
          playlists: data.playlists || [],
          isOffline: true,
          lastSyncTime: data.lastSyncTime || null,
        });
      }
    } catch (e) {
      console.error("Erro ao carregar cache de playlists:", e);
    }
  },

  clearCache: async () => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(CACHE_FILE);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(CACHE_FILE);
      }
    } catch (error) {
      console.error("Erro ao deletar cache:", error);
    }
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
