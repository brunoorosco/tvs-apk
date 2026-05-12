import * as FileSystem from "expo-file-system";
import * as Updates from "expo-updates";
import { captureRef } from "react-native-view-shot";
import { deviceApi } from "./api";

export type CommandType =
  | "restart"
  | "screenshot"
  | "clear_cache"
  | "sync_playlist"
  | "sync"
  | "unpair"
  | "preview"
  | "update-config";

export interface PendingCommand {
  id?: string;
  commandId?: string;
  type: CommandType | string;
  payload: Record<string, unknown> | null;
}

const SCREENSHOTS_DIR = `${FileSystem.cacheDirectory}screenshots/`;

export class CommandService {
  /** Referência para a view principal a ser capturada (injetada pelo PlayerScreen) */
  private playerRef: React.RefObject<any> | null = null;
  
  /** Callback para disparar uma atualização forçada da UI/Playlist */
  private onRefresh?: () => Promise<void>;

  setPlayerRef(ref: React.RefObject<any>) {
    this.playerRef = ref;
  }

  setOnRefresh(callback: () => Promise<void>) {
    this.onRefresh = callback;
  }

  /** Busca o próximo comando pendente do servidor. Retorna null se não houver. */
  async fetchPendingCommand(): Promise<PendingCommand | null> {
    try {
      const response = await deviceApi.getPendingCommand();

      // 204 = sem comandos
      if (response.status === 204 || !response.data) return null;

      // Se for um array, pega o primeiro
      if (Array.isArray(response.data)) {
        return response.data.length > 0 ? response.data[0] : null;
      }

      // Se for um objeto contendo "commands" (como no heartbeat)
      if (response.data.commands && Array.isArray(response.data.commands)) {
        return response.data.commands.length > 0 ? response.data.commands[0] : null;
      }

      return response.data as PendingCommand;
    } catch (error) {
      // Silencia erros de rede — não interrompe o player
      return null;
    }
  }

  /** Processa um comando recebido do servidor */
  async executeCommand(command: PendingCommand): Promise<void> {
    const id = command.id || command.commandId;
    if (!id) {
      console.warn("[CommandService] Comando recebido sem ID:", command);
      return;
    }

    console.log(`[CommandService] Executando comando: ${command.type} (${id})`);

    switch (command.type) {
      case "screenshot":
        await this.handleScreenshot(id);
        break;

      case "restart":
        await this.handleRestart(id);
        break;

      case "clear_cache":
        await this.handleClearCache(id);
        break;

      case "sync":
      case "sync_playlist":
        // Notifica sucesso e força o refresh da playlist
        await this.reportStatus(id, "done", { message: "Sync iniciado" });
        if (this.onRefresh) {
          await this.onRefresh();
        }
        break;

      case "unpair":
        await this.handleUnpair(id);
        break;

      case "preview":
        await this.handlePreview(id, command.payload);
        break;

      default:
        console.warn(`[CommandService] Comando desconhecido: ${command.type}`);
        await this.reportStatus(id, "failed", {
          error: `Comando desconhecido: ${command.type}`,
        });
    }
  }

  // ─── Handlers ────────────────────────────────────────────────────────────────

