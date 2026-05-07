import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

const TOKEN_KEY = "deviceToken";
const DEVICE_ID_KEY = "deviceId";
const DEVICE_NAME_KEY = "deviceName";

interface DeviceState {
  isPaired: boolean;
  deviceToken: string | null;
  deviceId: string | null;
  deviceName: string | null;
  pairingCode: string;
  autoStartEnabled: boolean;
  setPairingCode: (code: string) => void;
  setPaired: (token: string, deviceId: string, deviceName: string) => void;
  clearPairing: () => void;
  loadFromStorage: () => Promise<void>;
  setAutoStart: (enabled: boolean) => Promise<void>;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  isPaired: false,
  deviceToken: null,
  deviceId: null,
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
}));
