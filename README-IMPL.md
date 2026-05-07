# STV - STV TV Player

Um aplicativo React Native/Expo otimizado para Android TV que gerencia playlists de mídia, sincroniza com um servidor e oferece suporte a offline com inicialização automática no boot.

## 🚀 Começar Rapidamente

### 1. Instalação

```bash
npm install
```

### 2. Configuração

Criar arquivo `.env` na raiz:

```bash
EXPO_PUBLIC_API_URL=https://seu-servidor.com/api
```

### 3. Desenvolvimento

```bash
npm start
# Pressionar 'a' para Android ou 'i' para iOS
```

### 4. Build para TV

```bash
# Preview (desenvolvimento)
eas build -p android --profile preview

# Production (release)
eas build -p android --profile release
```

---

## 📱 Funcionalidades

✅ **Pairing com código de 6 dígitos**

- Vinculação segura do dispositivo ao servidor

✅ **Suporte a múltiplos formatos**

- Imagens (JPG, PNG)
- Vídeos (MP4, HLS)
- HTML (WebView customizado)
- Streams (RTSP, HTTP Live Streaming)

✅ **Sincronização Automática**

- Background tasks a cada 5 minutos
- Checksum MD5 para validação
- Limpeza automática de cache

✅ **Modo Offline**

- Funciona sem conexão usando cache local
- Fallback automático se servidor falhar
- Indicador visual de status

✅ **Inicialização Automática**

- Inicia na hora que a TV é ligada
- Background tasks contínuas
- Persiste dados entre reinicializações

✅ **Resiliência**

- Tratamento de erros
- Retry automático
- Logs detalhados

---

## 📁 Estrutura do Projeto

```
stv/
├── app/                        # Routes (Expo Router)
│   ├── _layout.tsx            # Layout raiz
│   └── modal.tsx              # Entry point
├── screens/
│   ├── PairingScreen.tsx      # Tela de pareamento
│   └── PlayerScreen.tsx       # Player de mídia
├── services/
│   ├── api.ts                 # Client API
│   ├── bootService.ts         # Background tasks
│   └── syncService.ts         # Sincronização
├── store/
│   ├── deviceStore.ts         # Estado do device
│   └── playlistStore.ts       # Estado da playlist
├── types/
│   └── index.ts               # TypeScript types
├── app.json                   # Config Expo
├── .env                       # Variáveis de ambiente
├── .env.example              # Template .env
├── ARCHITECTURE.md           # Documentação de arquitetura
├── BOOT_CONFIG.md            # Setup de boot
└── PLAYER_GUIDE.md           # Guia do player
```

---

## 🔐 API Server

### Endpoints Necessários

#### POST `/devices/pair` - Parear dispositivo

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
  "deviceToken": "token_abc123...",
  "deviceId": "dev-123",
  "deviceName": "Lobby TV"
}
```

#### GET `/device/sync` - Sincronizar playlist

```
Headers: x-device-token: {token}

Response: Ver docs/example-sync-response.json
```

#### POST `/device/heartbeat` - Status do dispositivo

```json
Request:
{
  "deviceId": "dev-123",
  "status": "online",
  "timestamp": "2026-05-07T15:30:00Z",
  "storageUsed": 1024000000,
  "storageTotal": 2147483648,
  "currentlyPlaying": "media-123"
}
```

---

## 🎬 Estrutura de Playlist

```typescript
interface Playlist {
  id: string;
  name: string;
  items: [
    {
      id: string;
      type: "image" | "video" | "html" | "stream";
      url: string;
      duration?: number; // milliseconds
      checksum?: string; // MD5
      localPath?: string; // após sync
      metadata?: {
        title?: string;
        description?: string;
        tags?: string[];
      };
    },
  ];
  schedule?: {
    enabled: boolean;
    timezone: string;
    rules: [
      {
        start: string; // HH:mm
        end: string; // HH:mm
        days: number[]; // 0-6 (sun-sat)
      },
    ];
  };
}
```

---

## 🛠️ Configuração de Produção

### 1. Android TV Box Setup

- Manter sempre ligado
- Conectar à internet via Ethernet (mais estável)
- Definir brightness ao máximo
- Desativar screensaver

### 2. Build para Deploy

```bash
# Criar build de produção
eas build -p android --profile release

