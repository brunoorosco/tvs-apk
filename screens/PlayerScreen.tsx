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
  Text,
  View,
} from "react-native";
import WebView from "react-native-webview";
import { deviceApi } from "../services/api";
import { SyncService } from "../services/syncService";
import { useDeviceStore } from "../store/deviceStore";
import { usePlaylistStore } from "../store/playlistStore";

const { width, height } = Dimensions.get("window");

// Task Name for background sync
const BACKGROUND_SYNC_TASK = "PLAYLIST_BACKGROUND_SYNC";

// Registrar background task para sync
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const { data } = await deviceApi.getSyncConfig();
    const syncService = new SyncService();
    await syncService.syncMedia(data.playlists);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error("Background sync failed:", error);
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
    playlists,
    currentPlaylistIndex,
    currentItemIndex,
    isOffline,
    isLoading,
    nextItem,
    previousItem,
    setOffline,
    setLoading,
    loadFromCache,
    getCurrentPlaylist,
    getCurrentItem,
  } = usePlaylistStore();

  const { deviceId } = useDeviceStore();

  // State
  const [playerState, setPlayerState] = useState<PlayerState>({
    isPlaying: true,
    showControls: false,
    currentTime: 0,
    duration: 0,
    error: null,
  });

  const [imageKey, setImageKey] = useState(0);
  const appState = useRef(AppState.currentState);
  const syncService = useRef(new SyncService()).current;
  const timerRef = useRef<NodeJS.Timeout>();
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  // Obter item e playlist atuais
  const currentPlaylist = getCurrentPlaylist();
  const currentItem = getCurrentItem();

  // Inicializar ao montar componente
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    initializePlayer();

    return () => {
      subscription.remove();
      clearTimers();
    };
  }, []);

  // Timer para auto-avançar (imagens/HTML/Streams com duração)
  useEffect(() => {
    clearTimers();

    // Se não houver item, ou for um vídeo (que avança no onEnd), ou um stream infinito
    if (!currentItem) return;

    // Vídeos avançam pelo evento didJustFinish, a menos que tenham uma duração explícita menor que o vídeo
    if (currentItem.type === "video" && !currentItem.duration) return;

    // Streams são infinitos a menos que tenham duração
    if (currentItem.type === "stream" && !currentItem.duration) return;

    const duration = currentItem.duration || 10000; // default 10s

    timerRef.current = setTimeout(() => {
      handleNextItem();
    }, duration);

    return () => clearTimers();
  }, [currentItem, currentItemIndex, handleNextItem]);

  // Heartbeat periódico
  useEffect(() => {
    const heartbeatInterval = setInterval(
      () => {
        sendHeartbeat();
      },
      30 * 60 * 1000,
    ); // 30 minutos

    // Enviar heartbeat inicial
    sendHeartbeat();

    return () => clearInterval(heartbeatInterval);
  }, [currentItem]);

  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === "active"
    ) {
      console.log("App voltou do background - sincronizando");
      syncPlaylist();
    }
    appState.current = nextAppState;
  }, []);

  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
  };

  const initializePlayer = async () => {
    setLoading(true);
    try {
      await syncPlaylist();
      await registerBackgroundSync();
    } catch (error) {
      console.error("Erro ao inicializar player:", error);
      // Tentar usar cache
      loadFromCache();
      setOffline(true);
    } finally {
      setLoading(false);
    }
  };

  const syncPlaylist = async () => {
    try {
      const { data } = await deviceApi.getSyncConfig();
      await syncService.syncMedia(data.playlists);
      setOffline(false);
    } catch (error) {
      console.error("Sync failed:", error);
      loadFromCache();
      setOffline(true);
    }
  };

  const registerBackgroundSync = async () => {
    try {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: 5 * 60, // 5 minutos
        stopOnTerminate: false,
        startOnBoot: true,
      });
    } catch (error) {
      console.warn("Background fetch registration failed:", error);
    }
  };

  const sendHeartbeat = async () => {
    try {
      const stats = await syncService.getStorageStats();

      await deviceApi.sendHeartbeat({
        deviceId,
        status: "online",
        timestamp: new Date().toISOString(),
        currentlyPlaying: currentItem?.id,
        storageUsed: stats.used,
        storageTotal: stats.total,
      });
    } catch (error) {
      console.warn("Heartbeat failed:", error);
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

  const handleImageError = (error: any) => {
    console.error("Erro ao carregar imagem:", error);
    setPlayerState((prev) => ({
      ...prev,
      error: "Erro ao carregar imagem",
    }));

    // Pular para o próximo item após 5 segundos em caso de erro
    setTimeout(() => {
      setPlayerState((prev) => ({ ...prev, error: null }));
      handleNextItem();
    }, 5000);
  };

  const handleVideoError = (error: any) => {
    console.error("Erro ao carregar vídeo:", error);
    setPlayerState((prev) => ({
      ...prev,
      error: "Erro ao carregar vídeo",
    }));

    // Pular para o próximo item após 5 segundos em caso de erro
    setTimeout(() => {
      setPlayerState((prev) => ({ ...prev, error: null }));
      handleNextItem();
    }, 5000);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Carregando playlist...</Text>
      </View>
    );
  }

  if (!currentItem || !currentPlaylist) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.emptyText}>Nenhum conteúdo disponível</Text>
        <Text style={styles.emptySubtext}>
          Aguardando atualização do servidor
        </Text>
      </View>
    );
  }

  if (playerState.error) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>❌ {playerState.error}</Text>
        <Text style={styles.errorSubtext}>Próximo item em 5 segundos...</Text>
      </View>
    );
  }

  const renderMedia = () => {
    if (!currentItem) return null;

    switch (currentItem.type) {
      case "image":
        return (
          <View style={styles.mediaContainer}>
            <Image
              key={imageKey}
              source={{
                uri: currentItem.localPath || currentItem.url,
              }}
              style={styles.media}
              resizeMode="cover"
              onError={handleImageError}
            />
            {currentItem.metadata?.title && (
              <View style={styles.mediaOverlay}>
                <Text style={styles.mediaTitle}>
                  {currentItem.metadata.title}
                </Text>
                {currentItem.metadata?.description && (
                  <Text style={styles.mediaDescription}>
                    {currentItem.metadata.description}
                  </Text>
                )}
              </View>
            )}
          </View>
        );

      case "video":
        return (
          <View style={styles.mediaContainer}>
            <Video
              source={{
                uri: currentItem.localPath || currentItem.url,
              }}
              style={styles.media}
              resizeMode={ResizeMode.COVER}
              shouldPlay={playerState.isPlaying}
              isLooping={false}
              onPlaybackStatusUpdate={(status) => {
                if (status.isLoaded) {
                  if (status.didJustFinish) {
                    handleVideoEnd();
                  }
                  if (status.durationMillis) {
                    setPlayerState((prev) => ({
                      ...prev,
                      duration: status.durationMillis,
                      currentTime: status.positionMillis,
                    }));
                  }
                } else if (status.error) {
                  handleVideoError(status.error);
                }
              }}
              onError={handleVideoError}
              progressUpdateIntervalMillis={1000}
            />
          </View>
        );

      case "html":
        return (
          <View style={styles.mediaContainer}>
            <WebView
              source={{ uri: currentItem.url }}
              style={styles.media}
              originWhitelist={["*"]}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.webViewLoader}>
                  <ActivityIndicator size="large" color="#fff" />
                </View>
              )}
            />
          </View>
        );

      case "stream":
        return (
          <View style={styles.mediaContainer}>
            <Video
              source={{
                uri: currentItem.url,
              }}
              style={styles.media}
              resizeMode={ResizeMode.COVER}
              shouldPlay={playerState.isPlaying}
              isLooping={true}
              onError={handleVideoError}
            />
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Offline Banner */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>📡 MODO OFFLINE</Text>
        </View>
      )}

      {/* Media Rendering */}
      {renderMedia()}

      {/* Debug Info (somente em modo dev) */}
      {__DEV__ && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>
            {currentPlaylist.name} • {currentItemIndex + 1}/
            {currentPlaylist.items.length}
          </Text>
          <Text style={styles.debugText} numberOfLines={1}>
            {currentItem.metadata?.title || currentItem.url.split("/").pop()}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  mediaContainer: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  media: {
    width,
    height,
  },
  mediaOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  mediaTitle: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 8,
  },
  mediaDescription: {
    color: "#bbb",
    fontSize: 18,
    lineHeight: 24,
  },
  offlineBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(220, 38, 38, 0.95)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 100,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  offlineText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  loadingText: {
    color: "#888",
    fontSize: 18,
    marginTop: 16,
  },
  emptyText: {
    color: "#666",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
  },
  emptySubtext: {
    color: "#888",
    fontSize: 16,
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 12,
  },
  errorSubtext: {
    color: "#aaa",
    fontSize: 16,
  },
  debugInfo: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#2563eb",
  },
  debugText: {
    color: "#888",
    fontSize: 12,
    fontFamily: "Courier New",
    lineHeight: 18,
  },
  webViewLoader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
});
