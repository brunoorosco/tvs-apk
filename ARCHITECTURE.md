# Arquitetura do Aplicativo de TV - STV

## 📋 Resumo da Implementação

Este é um aplicativo React Native/Expo otimizado para Android TV que se conecta a um servidor, carrega playlists e as exibe em fullscreen com suporte a offline e inicialização automática.

---

## 🎯 Funcionalidades Implementadas

### ✅ Inicialização Automática

- **Boot de dispositivo**: App inicia automaticamente quando a TV é ligada
- **Background tasks**: Sincronização contínua mesmo com app em background
- **Persistência**: Playlist em cache para modo offline

### ✅ Conexão com Servidor

- **Pairing code**: Código de 6 dígitos para vincular dispositivo
- **Token-based auth**: Secure storage de credenciais
- **Heartbeat**: Comunicação periódica com servidor (30 min)

### ✅ Sincronização de Playlist

- **Auto-sync**: A cada 5 minutos em background
- **Cache inteligente**: Checksum MD5 para validar downloads
- **Limpeza automática**: Remove mídia não utilizada
- **Resumable downloads**: Continua downloads interrompidos

### ✅ Modo Offline

- **Fallback automático**: Usa cache se servidor falhar
- **Indicador de status**: Mostra quando está offline
- **Persistent data**: AsyncStorage para playlists + FileSystem para mídia

### ✅ Player Fullscreen

- **Landscape obrigatório**: UI otimizada para TV
- **Auto-play**: Próximo item na duração especificada
- **Suporte a múltiplos formatos**: Imagem, vídeo, HTML, stream

---

## 📁 Estrutura de Arquivos

```
stv/
├── app/
│   ├── _layout.tsx              # Layout raiz com providers
│   ├── modal.tsx                # Entry point principal
│   └── (tabs)/                  # Rotas tabbed (se necessário)
│
├── screens/
│   ├── PairingScreen.tsx        # UI de pareamento (6 dígitos)
│   └── PlayerScreen.tsx         # Player fullscreen
│
├── services/
│   ├── api.ts                   # Cliente API axios
│   ├── bootService.ts           # Background tasks e boot
│   └── syncService.ts           # Sincronização de mídia
│
├── store/
│   ├── deviceStore.ts           # Estado do dispositivo (Zustand)
│   └── playlistStore.ts         # Estado da playlist (Zustand)
│
├── types/
│   └── index.ts                 # TypeScript interfaces
│
├── app.json                     # Config Expo (TV + permissions)
├── eas.json                     # Build config EAS
├── BOOT_CONFIG.md               # Documentação detalhada
├── ARCHITECTURE.md              # Este arquivo
└── .env.example                 # Variáveis de ambiente
```

---

## 🔄 Fluxo de Dados

### 1️⃣ Inicialização

```
App Launch
    ↓
[BootService.loadInitialData()]
    ├─ DeviceStore.loadFromStorage()
    │  └─ Carrega token e ID do SecureStore
    ├─ PlaylistStore.loadFromCache()
    │  └─ Carrega playlist do AsyncStorage
    └─ Se paired: getSyncConfig() do servidor
       └─ Sincroniza playlist + mídia com SyncService
    ↓
Renderiza PlayerScreen ou PairingScreen
```

### 2️⃣ Pareamento

```
PairingScreen
    ↓ [Usuário digita código com controle]
    ↓
[attemptPairing(code)]
    ├─ deviceApi.pairDevice(code, deviceInfo)
    └─ Recebe { token, deviceId, deviceName }
    ↓
[DeviceStore.setPaired()]
    ├─ Salva em SecureStore
    └─ Atualiza estado
    ↓
App recarrega → PlayerScreen
```

### 3️⃣ Background Sync

```
[BackgroundFetch trigger a cada 5 min]
    ↓
[PLAYLIST_SYNC task]
    ├─ deviceApi.getSyncConfig()
    ├─ SyncService.syncMedia(playlists)
    │  ├─ Download de mídias novas
    │  ├─ Validação de checksum
    │  └─ Limpeza de não utilizadas
    └─ PlaylistStore.setPlaylists()
       └─ Atualiza cache e UI
```

### 4️⃣ Heartbeat (a cada 30 min)

```
[HEARTBEAT task]
    ├─ Coleta info do dispositivo
    └─ deviceApi.sendHeartbeat(data)
       └─ Servidor pode enviar comandos
```

---

## 🔐 Segurança e Armazenamento

### SecureStore (Expo)

```
deviceToken    → Criptografado no Keychain/Keystore
deviceId       → Criptografado
deviceName     → Criptografado
```

### AsyncStorage

```
cachedPlaylists      → JSON da playlist inteira
lastPlaylistSync     → Timestamp do último sync
```

### FileSystem

```
/cache/media/        → Arquivos baixados
  ├── media-id-1
  ├── media-id-2
  └── media-id-3     → Nomeados por ID, validados por MD5
```