# Instalar em TV
adb install -r app-release.apk

# Ou distribuir via MDM/EMM
```

### 3. Monitoramento

```bash
# Ver logs em tempo real
adb logcat | grep -i "stv\|sync\|heartbeat"

# Verificar status do cache
adb shell run-as com.stv.player ls -la /data/data/com.stv.player/cache/
```

---

## 📚 Documentação Detalhada

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Detalhes técnicos completos
- **[BOOT_CONFIG.md](BOOT_CONFIG.md)** - Configuração de boot automático
- **[PLAYER_GUIDE.md](PLAYER_GUIDE.md)** - Guia de uso do PlayerScreen
- **[docs/example-sync-response.json](docs/example-sync-response.json)** - Exemplo de resposta da API

---

## 🚨 Troubleshooting

### App não inicia no boot

- Verificar se `startOnBoot: true` em bootService.ts
- Verificar permissão RECEIVE_BOOT_COMPLETED
- Testar em dispositivo real (emulador pode não funcionar)

### Playlist não sincroniza

- Verificar URL da API em .env
- Verificar token do device em SecureStore (logcat)
- Verificar connectivity: `adb shell ping 8.8.8.8`

### Vídeo/imagem não carrega

- Verificar URL é pública e acessível
- Verificar checksum se fornecido
- Verificar permissão INTERNET

### App consome muita memória

- Limpar cache: `adb shell run-as com.stv.player rm -rf /cache`
- Reduzir número de items na playlist
- Usar imagens menores (máx 1920x1080 recomendado)

---

## 🔍 Desenvolvimento

### Debug Mode

```bash
# Habilitar logs detalhados
DEBUG_MODE=true npm start
```

### Teste de Offline

```bash
# Desabilitar network no device
adb shell svc wifi disable
adb shell svc data disable

# App deve usar cache automaticamente
```

### Sincronização Manual

```bash
# Forçar sync imediatamente
adb shell am broadcast -n com.stv.player/.services.BootService
```

---

## 📦 Dependências Principais

- **expo** ~54.0.33 - Framework React Native
- **zustand** ^4.5.7 - State management
- **axios** ^1.16.0 - HTTP client
- **expo-av** ~13.10.0 - Vídeo/áudio
- **react-native-webview** ^13.0.0 - HTML rendering
- **expo-file-system** ~16.0.0 - Cache
- **expo-secure-store** ~12.8.0 - Auth tokens
- **@react-native-async-storage/async-storage** - Playlist cache
- **crypto-js** ^4.2.0 - MD5 validation

---

## 📝 Environment Variables

```bash
EXPO_PUBLIC_API_URL=        # URL base da API
BACKGROUND_SYNC_INTERVAL=   # Minutos entre syncs (padrão: 5)
HEARTBEAT_INTERVAL=         # Minutos entre heartbeats (padrão: 30)
CACHE_LIMIT_MB=            # Limite de cache em MB (padrão: 2048)
DEBUG_MODE=                # Habilitar logs de debug
```

---

## 🎯 Roadmap

- [x] Pairing com código
- [x] Background tasks
- [x] Sync automático
- [x] PlayerScreen multiformat
- [x] Offline mode
- [x] Boot automático
- [ ] Controle remoto customizado
- [ ] Analytics/events
- [ ] OTA updates
- [ ] Wi-Fi setup wizard

---

## 📄 License

MIT

---

## 🤝 Suporte

Para problemas ou dúvidas:

1. Verificar logs: `adb logcat | grep stv`
2. Consultar documentação na pasta `/docs`
3. Verificar exemplo de resposta: `docs/example-sync-response.json`
