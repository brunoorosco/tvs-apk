import PusherModule from "pusher-js";
import React from "react";
import { useDeviceStore } from "../store/deviceStore";
import { CommandService, PendingCommand } from "./commandService";

const PusherClient: any =
  typeof PusherModule === "function"
    ? PusherModule
    : (PusherModule as any).default ?? (PusherModule as any).Pusher ?? PusherModule;

// Trim evita erros se env var tiver espaço acidental
const PUSHER_KEY = (process.env.EXPO_PUBLIC_PUSHER_KEY || "").trim();
const PUSHER_CLUSTER = (process.env.EXPO_PUBLIC_PUSHER_CLUSTER || "us2").trim();
const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api").replace(/\/+$/, "");
const API_TOKEN = (process.env.EXPO_PUBLIC_API_TOKEN || "").trim();

class PusherService {
  private pusher: any = null;
  private channel: any = null;

  private playerRef: React.RefObject<any> | null = null;
  private onRefresh?: () => Promise<void>;

  setPlayerRef(ref: React.RefObject<any>) {
    this.playerRef = ref;
  }

  setOnRefresh(callback: () => Promise<void>) {
    this.onRefresh = callback;
  }

  private get commandService(): CommandService {
    const svc = new CommandService();
    if (this.playerRef) svc.setPlayerRef(this.playerRef);
    if (this.onRefresh) svc.setOnRefresh(this.onRefresh);
    return svc;
  }

  connect() {
    if (this.pusher) return; // já conectado

    const { deviceUid, deviceToken } = useDeviceStore.getState();

    if (!deviceUid) {
      console.log("[Pusher] Sem deviceUid — aguardando pareamento.");
      return;
    }

    if (!PUSHER_KEY) {
      console.warn("[Pusher] EXPO_PUBLIC_PUSHER_KEY não definida. Real-time desativado.");
      return;
    }

    console.log(`[Pusher] Conectando para device: ${deviceUid}`);

    try {
      this.pusher = new PusherClient(PUSHER_KEY, {
        cluster: PUSHER_CLUSTER,
        // customHandler é necessário no React Native (sem XMLHttpRequest nativo do browser)
        channelAuthorization: {
          transport: "ajax",
          endpoint: `${API_URL}/pusher/auth`,
          customHandler: async ({ channelName, socketId }, callback) => {
            try {
              const resp = await fetch(`${API_URL}/pusher/auth`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                  "x-device-uid": deviceToken || deviceUid || "",
                  "x-api-token": API_TOKEN,
                },
                body: `socket_id=${encodeURIComponent(socketId)}&channel_name=${encodeURIComponent(channelName)}`,
              });
              const authData = await resp.json();
              callback(null, authData);
            } catch (err: any) {
              callback(new Error(err?.message ?? "Auth error"), null);
            }
          },
        },
      });

      this.pusher.connection.bind("connected", () => {
        console.log("[Pusher] ✅ Conectado!");
      });

      this.pusher.connection.bind("error", (err: any) => {
        if (__DEV__) console.warn("[Pusher] Erro de conexão:", err);
      });

      // Inscreve no canal privado deste device
      this.channel = this.pusher.subscribe(`private-device-${deviceUid}`);

      // Recebe qualquer comando enviado pelo dashboard
      this.channel.bind("command", async (data: PendingCommand) => {
        console.log(`[Pusher] ⚡ Comando recebido em tempo real: ${data.type}`);
        const svc = this.commandService;
        await svc.executeCommand(data);
      });

      this.channel.bind("pusher:subscription_error", (err: any) => {
        console.error("[Pusher] Erro ao assinar canal:", err);
      });
    } catch (e) {
      console.error("[Pusher] Erro de inicialização:", e);
    }
  }

  disconnect() {
    if (this.channel) {
      this.channel.unbind_all();
      this.channel.unsubscribe();
      this.channel = null;
    }
    if (this.pusher) {
      this.pusher.disconnect();
      this.pusher = null;
    }
    console.log("[Pusher] Desconectado.");
  }

  get isConnected() {
    return this.pusher?.connection.state === "connected";
  }
}

// Singleton
export const socketService = new PusherService();
