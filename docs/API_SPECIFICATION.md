# Exemplos de API

Este diretório contém exemplos de respostas esperadas dos endpoints da API.

## Endpoints Necessários

### 1. POST `/devices/pair`

Parear um novo dispositivo usando código de 6 dígitos.

**Request:**

```json
{
  "pairingCode": "123456",
  "deviceInfo": {
    "model": "Android TV",
    "platform": "android-tv",
    "version": "1.0.0",
    "appVersion": "1.0.0"
  }
}
```

**Response (200 OK):**

```json
{
  "deviceToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "deviceId": "dev-prod-001",
  "deviceName": "Lobby Display 1",
  "expiresIn": 86400
}
```

**Error Response (400 Bad Request):**

```json
{
  "error": "invalid_code",
  "message": "Código de pareamento inválido ou expirado"
}
```

---

### 2. GET `/device/sync`

Obter configuração de sincronização e playlists.

**Request Headers:**

```
x-device-token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
Ver arquivo `example-sync-response.json`

**Key Points:**

- Retornar array vazio se nenhuma playlist
- Incluir checksum MD5 de cada mídia (para validação local)
- Incluir localPath se mídia já foi baixada
- Timestamp em ISO 8601

---

### 3. POST `/device/heartbeat`

Enviar status do dispositivo periodicamente.

**Request:**

```json
{
  "deviceId": "dev-prod-001",
  "status": "online",
  "timestamp": "2026-05-07T15:30:00Z",
  "uptime": 3600000,
  "storageUsed": 1024000000,
  "storageTotal": 2147483648,
  "currentlyPlaying": "media-001"
}
```

**Response (200 OK):**

```json
{
  "commands": [
    {
      "id": "cmd-123",
      "type": "sync",
      "payload": {}
    }
  ],
  "nextHeartbeatIn": 1800000
}
```

**Tipos de Comando:**

- `sync` - Forçar sincronização imediata
- `restart` - Reiniciar aplicação
- `unpair` - Remover pareamento
- `update-config` - Atualizar configuração

---

### 4. POST `/device/unpair` (Opcional)

Remover pareamento do dispositivo.

**Request Headers:**

```
x-device-token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Dispositivo despareiado com sucesso"
}
```

---

## 📋 Formato de Playlist

Ver `example-sync-response.json` para exemplo completo.

### Campos Obrigatórios

- `id` - Identificador único
- `name` - Nome da playlist
- `items` - Array de mídias

### Campos Opcionais

- `description` - Descrição
- `schedule` - Agendamento
- `updatedAt` - Timestamp da última atualização
- `version` - Versão da playlist

### Tipos de Mídia

- `image` - Imagem estática (JPG, PNG)
- `video` - Vídeo (MP4, HLS)
- `html` - Conteúdo HTML (WebView)
- `stream` - Stream contínuo (RTSP, HLS)

---

## ✅ Validação de Checksum

O cliente valida integridade de arquivos usando MD5:

```typescript
// Servidor deve enviar:
{
  "id": "media-001",
  "url": "https://cdn.example.com/image.jpg",
  "checksum": "5d41402abc4b2a76b9719d911017c592"
}

// Cliente valida:
import CryptoJS from 'crypto-js';
const hash = CryptoJS.MD5(fileContent).toString();
// Se hash !== checksum, re-baixa arquivo
```

---

## 🔐 Autenticação

Todos os endpoints exceto `/devices/pair` requerem token:

```
Headers:
  x-device-token: {token}
```

Token é obtido no pareamento e armazenado em SecureStore (criptografado).

---

## 🕐 Timing

### Sincronização

- **Intervalo:** 5 minutos (configurável)
- **Ao iniciar:** Imediato
- **Ao voltar do background:** Imediato
- **Background task:** Rodar mesmo com app fechado

### Heartbeat

- **Intervalo:** 30 minutos (configurável)
- **Timeout:** 30 segundos
- **Retry:** Exponential backoff

---

## 🚨 Error Handling

### Cliente retry automaticamente para:

- Timeout (> 30s)
- Network error
- 5xx server errors

### Cliente NÃO retry para:

- 400 Bad Request
- 401 Unauthorized (token expirado)
- 404 Not Found

### Fallback para offline:

Se qualquer erro, usar cache local e continuar playing.

---

## 📊 Exemplo de Fluxo Completo

```
1. Cliente inicia → /devices/pair com código
   ↓
2. Servidor retorna { token, deviceId }
   ↓
3. Cliente armazena em SecureStore
   ↓
4. Cliente → GET /device/sync com token
   ↓
5. Servidor retorna playlists + mídias
   ↓
6. Cliente baixa todas as mídias, valida checksums
   ↓
7. Cliente inicia PlayerScreen, começando por primeiro item
   ↓
8. A cada 5 minutos: background task → GET /device/sync
   ↓
9. A cada 30 minutos: heartbeat → POST /device/heartbeat
   ↓
10. Se comando "sync" recebido: download imediato
```

---

## 🔄 Ciclo de Vida de Mídia

```
URL fornecida pelo servidor
    ↓
[Download para /cache/media/{id}]
    ↓
[Calcular MD5]
    ↓
[Validar contra checksum]
    ✗ Se falhar → re-baixar
    ✓ Se OK → usar local
    ↓
[Renderizar em Player]
    ↓
[Próxima sincronização]
    ├─ Se URL mudou → re-baixar
    ├─ Se checksum mudou → re-baixar
    └─ Se URL igual → usar cache
```

---

## 📝 Notas para Backend

1. **Checksum**: Sempre incluir para validação robusta
2. **FileSize**: Ajuda a monitorar quota de cache
3. **Duration**: Em milliseconds (ms), não segundos
4. **URL**: Deve ser acessível publicamente (ou via VPN)
5. **Timestamp**: Sempre ISO 8601 com timezone
6. **Token**: JWT com TTL recomendado (86400s = 24h)
7. **Version**: Incrementar quando playlist muda

---

## 🧪 Teste com cURL

```bash
# 1. Parear dispositivo
curl -X POST https://seu-servidor.com/api/devices/pair \
  -H "Content-Type: application/json" \
  -d '{
    "pairingCode": "123456",
    "deviceInfo": {"model": "Android TV", "platform": "android-tv", "version": "1.0.0"}
  }'

# 2. Sincronizar (usando token retornado)
curl -X GET https://seu-servidor.com/api/device/sync \
  -H "x-device-token: eyJhbGciOi..."

# 3. Enviar heartbeat
curl -X POST https://seu-servidor.com/api/device/heartbeat \
  -H "Content-Type: application/json" \
  -H "x-device-token: eyJhbGciOi..." \
  -d '{
    "deviceId": "dev-001",
    "status": "online",
    "timestamp": "2026-05-07T15:30:00Z"
  }'
```
