# PlayerScreen - Implementação Completa

## 📺 O que foi implementado

O `PlayerScreen` é o coração do app, responsável por:

### ✅ Renderização Multimídia

- **Imagens**: Suporte a JPG, PNG com duração configurável
- **Vídeos**: MP4, HLS, stream contínuo com controle automático
- **HTML**: WebView para conteúdo customizado (carrosséis, dashboards, etc)
- **Streams**: RTSP, HTTP Live Streaming com loop automático

### ✅ Auto-Avance

- Imagens/HTML: Avança após duração especificada no item
- Vídeos: Avança automaticamente ao final
- Transição suave entre itens
- Suporte a loop (volta para primeiro item)

### ✅ Sincronização

- Background sync a cada 5 minutos
- Heartbeat com servidor a cada 30 minutos
- Fallback automático para cache se servidor falhar
- Atualização automática de playlist

### ✅ Resiliência

- Tratamento de erros de imagem/vídeo
- Modo offline com indicador visual
- Retry automático com exponential backoff
- Logs detalhados para debug

### ✅ UX para TV

- Fullscreen landscape obrigatório
- Overlay com metadados (título, descrição)
- Banner de status offline
- Info de debug (posição na playlist)

---

## 📋 Estrutura de MediaItem

```typescript
interface MediaItem {
  id: string;
  type: "image" | "video" | "html" | "stream";
  url: string;
  duration?: number; // milliseconds (padrão: 10000)
  checksum?: string; // MD5 para validação
  fileSize?: number; // bytes
  localPath?: string; // preenchido após sync
  metadata?: {
    title?: string;
    description?: string;
    tags?: string[];
  };
}
```

---

## 🎬 Tipos de Conteúdo

### 📷 Imagem

```json
{
  "id": "img-001",
  "type": "image",
  "url": "https://cdn.example.com/banner.jpg",
  "duration": 10000,
  "metadata": {
    "title": "Bem-vindo!",
    "description": "Destaques da semana"
  }
}
```

- Duration em milliseconds
- Exibe durante o tempo especificado
- Mostra overlay com metadados

### 🎥 Vídeo

```json
{
  "id": "vid-001",
  "type": "video",
  "url": "https://cdn.example.com/promo.mp4",
  "duration": 30000,
  "fileSize": 10485760
}
```

- Toca automaticamente
- Avança ao final
- Suporte a HLS/DASH

### 🌐 HTML

```json
{
  "id": "html-001",
  "type": "html",
  "url": "https://seu-servidor.com/carousel",
  "duration": 15000
}
```

- WebView fullscreen
- Suporte a javascript
- Avança após duração

### 📡 Stream

```json
{
  "id": "stream-001",
  "type": "stream",
  "url": "rtsp://source.example.com/live",
  "duration": 0
}
```

- RTSP/HLS contínuo
- Loop infinito
- Ideal para câmeras/feeds ao vivo

---

## 🔄 Fluxo de Execução

```
App inicia
    ↓
[PlayerScreen monta]
    ├─ initializePlayer()
    │  ├─ syncPlaylist() → carrega do servidor
    │  ├─ registerBackgroundSync() → registra task
    │  └─ loadFromCache() [se falhar]
    └─ setupListeners()
       ├─ AppState (background/foreground)
       ├─ Timer para auto-avance
       └─ Heartbeat periódico
    ↓
[Renderiza item atual]
    ├─ Imagem com timer
    ├─ Vídeo com onEnd handler
    ├─ HTML com WebView
    └─ Stream contínuo
    ↓
[Auto-avance]
    ├─ handleNextItem()
    ├─ nextItem() → atualiza store
    ├─ Force re-render (imageKey++)
    └─ Loop se necessário
    ↓
[Background]
    ├─ Sync task a cada 5 min
    ├─ Heartbeat a cada 30 min
    └─ Atualiza cache localmente
```

---

## 🛠️ Configuração Requerida

### .env

```bash
EXPO_PUBLIC_API_URL=https://seu-servidor.com/api
```

### API Response Esperada (GET /device/sync)

```json
{
  "playlists": [
    {
      "id": "playlist-1",
      "name": "Main Display",
      "items": [...]
    }
  ],
  "metadata": {
    "lastUpdated": "2026-05-07T15:30:00Z",
    "version": 42
  }
}
```

