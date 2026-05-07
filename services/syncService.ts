import CryptoJS from "crypto-js";
import * as FileSystem from "expo-file-system";
import { usePlaylistStore } from "../store/playlistStore";

const MEDIA_DIR = `${FileSystem.cacheDirectory}media/`;

export class SyncService {
  async ensureMediaDir() {
    const dirInfo = await FileSystem.getInfoAsync(MEDIA_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(MEDIA_DIR, { intermediates: true });
    }
  }

  async syncMedia(playlists: any[]) {
    if (!playlists || !Array.isArray(playlists)) {
      console.warn("Nenhuma playlist recebida para sincronização.");
      return;
    }

    await this.ensureMediaDir();

    const allMedia = playlists.flatMap((p) => p.items || []);
    const usedIds = new Set(allMedia.map((m: any) => m.id).filter(Boolean));

    // Limpar mídias não utilizadas
    await this.cleanupUnused(usedIds);

    // Baixar novas mídias
    for (const media of allMedia) {
      await this.downloadMedia(media);
    }

    // Atualizar store com paths locais
    const updatedPlaylists = playlists.map((playlist) => ({
      ...playlist,
      items: playlist.items.map((item: any) => ({
        ...item,
        localPath: `${MEDIA_DIR}${item.id}`,
      })),
    }));

    usePlaylistStore.getState().setPlaylists(updatedPlaylists);
  }

  private async downloadMedia(media: any) {
    const localPath = `${MEDIA_DIR}${media.id}`;
    const fileInfo = await FileSystem.getInfoAsync(localPath);

    // Verificar se já existe e checksum bate
    if (fileInfo.exists && media.checksum) {
      const content = await FileSystem.readAsStringAsync(localPath, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const hash = CryptoJS.MD5(content).toString();
      if (hash === media.checksum) return;
    }

    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        media.url,
        localPath,
      );
      await downloadResumable.downloadAsync();
    } catch (error) {
      console.error(`Erro ao baixar ${media.id}:`, error);
    }
  }

  private async cleanupUnused(usedIds: Set<string>) {
    const files = await FileSystem.readDirectoryAsync(MEDIA_DIR);
    for (const file of files) {
      if (!usedIds.has(file)) {
        await FileSystem.deleteAsync(`${MEDIA_DIR}${file}`);
      }
    }
  }

  async getStorageStats() {
    const files = await FileSystem.readDirectoryAsync(MEDIA_DIR);
    let totalSize = 0;
    for (const file of files) {
      const info = await FileSystem.getInfoAsync(`${MEDIA_DIR}${file}`);
      totalSize += info.size || 0;
    }
    return { used: totalSize, total: 2 * 1024 * 1024 * 1024 }; // 2GB limite
  }
}