  private async handleScreenshot(commandId: string): Promise<void> {
    try {
      if (!this.playerRef?.current) {
        await this.reportStatus(commandId, "failed", {
          error: "Referência da view não disponível",
        });
        return;
      }

      // 1. Garantir diretório
      const dirInfo = await FileSystem.getInfoAsync(SCREENSHOTS_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(SCREENSHOTS_DIR, { intermediates: true });
      }

      // 2. Capturar a tela
      const localUri = await captureRef(this.playerRef, {
        format: "jpg",
        quality: 0.8,
        result: "tmpfile",
      });

      // 3. Enviar ao servidor via multipart
      const formData = new FormData();
      formData.append("commandId", commandId);
      // @ts-ignore - Tipagem de FormData no React Native é especial para arquivos
      formData.append("file", {
        uri: localUri,
        name: `screenshot-${Date.now()}.jpg`,
        type: "image/jpeg",
      });

      await deviceApi.uploadScreenshot(formData);

      // 4. Limpar arquivo temporário
      await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {});
    } catch (error: any) {
      console.error("[CommandService] Erro no screenshot:", error);
      await this.reportStatus(commandId, "failed", {
        error: error?.message ?? "Erro desconhecido ao capturar tela",
      });
    }
  }

  private async handlePreview(commandId: string, payload: any): Promise<void> {
    try {
      const duration = (payload?.duration as number) || 30000; // 30s default
      const interval = (payload?.interval as number) || 3000;  // 3s default
      
      console.log(`[CommandService] Iniciando preview: ${duration}ms, intervalo ${interval}ms`);
      
      await this.reportStatus(commandId, "done", { message: "Preview iniciado" });

      const startTime = Date.now();
      
      // Loop de capturas
      const runPreview = async () => {
        if (Date.now() - startTime > duration) {
          console.log("[CommandService] Preview finalizado por tempo");
          return;
        }

        try {
          if (this.playerRef?.current) {
            // Captura com resolução reduzida para ser MUITO mais rápido
            const localUri = await captureRef(this.playerRef, {
              format: "jpg",
              quality: 0.4, // Qualidade baixa para velocidade
              width: 480,   // Resolução SD para preview
              result: "tmpfile",
            });

            const formData = new FormData();
            formData.append("commandId", commandId);
            formData.append("isPreview", "true");
            // @ts-ignore
            formData.append("file", {
              uri: localUri,
              name: `preview-${Date.now()}.jpg`,
              type: "image/jpeg",
            });

            await deviceApi.uploadScreenshot(formData);
            await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {});
          }
        } catch (err) {
          console.error("[CommandService] Erro no loop de preview:", err);
        }

        // Agenda a próxima captura
        setTimeout(runPreview, interval);
      };

      runPreview();
    } catch (error: any) {
      console.error("[CommandService] Erro ao iniciar preview:", error);
      await this.reportStatus(commandId, "failed", { error: error?.message });
    }
  }

  private async handleRestart(commandId: string): Promise<void> {
    try {
      // Reporta sucesso ANTES de reiniciar
      await this.reportStatus(commandId, "done", { message: "Reiniciando app..." });

      // Aguarda um instante para a requisição sair
      await new Promise((resolve) => setTimeout(() => resolve(null), 1000));

      // 1. Tenta via DevSettings (funciona em quase todos os ambientes de dev/prod)
      try {
        const { DevSettings } = require('react-native');
        if (DevSettings && typeof DevSettings.reload === 'function') {
          DevSettings.reload();
          return;
        }
      } catch (e) {
        // Silencia erro se DevSettings não estiver disponível
      }

      // 2. Tenta via expo-updates (reloadAsync)
      if (Updates.reloadAsync && typeof Updates.reloadAsync === 'function') {
        // Usa uma referência limpa para evitar problemas de contexto
        const reloadFn = Updates.reloadAsync;
        await reloadFn();
      }
    } catch (error: any) {
      console.error("[CommandService] Erro no restart:", error);
      await this.reportStatus(commandId, "failed", {
        error: error?.message ?? "Falha ao reiniciar",
      });
    }
  }

  private async handleClearCache(commandId: string): Promise<void> {
    try {
      const { usePlaylistStore } = await import("../store/playlistStore");
      await usePlaylistStore.getState().clearCache();
      
      // Força a busca de uma nova playlist após limpar o cache
      if (this.onRefresh) {
        await this.onRefresh();
      }

      await this.reportStatus(commandId, "done", { message: "Cache limpo e playlist atualizada" });
    } catch (error: any) {
      await this.reportStatus(commandId, "failed", {
        error: error?.message ?? "Falha ao limpar cache",
      });
    }
  }

  private async handleUnpair(commandId: string): Promise<void> {
    try {
      const { useDeviceStore } = await import("../store/deviceStore");
      await this.reportStatus(commandId, "done", { message: "Despareando dispositivo..." });
      await new Promise((r) => setTimeout(r, 1000));
      await useDeviceStore.getState().clearPairing();
    } catch (error: any) {
      await this.reportStatus(commandId, "failed", {
        error: error?.message ?? "Falha ao desparear",
      });
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async reportStatus(
    commandId: string,
    status: "done" | "failed",
    result?: Record<string, unknown>
  ): Promise<void> {
    try {
      // Envia ambos para garantir compatibilidade com o backend
      await deviceApi.reportCommandStatus({
        id: commandId,
        commandId: commandId,
        status,
        result,
      });
    } catch (error) {
      console.error("[CommandService] Falha ao reportar status do comando:", error);
    }
  }
}
