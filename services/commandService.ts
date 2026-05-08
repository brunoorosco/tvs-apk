import * as FileSystem from "expo-file-system";
import * as Updates from "expo-updates";
import { captureRef } from "react-native-view-shot";
import { deviceApi } from "./api";

export type CommandType = "restart" | "screenshot" | "clear_cache" | "sync_playlist";

export interface PendingCommand {
  commandId: string;
  type: CommandType;
  payload: Record<string, unknown> | null;
}

const SCREENSHOTS_DIR = `${FileSystem.cacheDirectory}screenshots/`;

export class CommandService {
  /** Referência para a view principal a ser capturada (injetada pelo PlayerScreen) */
  private playerRef: React.RefObject<any> | null = null;

  setPlayerRef(ref: React.RefObject<any>) {
    this.playerRef = ref;
  }

  /** Busca o próximo comando pendente do servidor. Retorna null se não houver. */
  async fetchPendingCommand(): Promise<PendingCommand | null> {
    try {
      const response = await deviceApi.getPendingCommand();

      // 204 = sem comandos
      if (response.status === 204) return null;

      return response.data as PendingCommand;
    } catch (error) {
      // Silencia erros de rede — não interrompe o player
      return null;
    }
  }

  /** Processa um comando recebido do servidor */
  async executeCommand(command: PendingCommand): Promise<void> {
    console.log(`[CommandService] Executando comando: ${command.type} (${command.commandId})`);

    switch (command.type) {
      case "screenshot":
        await this.handleScreenshot(command.commandId);
        break;

      case "restart":
        await this.handleRestart(command.commandId);
        break;

      case "clear_cache":
        await this.handleClearCache(command.commandId);
        break;

      case "sync_playlist":
        // Notifica sucesso imediatamente; o ciclo normal de sync cuida da atualização
        await this.reportStatus(command.commandId, "done", { message: "Sync agendado" });
        break;

      default:
        await this.reportStatus(command.commandId, "failed", {
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
      formData.append("file", {
        uri: localUri,
        name: `screenshot-${Date.now()}.jpg`,
        type: "image/jpeg",
      } as any);

      await deviceApi.uploadScreenshot(formData);

      // 4. Limpar arquivo temporário
      await FileSystem.deleteAsync(localUri, { idempotent: true });
    } catch (error: any) {
      console.error("[CommandService] Erro no screenshot:", error);
      await this.reportStatus(commandId, "failed", {
        error: error?.message ?? "Erro desconhecido ao capturar tela",
      });
    }
  }

  private async handleRestart(commandId: string): Promise<void> {
    try {
      // Reporta sucesso ANTES de reiniciar (após o restart não tem mais como reportar)
      await this.reportStatus(commandId, "done", { message: "Reiniciando app..." });

      // Aguarda um instante para a requisição sair
      await new Promise((r) => setTimeout(r, 1500));

      // Recarrega o bundle JS (expo-updates)
      await Updates.reloadAsync();
    } catch (error: any) {
      console.error("[CommandService] Erro no restart:", error);
      // Se reloadAsync falhar (ex: dev mode) apenas reporta
      await this.reportStatus(commandId, "failed", {
        error: error?.message ?? "Falha ao reiniciar",
      });
    }
  }

  private async handleClearCache(commandId: string): Promise<void> {
    try {
      const { usePlaylistStore } = await import("../store/playlistStore");
      await usePlaylistStore.getState().clearCache();
      await this.reportStatus(commandId, "done", { message: "Cache limpo com sucesso" });
    } catch (error: any) {
      await this.reportStatus(commandId, "failed", {
        error: error?.message ?? "Falha ao limpar cache",
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
      await deviceApi.reportCommandStatus({ commandId, status, result });
    } catch (error) {
      console.error("[CommandService] Falha ao reportar status do comando:", error);
    }
  }
}
