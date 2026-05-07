import axios from "axios";

// Configure com a URL do seu servidor
const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://seu-dominio.com/api";

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

// Interceptor para logs em desenvolvimento
if (__DEV__) {
  api.interceptors.request.use((config) => {
    console.log(
      `%c 🚀 Request: ${config.method?.toUpperCase()} ${config.url}`,
      "color: #0080ff; font-weight: bold;",
      config.data || ""
    );
    return config;
  });

  api.interceptors.response.use(
    (response) => {
      console.log(
        `%c ✅ Response: ${response.status} ${response.config.url}`,
        "color: #00ff00; font-weight: bold;",
        response.data
      );
      return response;
    },
    (error) => {
      console.log(
        `%c ❌ API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
        "color: #ff0000; font-weight: bold;",
        error.response?.data || error.message
      );
      return Promise.reject(error);
    }
  );
}

// Interceptor para adicionar device token
api.interceptors.request.use(async (config) => {
  const { useDeviceStore } = await import("../store/deviceStore");
  const token = useDeviceStore.getState().deviceToken;
  if (token) {
    config.headers["x-device-token"] = token;
  }
  return config;
});

// Interceptor de erro global (mantido para compatibilidade ou logs extras)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!__DEV__) {
      console.error("API Error:", error.response?.status, error.message);
    }
    throw error;
  },
);

export const deviceApi = {
  /**
   * Registrar um código de pareamento gerado localmente pelo dispositivo
   */
  registerPairingCode: (pairingCode: string, deviceInfo: any) =>
    api.post("/devices/pairing-register", { pairingCode, deviceInfo }),

  /**
   * Verificar se o código gerado foi pareado no dashboard
   */
  checkPairingStatus: (pairingCode: string) =>
    api.get(`/devices/pairing-status/${pairingCode}`),

  /**
   * Enviar heartbeat do dispositivo
   */
  sendHeartbeat: (data: any) => api.post("/device/heartbeat", data),

  /**
   * Desparear dispositivo
   */
  unpairDevice: () => api.post("/device/unpair", {}),

  /**
   * Obter informações de armazenamento
   */
  getStorageInfo: () => api.get("/device/storage"),

  /**
   * Reportar erro ao servidor
   */
  reportError: (error: any) =>
    api.post("/device/error", {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    }),
};

export default api;
