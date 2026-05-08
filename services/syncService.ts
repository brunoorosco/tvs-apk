import * as FileSystem from "expo-file-system";
import { usePlaylistStore } from "../store/playlistStore";

const MEDIA_DIR = `${FileSystem.cacheDirectory}media/`;

export class SyncService {
  async ensureMediaDir() {
    try {
      const dirInfo = await FileSystem.getInfoAsync(MEDIA_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(MEDIA_DIR, { intermediates: true });
      }
    } catch (error) {
      console.error("Erro ao criar diretório de mídia:", error);
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

    // 1. Limpar mídias não utilizadas (limpeza em background)
    this.cleanupUnused(usedIds).catch(console.error);

    // 2. Baixar novas mídias e verificar existência
    const downloadPromises = allMedia.map(async (media) => {
      const isDownloaded = await this.downloadMedia(media);
      return { id: media.id, isDownloaded };
    });

    const results = await Promise.all(downloadPromises);
    const downloadedMap = new Map(results.map(r => [r.id, r.isDownloaded]));

    // 3. Atualizar store - Somente define localPath se o arquivo existir
    const updatedPlaylists = playlists.map((playlist) => ({
      ...playlist,
      items: playlist.items.map((item: any) => {
        const isDownloaded = downloadedMap.get(item.id);
        return {
          ...item,
          // Só usa path local se o download deu certo
          localPath: isDownloaded ? `${MEDIA_DIR}${item.id}` : undefined,
        };
      }),
    }));

    usePlaylistStore.getState().setPlaylists(updatedPlaylists);
  }

  private async downloadMedia(media: any): Promise<boolean> {
    if (!media.id || !media.url) return false;

    const localPath = `${MEDIA_DIR}${media.id}`;

    try {
      const fileInfo = await FileSystem.getInfoAsync(localPath);

      // Se já existe e tem tamanho, assumimos que está ok (evitar processamento pesado de MD5 em TV)
      if (fileInfo.exists && fileInfo.size && fileInfo.size > 0) {
        return true;
      }

      const downloadResumable = FileSystem.createDownloadResumable(
        media.url,
        localPath,
        {
          copyToCacheDirectory: false
        }
      );

      const result = await downloadResumable.downloadAsync();
      return !!(result && result.status === 200);
    } catch (error) {
      console.error(`Erro ao baixar ${media.id}:`, error);
      return false;
    }
  }

  private async cleanupUnused(usedIds: Set<string>) {
    try {
      const dirInfo = await FileSystem.getInfoAsync(MEDIA_DIR);
      if (!dirInfo.exists) return;

      const files = await FileSystem.readDirectoryAsync(MEDIA_DIR);
      for (const file of files) {
        if (!usedIds.has(file)) {
          await FileSystem.deleteAsync(`${MEDIA_DIR}${file}`, { idempotent: true });
        }
      }
    } catch (error) {
      console.error("Erro no cleanup:", error);
    }
  }

  async getStorageStats() {
    try {
      const dirInfo = await FileSystem.getInfoAsync(MEDIA_DIR);
      if (!dirInfo.exists) return { used: 0, total: 2 * 1024 * 1024 * 1024 };

      const files = await FileSystem.readDirectoryAsync(MEDIA_DIR);
      let totalSize = 0;
      for (const file of files) {
        const info = await FileSystem.getInfoAsync(`${MEDIA_DIR}${file}`);
        totalSize += info.size || 0;
      }
      return { used: totalSize, total: 2 * 1024 * 1024 * 1024 };
    } catch (error) {
      return { used: 0, total: 2 * 1024 * 1024 * 1024 };
    }
  }
}