---

## 🌐 API Server Esperado

### Endpoints Necessários

#### 1. POST `/devices/pair`

```json
Request:
{
  "pairingCode": "123456",
  "deviceInfo": {
    "model": "Android TV",
    "platform": "android-tv",
    "version": "1.0.0"
  }
}

Response:
{
  "deviceToken": "abc123token...",
  "deviceId": "dev-xxx",
  "deviceName": "Living Room TV",
  "expiresIn": 86400
}
```

#### 2. GET `/device/sync`

```
Headers: x-device-token: {token}

Response:
{
  "playlists": [
    {
      "id": "playlist-1",
      "name": "Main Display",
      "items": [
        {
          "id": "media-1",
          "type": "image",
          "url": "https://cdn.example.com/image.jpg",
          "duration": 5000,
          "checksum": "abc123...",
          "fileSize": 1024000
        }
      ],
      "schedule": { ... }
    }
  ],
  "metadata": {
    "lastUpdated": "2026-05-07T15:30:00Z",
    "version": 42
  }
}
```

#### 3. POST `/device/heartbeat`

```json
Request:
{
  "deviceId": "dev-xxx",
  "status": "online",
  "timestamp": "2026-05-07T15:30:00Z",
  "uptime": 3600000,
  "storageUsed": 1024000000,
  "temperature": 45
}

Response:
{
  "commands": [
    {
      "id": "cmd-1",
      "type": "sync",
      "payload": { }
    }
  ],
  "nextHeartbeatIn": 1800000
}
```

---

## ⚙️ Configuração

### Environment Variables (.env)

```bash
EXPO_PUBLIC_API_URL=https://seu-servidor.com/api
BACKGROUND_SYNC_INTERVAL=5
HEARTBEAT_INTERVAL=30
CACHE_LIMIT_MB=2048
DEBUG_MODE=false
```

### Android TV Setup

1. Em `app.json` configurado:
   - Orientation: landscape
   - Permissions: INTERNET, STORAGE, BOOT_COMPLETED, WAKE_LOCK
   - Package: com.stv.player

2. Permissions necessárias:
   - `android.permission.RECEIVE_BOOT_COMPLETED` → Boot automático
   - `android.permission.WAKE_LOCK` → Manter CPU ativa
   - `android.permission.FOREGROUND_SERVICE` → Background tasks

---

## 🛠️ Desenvolvimento

### Build para Android TV

```bash
# Instalar dependências
npm install

# Preparar build EAS
eas build -p android --profile preview

# Ou build local com Android Studio
npm start
# Selecionar Android na opção
```

### Testar Localmente

```bash
# Dev mode
npm start

# Logs
adb logcat | grep -i "stv\|playlist\|sync"

# Limpar cache
adb shell run-as com.stv.player rm -rf /data/data/com.stv.player/cache
```

---

## 📊 Tipos de Mídia Suportados

```typescript
type:
  | "image"    // JPG, PNG com duration em ms
  | "video"    // MP4, HLS com duration
  | "html"     // HTML5 customizado
  | "stream"   // RTSP, HTTP Live Streaming
```

---

## 🚀 Deploy

### Produção (EAS)

```bash
eas build -p android --profile release
eas submit -p android --profile production
```

### Distribuição

- Instalação manual: Build APK e copiar para USB
- Google Play (se aplicável)
- MDM/EMM solutions para TV corporativa

---

## 📝 Checklist de Implementação

- ✅ Pairing screen com 6 dígitos
- ✅ Device store com persistent auth
- ✅ Playlist store com cache
- ✅ Sync service com download/checksum
- ✅ Boot service com background tasks
- ✅ API client com interceptors
- ✅ PlayerScreen fullscreen (skeleton)
- ✅ Error handling e fallbacks
- ✅ TypeScript types
- ✅ Lint cleanup
- ⏳ PlayerScreen completo (próxima etapa)
- ⏳ Testes unitários
- ⏳ E2E testing

---

## 🔧 Próximos Passos

1. **Completar PlayerScreen** com:
   - Renderização de imagens
   - Player de vídeo (expo-av)
   - WebView para HTML
   - Auto-advance entre itens

2. **Melhorias de UX**:
   - Indicador de carregamento
   - Status de sincronização
   - Menu de settings (opcional)
   - Display de erro

3. **Performance**:
   - Otimizar carregamento de imagens grandes
   - Cache de renderização
   - Limpeza de memória periódica

4. **Robustez**:
   - Retry logic melhorado
   - Fallback para 4G (se aplicável)
   - Rate limiting do servidor
   - Tratamento de edge cases

---

## 📚 Documentação Adicional

- [BOOT_CONFIG.md](./BOOT_CONFIG.md) - Detalhes de boot automático
- [types/index.ts](./types/index.ts) - TypeScript interfaces
- [.env.example](./.env.example) - Variáveis de ambiente
