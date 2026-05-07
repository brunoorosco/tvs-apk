import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

const TOKEN_KEY = "deviceToken";
const DEVICE_ID_KEY = "deviceId";
const DEVICE_NAME_KEY = "deviceName";

interface DeviceState {
  isPaired: boolean;
  deviceToken: string | null;
  deviceId: string | null;
  deviceUid: string | null;
  deviceName: string | null;
  pairingCode: string;
  autoStartEnabled: boolean;
  setPairingCode: (code: string) => void;
  setPaired: (token: string, deviceId: string, deviceName: string) => void;
  clearPairing: () => void;
  loadFromStorage: () => Promise<void>;
  setAutoStart: (enabled: boolean) => Promise<void>;
  getOrGenerateUid: () => Promise<string>;
}

const DEVICE_UID_KEY = "deviceUid";

export const useDeviceStore = create<DeviceState>((set, get) => ({
  isPaired: false,
  deviceToken: null,
  deviceId: null,
  deviceUid: null,
  deviceName: null,
  pairingCode: "",
  autoStartEnabled: true,

  setPairingCode: (code) => set({ pairingCode: code }),

  setPaired: async (token, deviceId, deviceName) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
    await SecureStore.setItemAsync(DEVICE_NAME_KEY, deviceName);
    set({ isPaired: true, deviceToken: token, deviceId, deviceName });
  },

  clearPairing: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(DEVICE_ID_KEY);
    await SecureStore.deleteItemAsync(DEVICE_NAME_KEY);
    set({
      isPaired: false,
      deviceToken: null,
      deviceId: null,
      deviceName: null,
    });
  },

  loadFromStorage: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
      const deviceName = await SecureStore.getItemAsync(DEVICE_NAME_KEY);
      const deviceUid = await SecureStore.getItemAsync(DEVICE_UID_KEY);
      
      set({ deviceUid });

      if (token && deviceId) {
        set({ isPaired: true, deviceToken: token, deviceId, deviceName });
      }
    } catch (error) {
      console.error("Erro ao carregar dados do device:", error);
    }
  },

  setAutoStart: async (enabled) => {
    set({ autoStartEnabled: enabled });
  },

  getOrGenerateUid: async () => {
    const existingUid = get().deviceUid;
    if (existingUid) return existingUid;

    const storedUid = await SecureStore.getItemAsync(DEVICE_UID_KEY);
    if (storedUid) {
      set({ deviceUid: storedUid });
      return storedUid;
    }

    // Gerar novo UID (usando um gerador simples se crypto.randomUUID não estiver disponível)
    const newUid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });

    await SecureStore.setItemAsync(DEVICE_UID_KEY, newUid);
    set({ deviceUid: newUid });
    return newUid;
  },
}));
