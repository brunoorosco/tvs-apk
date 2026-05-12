import Constants from "expo-constants";
import React, { useEffect, useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
} from "react-native";
import { useDeviceStore } from "../store/deviceStore";

interface RescueMenuProps {
  onFinish: () => void;
}

export const RescueMenu: React.FC<RescueMenuProps> = ({ onFinish }) => {
  const [countdown, setCountdown] = useState(30);
  const { deviceUid, deviceName, deviceId, clearPairing, isPaired } = useDeviceStore();
  const [isUnpairing, setIsUnpairing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onFinish]);

  const handleUnpair = async () => {
    setIsUnpairing(true);
    try {
      await clearPairing();
      onFinish();
    } catch (error) {
      console.error("Erro ao desvincular:", error);
      setIsUnpairing(false);
    }
  };

  return (
    <Modal transparent animationType="fade" visible={true}>
      <View style={styles.overlay}>
        <View style={styles.menu}>
          <Text style={styles.title}>Painel de Inicialização</Text>
          <Text style={styles.subtitle}>O player iniciará automaticamente em {countdown}s</Text>
          
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <Text style={styles.label}>UID do Dispositivo:</Text>
              <Text style={styles.value}>{deviceUid || "Não disponível"}</Text>
            </View>
            
            {isPaired && (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Nome no Painel:</Text>
                  <Text style={styles.value}>{deviceName}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>ID Interno:</Text>
                  <Text style={styles.value}>{deviceId}</Text>
                </View>
              </>
            )}
            
            <View style={styles.infoRow}>
              <Text style={styles.label}>Versão do App:</Text>
              <Text style={styles.value}>{Constants.expoConfig?.version || "1.0.0"}</Text>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableHighlight
              style={[styles.button, styles.unpairButton]}
              onPress={handleUnpair}
              underlayColor="#dc2626"
              disabled={isUnpairing}
            >
              <Text style={styles.buttonText}>
                {isUnpairing ? "Desvinculando..." : "Desvincular Dispositivo"}
              </Text>
            </TouchableHighlight>
            
            <TouchableHighlight
              style={[styles.button, styles.continueButton]}
              onPress={onFinish}
              underlayColor="#2563eb"
              hasTVPreferredFocus={true}
            >
              <Text style={styles.buttonText}>Continuar Agora</Text>
            </TouchableHighlight>
          </View>

          <Text style={styles.footerNote}>
            Use esta tela caso precise trocar de conta ou verificar informações técnicas.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  menu: {
    width: "70%",
    backgroundColor: "#111",
    borderRadius: 24,
    padding: 40,
    borderWidth: 1,
    borderColor: "#333",
    alignItems: "center",
  },
  title: {
    fontSize: 42,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 20,
    color: "#888",
    marginBottom: 40,
  },
  infoContainer: {
    width: "100%",
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 24,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: "#222",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
    paddingBottom: 8,
  },
  label: {
    fontSize: 18,
    color: "#aaa",
    fontWeight: "500",
  },
  value: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "600",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 30,
  },
  button: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  unpairButton: {
    backgroundColor: "#991b1b",
  },
  continueButton: {
    backgroundColor: "#1e40af",
  },
  buttonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  footerNote: {
    color: "#555",
    fontSize: 16,
    textAlign: "center",
  },
});
