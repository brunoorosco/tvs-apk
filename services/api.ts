import axios from "axios";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

// Interceptor para adicionar device token e api token (sempre ativo)
api.interceptors.request.use(async (config) => {
  const { useDeviceStore } = await import("../store/deviceStore");
  const token = useDeviceStore.getState().deviceToken;

  if (token) {
    config.headers["x-device-token"] = token;
  }

  const apiToken = process.env.EXPO_PUBLIC_API_TOKEN;
  if (apiToken) {
    config.headers["x-api-token"] = apiToken;
  }

  if (__DEV__) {
    console.log("token", apiToken);
  }

  return config;
});

// Interceptors de log e erro — somente em desenvolvimento
if (__DEV__) {
  api.interceptors.request.use((config) => {
    const baseUrl = config.baseURL?.endsWith("/")
      ? config.baseURL.slice(0, -1)
      : config.baseURL;
    const url = config.url?.startsWith("/") ? config.url : `/${config.url}`;
    const fullUrl = config.url?.startsWith("http") ? config.url : `${baseUrl}${url}`;
    console.log(
      `%c 🚀 Request: ${config.method?.toUpperCase()} ${fullUrl}`,
      "color: #0080ff; font-weight: bold;",
      {
        data: config.data,
        headers: config.headers,
      }
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
      const baseUrl = error.config?.baseURL?.endsWith("/")
        ? error.config.baseURL.slice(0, -1)
        : error.config?.baseURL;
      const url = error.config?.url?.startsWith("/")
        ? error.config.url
        : `/${error.config?.url}`;
      const fullUrl = error.config?.url?.startsWith("http")
        ? error.config.url
        : `${baseUrl}${url}`;

      console.log(
        `%c ❌ API Error: ${error.config?.method?.toUpperCase()} ${fullUrl}`,
        "color: #ff0000; font-weight: bold;",
        error.response?.data || error.message
      );
      return Promise.reject(error);
    }
  );
}

// Interceptor de erro global para produção
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!__DEV__) {
      console.error("API Error:", error.response?.status, error.message);
    }
    throw error;
  }
);

export const deviceApi = {
  registerPairingCode: (pairingCode: string, deviceInfo: any) =>
    api.post("/devices/pairing-register", { pairingCode, deviceInfo }),

  checkPairingStatus: (pairingCode: string) =>
    api.get(`/devices/pairing-status/${pairingCode}`),

  sendHeartbeat: (data: any) => api.post("/devices/heartbeat", data),

  unpairDevice: () => api.post("/devices/unpair", {}),

  getStorageInfo: () => api.get("/devices/storage"),

  getSyncConfig: () => api.get("/devices/sync-config"),

  reportError: (error: any) =>
    api.post("/devices/error", {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    }),
};

export default api;