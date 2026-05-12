import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { useDeviceStore } from "../store/deviceStore";
import { usePlaylistStore } from "../store/playlistStore";
import { deviceApi } from "./api";
import { SyncService } from "./syncService";

const SYNC_TASK_NAME = "PLAYLIST_SYNC";
const HEARTBEAT_TASK_NAME = "DEVICE_HEARTBEAT";

export class BootService {
  private static syncService = new SyncService();

  /**
   * Inicializa tasks de background no boot do dispositivo
   */
  static async initializeBackgroundTasks() {
    if (Platform.OS !== "android") return;

    try {
      // Definir task de sincronização de playlist
      TaskManager.defineTask(SYNC_TASK_NAME, async () => {
        try {
          const deviceStore = useDeviceStore.getState();
          const playlistStore = usePlaylistStore.getState();

          if (!deviceStore.isPaired) {
            return BackgroundFetch.BackgroundFetchResult.NoData;
          }

          // Carregar última cópia do cache primeiro
          await playlistStore.loadFromCache();

          // Tentar sincronizar com servidor
          try {
            const { data } = await deviceApi.getSyncConfig();
            await this.syncService.syncMedia(data.playlists);
            return BackgroundFetch.BackgroundFetchResult.NewData;
          } catch (error) {
            console.error("Erro ao sincronizar com servidor:", error);
            // Usar cache se servidor falhar
            return BackgroundFetch.BackgroundFetchResult.NoData;
          }
        } catch (error) {
          console.error("Erro na task de sincronização:", error);
          return BackgroundFetch.BackgroundFetchResult.Failed;
        }
      });

      // Definir task de heartbeat
      TaskManager.defineTask(HEARTBEAT_TASK_NAME, async () => {
        try {
          const deviceStore = useDeviceStore.getState();
          if (deviceStore.isPaired) {
            await deviceApi.sendHeartbeat({
              deviceUid: deviceStore.deviceId,
              timestamp: new Date().toISOString(),
              status: "online",
            });
          }
          return BackgroundFetch.BackgroundFetchResult.NewData;
        } catch (error) {
          console.error("Erro no heartbeat:", error);
          return BackgroundFetch.BackgroundFetchResult.Failed;
        }
      });

      // Registrar as tasks
      await BackgroundFetch.registerTaskAsync(SYNC_TASK_NAME, {
        minimumInterval: 5 * 60, // 5 minutos
        stopOnTerminate: false,
        startOnBoot: true,
      });

      await BackgroundFetch.registerTaskAsync(HEARTBEAT_TASK_NAME, {
        minimumInterval: 30 * 60, // 30 minutos
        stopOnTerminate: false,
        startOnBoot: true,
      });

      console.log("Background tasks registradas com sucesso");
    } catch (error) {
      console.error("Erro ao inicializar background tasks:", error);
    }
  }

  /**
   * Carregar dados ao iniciar o app
   */
  static async loadInitialData() {
    try {
      const deviceStore = useDeviceStore.getState();
      const playlistStore = usePlaylistStore.getState();

      // 1. Carregar dados persistidos
      await deviceStore.loadFromStorage();
      await playlistStore.loadFromCache();

      // 2. Se paired, sincronizar com servidor
      if (deviceStore.isPaired) {
        try {
          const { data } = await deviceApi.getSyncConfig();
          await this.syncService.syncMedia(data.playlists);
        } catch (error) {
          console.error("Erro ao sincronizar na inicialização:", error);
          // Usar cache se falhar
        }
      }

      usePlaylistStore.getState().setLoading(false);
    } catch (error) {
      console.error("Erro ao carregar dados iniciais:", error);
      usePlaylistStore.getState().setLoading(false);
    }
  }

  /**
   * Parar todas as tasks
   */
  static async stopBackgroundTasks() {
    try {
      await BackgroundFetch.unregisterTaskAsync(SYNC_TASK_NAME);
      await BackgroundFetch.unregisterTaskAsync(HEARTBEAT_TASK_NAME);
      console.log("Background tasks paradas");
    } catch (error) {
      console.error("Erro ao parar background tasks:", error);
    }
  }
}
