import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { deviceApi } from "../services/api";
import { useDeviceStore } from "../store/deviceStore";

const { width } = Dimensions.get("window");

export default function PairingScreen() {
  const [pairingCode, setPairingCode] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const { setPaired } = useDeviceStore();
  const pollingInterval = useRef<NodeJS.Timeout>();

  useEffect(() => {
    startPairingProcess();
    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
  }, []);

  const startPairingProcess = async () => {
    setIsLoading(true);
    setError("");

    // Gerar código de 6 dígitos localmente
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    setPairingCode(newCode);

    try {
      const { getOrGenerateUid } = useDeviceStore.getState();
      const deviceUid = await getOrGenerateUid();

      const deviceInfo = {
        deviceUid: deviceUid,
        model: "TV-Simulator", // Conforme exemplo
      };

      // Registrar o código gerado no servidor
      await deviceApi.registerPairingCode(newCode, deviceInfo);
      setIsLoading(false);

      // Começar o polling para verificar a ativação
      startPolling(newCode);
    } catch (err: any) {
      console.error("Erro ao registrar código:", err);
      setError("Erro ao registrar no servidor. Tentando novamente em 10s...");
      setTimeout(startPairingProcess, 600000);
    }
  };

  const startPolling = (code: string) => {
    if (pollingInterval.current) clearInterval(pollingInterval.current);

    pollingInterval.current = setInterval(async () => {
      try {
        const { data } = await deviceApi.checkPairingStatus(code);

        // O backend retorna { paired: true, deviceUid: "..." }
        if (data.paired === true) {
          console.log("🎯 Pareamento detectado com sucesso!");
          if (pollingInterval.current) clearInterval(pollingInterval.current);

          const deviceId = data.deviceUid;
          const deviceName = data.deviceName || `TV-${deviceId.slice(0, 8)}`;
          
          // Se o backend não retornar um token específico, usamos o deviceUid
          const token = data.deviceToken || deviceId;
          
          console.log("💾 Salvando dados do dispositivo...", { deviceId, token });
          try {
            await setPaired(token, deviceId, deviceName);
            console.log("✅ Dados salvos! A tela deve mudar agora.");
          } catch (saveError) {
            console.error("❌ Erro ao salvar dados do pareamento:", saveError);
          }
        }
      } catch (err) {
        // Durante o polling, erros (como 404) são normais enquanto não pareado
        console.log("Aguardando pareamento no painel...");
      }
    }, 5000); // Verifica a cada 5 segundos
  };

  if (isLoading && !pairingCode) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Conectando ao sistema...</Text>
        {error ? <Text style={styles.errorSmall}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>STV TV</Text>
        <Text style={styles.subtitle}>
          Ative este dispositivo no seu painel administrativo
        </Text>

        <Text style={styles.instruction}>
          Acesse <Text style={styles.highlight}>painel.stv.com.br</Text> e
          insira o código:
        </Text>

        <View style={styles.codeContainer}>
          {pairingCode.split("").map((digit, index) => (
            <View key={index} style={styles.digitBox}>
              <Text style={styles.digitText}>{digit}</Text>
            </View>
          ))}
        </View>

        <View style={styles.statusContainer}>
          <ActivityIndicator
            size="small"
            color="#4ade80"
            style={{ marginRight: 10 }}
          />
          <Text style={styles.statusText}>Aguardando ativação...</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Versão 1.0.0 • ID: {pairingCode ? "Aguardando..." : "Buscando..."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "80%",
    backgroundColor: "#111",
    borderRadius: 24,
    padding: 60,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#222",
  },
  title: {
    fontSize: 56,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 22,
    color: "#888",
    marginBottom: 40,
  },
  instruction: {
    fontSize: 24,
    color: "#ccc",
    marginBottom: 30,
    textAlign: "center",
  },
  highlight: {
    color: "#2563eb",
    fontWeight: "bold",
  },
  codeContainer: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 50,
  },
  digitBox: {
    width: 80,
    height: 100,
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  digitText: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#fff",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(74, 222, 128, 0.1)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
  },
  statusText: {
    color: "#4ade80",
    fontSize: 18,
    fontWeight: "500",
  },
  loadingText: {
    color: "#fff",
    fontSize: 20,
    marginTop: 20,
  },
  error: {
    color: "#ef4444",
    fontSize: 18,
    marginTop: 20,
    textAlign: "center",
  },
  errorSmall: {
    color: "#666",
    fontSize: 14,
    marginTop: 10,
  },
  footer: {
    position: "absolute",
    bottom: 40,
  },
  footerText: {
    color: "#444",
    fontSize: 14,
  },
});
