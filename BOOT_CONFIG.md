# Configuração de Boot Automático para Android TV

## Visão Geral

Este aplicativo está configurado para:

1. ✅ Iniciar automaticamente no boot do dispositivo
2. ✅ Rodar em foreground/background contínuo
3. ✅ Carregar playlist do cache automaticamente
4. ✅ Sincronizar com servidor periodicamente
5. ✅ Persistir dados offline

## Estrutura de Funcionamento

### 1. **Inicialização ao Boot**

- Android detecta `RECEIVE_BOOT_COMPLETED` permission
- BootService registra background tasks
- Playlist é carregada do cache automaticamente

### 2. **Armazenamento**

- **Secure Store**: Token de dispositivo e ID (expo-secure-store)
- **AsyncStorage**: Playlists em cache (JSON comprimido)
- **File System**: Mídia (imagens/vídeos) em `/cache/media/`

### 3. **Sincronização**

- Background task a cada 5 minutos
- Sincroniza playlist + mídia com servidor
- Se servidor falhar, usa cache local
- Verifica checksum de mídia antes de re-baixar

### 4. **Heartbeat**

- Envia status do dispositivo a cada 30 minutos
- Servidor pode enviar comandos via heartbeat response

## Fluxo de Dados

```
Boot
  ↓
[BootService.initializeBackgroundTasks()]
  ├─ Registra PLAYLIST_SYNC task
  ├─ Registra HEARTBEAT task
  └─ Define startOnBoot: true
  ↓
[BootService.loadInitialData()]
  ├─ Carrega device token do SecureStore
  ├─ Carrega playlist do AsyncStorage cache
  ├─ Se paired: sincroniza com servidor
  └─ Renderiza PlayerScreen com playlist
  ↓
[Background Sync (a cada 5 min)]
  ├─ Conecta ao servidor
  ├─ Baixa playlist atualizada
  ├─ Sincroniza mídia (download/checksum/cleanup)
  └─ Atualiza cache local
  ↓
[PlayerScreen]
  ├─ Renderiza media atual
  ├─ Auto-play próximo item
  ├─ Listen a mudanças de playlist
  └─ Fullscreen landscape
```

## Permissões Android Configuradas

```json
"permissions": [
  "android.permission.INTERNET",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
  "android.permission.RECEIVE_BOOT_COMPLETED",
  "android.permission.WAKE_LOCK",
  "android.permission.FOREGROUND_SERVICE"
]
```

## API Server Esperada

### 1. Pairing

```
POST /devices/pair
Body: { pairingCode: "123456", deviceInfo: {...} }
Response: { token: "abc123", deviceId: "dev-1" }
```

### 2. Sync Config

```
GET /device/sync
Headers: { x-device-token: "abc123" }
Response: { playlists: [...] }
```

### 3. Heartbeat

```
POST /device/heartbeat
Body: { deviceId: "dev-1", status: "online", timestamp: "..." }
```

## Estrutura de Playlist

```typescript
interface Playlist {
  id: string;
  name: string;
  items: [
    {
      id: string;
      type: "image" | "video" | "html";
      url: string;
      duration?: number; // em ms
      checksum?: string; // MD5 para validação
      fileSize?: number; // bytes
      localPath?: string; // preenchido após sync
    },
  ];
}
```

## Desenvolvimento Local

### Testar Background Tasks (apenas em dispositivo)

```bash
npm install
npm start
# Selecionar Android na opção de menu
# Fazer build e instalar em dispositivo TV
```

### Testar Pairing

1. Copiar código de pareamento do servidor
2. Usar remote para inserir os dígitos na tela de pairing
3. Aguardar carregamento da playlist

### Verificar Logs

```bash
adb logcat | grep -i "stv\|playlist\|sync\|boot"
```

### Limpar Cache (para teste)

```bash
adb shell run-as com.stv.player rm -rf /data/data/com.stv.player/app_webview
adb shell run-as com.stv.player rm -rf /data/data/com.stv.player/cache
```

## Troubleshooting

### App não inicia no boot

- Verificar se `startOnBoot: true` está em BackgroundFetch.registerTaskAsync
- Verificar permissão `RECEIVE_BOOT_COMPLETED` em app.json
- Verificar se app está instalado (não em APK temporário)

### Playlist não sincroniza

- Verificar URL da API em services/api.ts
- Verificar se device está paired (token existe)
- Verificar logs: `adb logcat | grep "PLAYLIST_SYNC"`

### Mídia não carrega

- Verificar espaço em disco (limite de 2GB por padrão)
- Verificar URL de download da mídia
- Limpar cache e refazer sync

### Performance/Lag

- Verificar se hay background tasks consumindo muita CPU
- Limpar cache de mídia não utilizada
- Reduzir intervalo de sync se necessário

## Customização

### Alterar intervalo de sync

Em `services/bootService.ts`:

```typescript
await BackgroundFetch.registerTaskAsync(SYNC_TASK_NAME, {
  minimumInterval: 5 * 60, // Mudar para 10 * 60 por exemplo (10 min)
  stopOnTerminate: false,
  startOnBoot: true,
});
```

### Adicionar novo tipo de mídia

Em `store/playlistStore.ts`, adicionar em `MediaItem.type`:

```typescript
type: "image" | "video" | "html" | "stream" | "carousel";
```

### Aumentar limite de cache

Em `services/syncService.ts`:

```typescript
async getStorageStats() {
  return {
    used: totalSize,
    total: 10 * 1024 * 1024 * 1024  // 10GB ao invés de 2GB
  };
}
```
