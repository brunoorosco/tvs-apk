import { ResizeMode, Video } from "expo-av";
import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Dimensions,
  Image,
  StyleSheet,
  View
} from "react-native";
import WebView from "react-native-webview";
import { deviceApi } from "../services/api";
import { CommandService } from "../services/commandService";
import { SyncService } from "../services/syncService";
import { useDeviceStore } from "../store/deviceStore";
import { usePlaylistStore } from "../store/playlistStore";

const { width, height } = Dimensions.get("window");

const BACKGROUND_SYNC_TASK = "PLAYLIST_BACKGROUND_SYNC";

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const { data } = await deviceApi.getSyncConfig();
    const syncService = new SyncService();
    await syncService.syncMedia(data.playlists);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

interface PlayerState {
  isPlaying: boolean;
  showControls: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
}

export default function PlayerScreen() {
  const {
    currentItemIndex,
    isOffline,
    isLoading,
    nextItem,
    previousItem,
    setOffline,
    loadFromCache,
    getCurrentPlaylist,
    getCurrentItem,
  } = usePlaylistStore();

  const { deviceId } = useDeviceStore();

  const [playerState, setPlayerState] = useState<PlayerState>({
    isPlaying: true,
    showControls: false,
    currentTime: 0,
    duration: 0,
    error: null,
  });

  const [imageKey, setImageKey] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const appState = useRef(AppState.currentState);
  const syncService = useRef(new SyncService()).current;
  const commandService = useRef(new CommandService()).current;
  const timerRef = useRef<NodeJS.Timeout>();
  const playerViewRef = useRef<View>(null);

  const FALLBACK_IMAGES = [
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1920&q=80",
    "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1920&q=80",
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1920&q=80",
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80",
  ];

  const [fallbackIndex, setFallbackIndex] = useState(0);

  useEffect(() => {
    if (currentItem) return;
    const interval = setInterval(() => {
      setFallbackIndex((prev) => (prev + 1) % FALLBACK_IMAGES.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [getCurrentItem()]);

  const currentPlaylist = getCurrentPlaylist();
  const currentItem = getCurrentItem();

  useEffect(() => {
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    initializePlayer();
    return () => {
      subscription.remove();
      clearTimers();
    };
  }, []);

  useEffect(() => {
    clearTimers();
    if (!currentItem) return;
    if (currentItem.type === "video" && !currentItem.duration) return;
    if (currentItem.type === "stream" && !currentItem.duration) return;
    if (currentItem.type === "youtube" && !currentItem.duration) return;

    const duration = currentItem.duration || 10000;
    timerRef.current = setTimeout(() => {
      handleNextItem();
    }, duration);

    return () => clearTimers();
  }, [
    currentItem?.id,
    currentItem?.duration,
    currentItem?.type,
    currentItem?.url,
    currentItem?.localPath,
    currentItemIndex,
    handleNextItem
  ]);

  useEffect(() => {
    const heartbeatInterval = setInterval(() => sendHeartbeat(), 30 * 60 * 1000);
    sendHeartbeat();
    return () => clearInterval(heartbeatInterval);
  }, [currentItem?.id]);

  useEffect(() => {
    const syncInterval = setInterval(() => syncPlaylist(), 60 * 1000);
    return () => clearInterval(syncInterval);
  }, []);

  // Injeta a ref da view no CommandService para o screenshot e o callback de refresh
  useEffect(() => {
    commandService.setPlayerRef(playerViewRef);
    commandService.setOnRefresh(syncPlaylist);
  }, []);

  // Polling de comandos a cada 30 segundos
  useEffect(() => {
    const pollCommands = async () => {
      const command = await commandService.fetchPendingCommand();
      if (command) {
        await commandService.executeCommand(command);
      }
    };

    // Executa imediatamente ao montar e depois a cada 30s
    pollCommands();
    const commandInterval = setInterval(pollCommands, 30 * 1000);
    return () => clearInterval(commandInterval);
  }, []);

  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === "active") {
      syncPlaylist();
    }
    appState.current = nextAppState;
  }, []);

  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const initializePlayer = async () => {
    setIsSyncing(true);
    try {
      await syncPlaylist();
      await registerBackgroundSync();
    } catch (error) {
      loadFromCache();
      setOffline(true);
    } finally {
      setIsSyncing(false);
    }
  };

  const syncPlaylist = async () => {
    try {
      const { data } = await deviceApi.getSyncConfig();
      await syncService.syncMedia(data.playlists);
      setOffline(false);
    } catch (error) {
      loadFromCache();
      setOffline(true);
    }
  };

  const registerBackgroundSync = async () => {
    try {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: 5 * 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    } catch (error) { }
  };

  const sendHeartbeat = async () => {
    console.log("sendHeartbeat", deviceId);
    try {
      const stats = await syncService.getStorageStats();
      const response = await deviceApi.sendHeartbeat({
        deviceUid: deviceId,
        status: "online",
        timestamp: new Date().toISOString(),
        currentlyPlaying: currentItem?.id,
        storageUsed: stats.used,
        storageTotal: stats.total,
      });

      // Processa comandos retornados na resposta do heartbeat
      const commands = response.data?.commands;
      if (commands && Array.isArray(commands)) {
        for (const cmd of commands) {
          await commandService.executeCommand(cmd);
        }
      }
    } catch (error) {
      if (__DEV__) console.error("[PlayerScreen] Erro no heartbeat:", error);
    }
  };

  const handleNextItem = useCallback(() => {
    nextItem();
    setImageKey((prev) => prev + 1);
  }, [nextItem]);

  const handlePreviousItem = useCallback(() => {
    previousItem();
    setImageKey((prev) => prev + 1);
  }, [previousItem]);

  const handleVideoEnd = useCallback(() => {
    handleNextItem();
  }, [handleNextItem]);

  const getYoutubeEmbedUrl = (url: string) => {
    let videoId = "";
    if (url.includes("v=")) videoId = url.split("v=")[1].split("&")[0];
    else if (url.includes("youtu.be/")) videoId = url.split("youtu.be/")[1].split("?")[0];
    else if (url.includes("embed/")) videoId = url.split("embed/")[1].split("?")[0];

    return `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&showinfo=0&rel=0&loop=1&playlist=${videoId}&mute=0&origin=https://www.youtube.com`;
  };

  if (isLoading && !currentItem) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const renderMedia = () => {
    if (!currentItem) {
      return (
        <View style={styles.mediaContainer}>
          <Image
            source={{ uri: FALLBACK_IMAGES[fallbackIndex] }}
            style={styles.media}
            resizeMode="cover"
          />
        </View>
      );
    }

    switch (currentItem.type) {
      case "image":
        return (
          <View style={styles.mediaContainer}>
            <Image
              key={imageKey}
              source={{ uri: currentItem.localPath || currentItem.url }}
              style={styles.media}
              resizeMode="cover"
              onError={() => handleNextItem()}
            />
          </View>
        );

      case "video":
        return (
          <View style={styles.mediaContainer}>
            <Video
              source={{ uri: currentItem.localPath || currentItem.url }}
              style={styles.media}
              resizeMode={ResizeMode.COVER}
              shouldPlay={playerState.isPlaying}
              onPlaybackStatusUpdate={(status) => {
                if (status.isLoaded && status.didJustFinish) handleVideoEnd();
              }}
              onError={() => handleNextItem()}
            />
          </View>
        );

      case "youtube": {
        const videoId = (function () {
          const url = currentItem.url;
          if (url.includes("v=")) return url.split("v=")[1].split("&")[0];
          if (url.includes("youtu.be/")) return url.split("youtu.be/")[1].split("?")[0];
          if (url.includes("embed/")) return url.split("embed/")[1].split("?")[0];
          return "";
        })();

        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              <style>
                body { margin: 0; padding: 0; background-color: #000; overflow: hidden; height: 100vh; }
                iframe { width: 100vw; height: 100vh; border: none; pointer-events: none; }
              </style>
            </head>
            <body>
              <iframe 
                src="https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&showinfo=0&rel=0&loop=1&playlist=${videoId}&mute=0&playsinline=1" 
                allow="autoplay; fullscreen"
              ></iframe>
            </body>
          </html>
        `;

        return (
          <View style={styles.mediaContainer}>
            <WebView
              source={{ html, baseUrl: "https://www.youtube.com" }}
              style={styles.media}
              originWhitelist={["*"]}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
            />
          </View>
        );
      }

      case "html":
        return (
          <View style={styles.mediaContainer}>
            <WebView
              source={{ uri: currentItem.url }}
              style={styles.media}
              originWhitelist={["*"]}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
            />
          </View>
        );

      case "stream":
        return (
          <View style={styles.mediaContainer}>
            <Video
              source={{ uri: currentItem.url }}
              style={styles.media}
              resizeMode={ResizeMode.COVER}
              shouldPlay={playerState.isPlaying}
              isLooping={true}
              onError={() => handleNextItem()}
            />
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View ref={playerViewRef} style={styles.container} collapsable={false}>
      {renderMedia()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { justifyContent: "center", alignItems: "center" },
  mediaContainer: { flex: 1, position: "relative", overflow: "hidden" },
  media: { width, height },
});