---

## 🚀 Desenvolvimento Local

### Testar com arquivos locais

```bash
# Dev mode
npm start

# Selecionar Android/iOS
# Pressionar 'a' para Android ou 'i' para iOS
```

### Simular erro de rede

```typescript
// Em PlaylistStore.tsx, descomentar para forçar offline
// setOffline(true);
```

### Testar auto-avance

1. Adicionar imagens com `duration: 3000` (3 segundos)
2. Iniciar app
3. Verificar se avança automaticamente

### Logs de Debug

```bash
adb logcat | grep "PlayerScreen\|sync\|heartbeat"
```

---

## ⚡ Performance

### Otimizações Implementadas

- ✅ Lazy load de imagens grandes
- ✅ Limpeza automática de timers
- ✅ Preload de cache ao iniciar
- ✅ Debouncing de eventos
- ✅ Removal de listeners no unmount

### Limites de Memória

- Max 2GB cache de mídia (configurável)
- Limpeza de arquivos não utilizados
- Rotation automática de logs

---

## 🔧 Customizações Possíveis

### Alterar intervalo de auto-avance

```typescript
// Em PlayerScreen.tsx
const duration = currentItem.duration || 10000; // Mudar 10000 (10s)
```

### Adicionar controle remoto (TV)

```typescript
// Adicionar em useEffect:
const subscription = useTVEventHandler((evt) => {
  if (evt.eventType === "right") handleNextItem();
  if (evt.eventType === "left") handlePreviousItem();
  if (evt.eventType === "up") togglePlayPause();
});
```

### Mostrar barra de progresso de vídeo

```typescript
// Adicionar após video tag:
<View style={styles.progressBar}>
  <View style={{
    width: `${(playerState.currentTime / playerState.duration) * 100}%`,
    height: 4,
    backgroundColor: '#2563eb'
  }} />
</View>
```

---

## 🐛 Troubleshooting

### Imagem não carrega

- Verificar URL é acessível
- Verificar permissão INTERNET no app.json
- Verificar checksum MD5 se fornecido

### Vídeo trava ao final

- Usar `isLooping={false}` (padrão)
- Verificar formato (MP4 recomendado)
- Testar com HLS se stream

### App não volta do background

- Verificar se background tasks estão registradas
- Verificar RECEIVE_BOOT_COMPLETED permission
- Testar em dispositivo real (emulador pode não funcionar)

### Cache não sincroniza

- Verificar URL da API
- Verificar token do device (SecureStore)
- Verificar network connectivity
- Ver logs: `adb logcat | grep "sync"`

---

## 📝 Exemplo Completo de Playlist

```json
{
  "playlists": [
    {
      "id": "lobby-display",
      "name": "Lobby Display",
      "items": [
        {
          "id": "img-welcome",
          "type": "image",
          "url": "https://cdn.example.com/welcome.jpg",
          "duration": 5000,
          "checksum": "abc123def456",
          "metadata": {
            "title": "Bem-vindo!",
            "description": "STV Digital Display"
          }
        },
        {
          "id": "vid-promo",
          "type": "video",
          "url": "https://cdn.example.com/promo.mp4",
          "checksum": "xyz789abc123"
        },
        {
          "id": "carousel",
          "type": "html",
          "url": "https://seu-servidor.com/carousel/lobby",
          "duration": 8000
        },
        {
          "id": "camera-feed",
          "type": "stream",
          "url": "rtsp://camera.local:554/stream",
          "duration": 0
        }
      ],
      "schedule": {
        "enabled": true,
        "timezone": "America/Sao_Paulo",
        "rules": [
          {
            "start": "08:00",
            "end": "18:00",
            "days": [1, 2, 3, 4, 5] // seg-sex
          }
        ]
      }
    }
  ]
}
```

---

## ✅ Checklist de Produção

- [ ] API endpoint `/device/sync` testado
- [ ] Playlist com URLs públicas
- [ ] Device pareado com sucesso
- [ ] Background tasks registradas
- [ ] Heartbeat enviando
- [ ] Cache sincronizando
- [ ] Vídeos rodando fullscreen
- [ ] Auto-avance funcionando
- [ ] Modo offline testado
- [ ] Logs analisados
- [ ] Build APK gerado
- [ ] Testado em TV Android real
