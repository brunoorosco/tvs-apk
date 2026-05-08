import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import PairingScreen from "../screens/PairingScreen";
import PlayerScreen from "../screens/PlayerScreen";
import { BootService } from "../services/bootService";
import { useDeviceStore } from "../store/deviceStore";
import { usePlaylistStore } from "../store/playlistStore";

export default function Index() {
  const { isPaired } = useDeviceStore();
  const { isLoading } = usePlaylistStore();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // 1. Inicializar background tasks
        await BootService.initializeBackgroundTasks();

        // 2. Carregar dados iniciais (device + playlists)
        await BootService.loadInitialData();
      } catch (error) {
        console.error("Erro ao inicializar app:", error);
      }
    };

    initializeApp();

    return () => {
      // Cleanup opcional se necessário no futuro
    };
  }, []);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar hidden />
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      {!isPaired ? <PairingScreen /> : <PlayerScreen />}
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
});
