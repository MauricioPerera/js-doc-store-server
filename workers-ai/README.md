# Gemma Embedding Worker

Cloudflare Worker para generar embeddings vectoriales usando Google's Gemma 300M con soporte multilenguaje y Matryoshka.

## Características

- 🌍 **Multilenguaje**: Soporta 100+ idiomas (inglés, español, chino, japonés, etc.)
- 🎯 **Matryoshka**: Embeddings con dimensiones configurables (64, 128, 256, 512, 768, 1024, 1536, 2048)
- ⚡ **Alto rendimiento**: Modelo optimizado de 300M parámetros
- 🗜️ **Cuantización binaria**: Reduce embeddings a 1-bit por dimensión (32x compresión)
- 🔐 **Protegido por API Key**: Todos los endpoints de embedding requieren autenticación
- 🚀 **Serverless**: Ejecuta en la edge de Cloudflare

## Modelo

- **Modelo**: `@cf/google/embeddinggemma-300m`
- **Dimensiones máximas**: 2048
- **Lenguajes**: 100+
- **Licencia**: Abierta (Gemma)

## Instalación

```bash
# Instalar dependencias
npm install -g wrangler

# Login en Cloudflare
wrangler login

# Configurar API key (requerido para autenticación)
wrangler secret put API_KEY
# Ingresa una clave secreta segura

# Desplegar
./deploy.sh
# o
wrangler deploy
```

## Autenticación

Todos los endpoints de embedding (`/embed`, `/embed/matryoshka`, `/embed/multilingual`, `/quantize/binary`) requieren autenticación mediante API key.

**Obtener API key:** Contacta al administrador del sistema.

**Métodos de autenticación:**

1. **Header Authorization (recomendado):**
   ```bash
   curl -X POST https://gemma-embedding-worker.YOUR_SUBDOMAIN.workers.dev/embed \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"text": "Hello world"}'
   ```

2. **Query parameter:**
   ```bash
   curl -X POST "https://gemma-embedding-worker.YOUR_SUBDOMAIN.workers.dev/embed?api_key=YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"text": "Hello world"}'
   ```

**Respuesta sin autenticación:**
```json
{
  "success": false,
  "message": "API key required. Provide via Authorization: Bearer <key> header or ?api_key=<key> query parameter"
}
```

## API Endpoints

### GET / - Información
```bash
curl https://gemma-embedding-worker.YOUR_SUBDOMAIN.workers.dev/
```

### POST /embed - Generar embeddings
```bash
curl -X POST https://gemma-embedding-worker.YOUR_SUBDOMAIN.workers.dev/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world"}'
```

**Respuesta:**
```json
{
  "success": true,
  "model": "@cf/google/embeddinggemma-300m",
  "dimensions": 2048,
  "embedding": [0.023, -0.045, ...]
}
```

### POST /embed - Batch
```bash
curl -X POST https://gemma-embedding-worker.YOUR_SUBDOMAIN.workers.dev/embed \
  -H "Content-Type: application/json" \
  -d '{
    "texts": [
      "First text",
      "Second text",
      "Third text"
    ]
  }'
```

### POST /embed/matryoshka - Dimensiones reducidas
```bash
curl -X POST https://gemma-embedding-worker.YOUR_SUBDOMAIN.workers.dev/embed/matryoshka \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello world",
    "dimensions": 256
  }'
```

**Dimensiones soportadas:** 64, 128, 256, 512, 768, 1024, 1536, 2048

### POST /embed/multilingual - Múltiples idiomas
```bash
curl -X POST https://gemma-embedding-worker.YOUR_SUBDOMAIN.workers.dev/embed/multilingual \
  -H "Content-Type: application/json" \
  -d '{
    "texts": [
      {"text": "Hello world", "language": "en"},
      {"text": "Hola mundo", "language": "es"},
      {"text": "你好世界", "language": "zh"},
      {"text": "こんにちは", "language": "ja"}
    ]
  }'
```

### POST /quantize/binary - Cuantización binaria
```bash
curl -X POST https://gemma-embedding-worker.YOUR_SUBDOMAIN.workers.dev/quantize/binary \
  -H "Content-Type: application/json" \
  -d '{
    "embedding": [0.023, -0.045, 0.12, -0.08, ...]
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "originalDimensions": 2048,
  "binarySize": 256,
  "compressionRatio": "32.00x",
  "binary": "base64encodedstring..."
}
```

## Ejemplos de uso

### Generar embedding para búsqueda semántica
```javascript
const response = await fetch('https://gemma-embedding-worker.YOUR_SUBDOMAIN.workers.dev/embed/matryoshka', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: "How to implement authentication in Node.js",
    dimensions: 768  // Optimizado para búsqueda
  })
});

const { embedding } = await response.json();
// Usar con js-vector-store para búsqueda semántica
```

### Batch processing
```javascript
const texts = [
  "Machine learning tutorial",
  "Cloud computing basics",
  "Docker containers guide"
];

const response = await fetch('https://gemma-embedding-worker.YOUR_SUBDOMAIN.workers.dev/embed', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ texts })
});

const { embeddings } = await response.json();
// Array de embeddings para cada texto
```

## Integración con js-doc-store-server

```javascript
// Ejemplo: Indexar documentos con embeddings
async function indexDocument(docId, content) {
  // 1. Generar embedding
  const embedRes = await fetch('https://gemma-embedding-worker.YOUR_SUBDOMAIN.workers.dev/embed/matryoshka', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: content, dimensions: 768 })
  });
  const { embedding } = await embedRes.json();

  // 2. Guardar en js-doc-store-server
  await fetch('https://js-doc-store-server.YOUR_SUBDOMAIN.workers.dev/admin/vector/index', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_TOKEN'
    },
    body: JSON.stringify({
      collection: 'documents',
      id: docId,
      vector: embedding,
      metadata: { content: content.substring(0, 200) }
    })
  });
}
```

## Ventajas de Matryoshka

| Dimensiones | Uso recomendado | Precisión | Velocidad |
|------------|----------------|-----------|-----------|
| 64 | Móvil/Edge | ⭐⭐ | ⚡⚡⚡ |
| 256 | Apps web | ⭐⭐⭐ | ⚡⚡⚡ |
| 768 | Búsqueda estándar | ⭐⭐⭐⭐ | ⚡⚡ |
| 2048 | Máxima precisión | ⭐⭐⭐⭐⭐ | ⚡ |

## Límites

- Rate limiting: Configurable en Cloudflare dashboard
- Tamaño máximo de texto: ~512 tokens
- Tiempo de respuesta: ~50-200ms

## Recursos

- [Modelo EmbeddingGemma](https://developers.cloudflare.com/workers-ai/models/embeddinggemma-300m/)
- [Gemma Model Card](https://ai.google.dev/gemma)
- [Matryoshka Embeddings](https://arxiv.org/abs/2205.13147)
