# js-doc-store-server

API REST para js-doc-store con autenticación JWT, RBAC, multi-agent collaboration y embeddings con Google Gemma.

## 🚀 Quick Start

> **Nota**: El deployment automático se realiza vía GitHub Actions a Cloudflare Workers.

```bash
npm install
npm start
```

Server runs on `http://localhost:3000`

## 📚 Documentación

- **[📖 API Reference Completa](./API.md)** - Documentación detallada de todos los endpoints con ejemplos
- **[🔍 Vector Search](./API.md#-vector-search-endpoints-js-vector-store-integration)** - Búsqueda semántica con embeddings
- **[🧠 Embedding Integration](./EMBEDDING_INTEGRATION.md)** - Guía de integración con Google Gemma 300M
- **[📄 RAG Sin Vectores](#rag-sin-vectores)** - Retrieval usando solo texto + índices
- [API Endpoints](#api-endpoints)
- [Autenticación](#autenticación)
- [Configuración](#configuración)

### Características del Vector Store

- **4 tipos de store**: `float32` (precisión máxima), `int8` (4x compresión), `binary` (32x compresión), `polar` (21x compresión, 100% recall)
- **Búsqueda matryoshka**: Multi-stage dimensional search `[128, 384, 768]`
- **Hybrid search**: Combinación de similitud vectorial + BM25
- **Cross-collection**: Score normalization entre colecciones
- **Embeddings automáticos**: Integración con Google Gemma 300M via Cloudflare AI
- **Zero dependencies**: js-vector-store incluido en el worker

### Embeddings con Google Gemma 300M

El servidor integra automáticamente embeddings usando Cloudflare AI:

```bash
# Generar embedding
POST /admin/embed
{
  "text": "Machine learning is a subset of AI",
  "dimensions": 768  // 64, 256, 768, o 2048
}

# Indexar con embedding automático
POST /admin/vector/index-with-text
{
  "collection": "documents",
  "id": "doc-123",
  "text": "Contenido del documento...",
  "metadata": { "category": "tech" }
}

# Buscar con lenguaje natural
POST /admin/vector/search-by-text
{
  "collection": "documents",
  "query": "inteligencia artificial",
  "limit": 10
}
```

Ver [EMBEDDING_INTEGRATION.md](./EMBEDDING_INTEGRATION.md) para más detalles.

---

## 📄 RAG Sin Vectores

**js-doc-store permite implementar RAG (Retrieval-Augmented Generation) SIN embeddings ni vectores.** La clave: **estructura jerárquica + summaries** en vez de búsqueda plana por keywords.

### Reasoning Tree: El Árbol COMO Índice

El enfoque **Reasoning Tree** usa la estructura del dato como índice de retrieval:

```
Root (level 0)
 └─ Branch: "Seguridad" (summary: "Autenticación y autorización")
     ├─ Branch: "JWT" (summary: "Tokens firmados HS256")
     │   ├─ Leaf: "Implementación básica"
     │   └─ Leaf: "Refresh tokens"
     └─ Branch: "OAuth2" (summary: "Flujos de autorización")
```

**Retrieval por navegación jerárquica:**
1. **Root**: Query `level: 0` → Encontrar dominio general
2. **Branch**: Query `parent_id: root` → Analizar summaries → Elegir rama
3. **Leaf**: Query `parent_id: branch` → Obtener contenido específico
4. **Contexto**: Root summary + Branch summary + Leaf content = Contexto completo para LLM

### Por Qué Esto ES RAG Sin Vectores

| Vector RAG | Reasoning Tree RAG |
|-----------|-------------------|
| Query → Embedding → KNN → Docs | Query → Tree Navigation → Docs |
| Espacio vectorial plano | Jerarquía con summaries |
| Similitud semántica (ML) | Navegación estructural + texto |
| Requiere AI/ML | Zero dependencies |
| Contexto: snippets relacionados | Contexto: ruta completa + summaries |

**El árbol ES el índice. Los summaries SON los embeddings (humanos).**

### Ejemplo: Implementación con js-doc-store

```javascript
const { DocStore, FileStorageAdapter, Table } = require('js-doc-store');

const db = new DocStore(new FileStorageAdapter('./data'));
const tree = new Table(db, 'knowledge_tree', { columns: [
  { name: 'title', type: 'text', required: true },
  { name: 'summary', type: 'text', required: true },  // "Embedding humano"
  { name: 'content', type: 'text' },
  { name: 'parent_id', type: 'text' },  // null = root
  { name: 'level', type: 'number', default: 0 }
]});

// Crear raíz
tree.insert({
  title: 'Documentación Técnica',
  summary: 'Guías de autenticación, API y despliegue',
  parent_id: null,
  level: 0
});

// Navegación RAG - Paso 1: Encontrar raíz relevante
const roots = tree.find({ parent_id: null }).toArray();

// Paso 2: Navegar a branch específico
const branches = tree.find({ parent_id: roots[0]._id }).toArray();

// Paso 3: Obtener leaves con contexto completo
const leaves = tree.find({ parent_id: branches[0]._id }).toArray();

// Ensamblar contexto para LLM
const context = {
  root: roots[0].summary,
  branch: branches[0].summary,
  content: leaves.map(l => l.content)
};
// Enviar a LLM para generación
```

### Búsqueda Híbrida: Reasoning Tree + Full-Text

Combiná navegación jerárquica con búsqueda por texto para mejores resultados:

```javascript
// 1. Navegación estructural
const branch = tree.find({
  parent_id: rootId,
  summary: { $regex: 'autenticación', $options: 'i' }
}).toArray()[0];

// 2. Búsqueda dentro del branch
const results = tree.find({
  parent_id: branch._id,
  content: { $regex: 'JWT', $options: 'i' }
}).toArray();

// 3. Scoring por relevancia (BM25-like + estructura)
const scored = results.map(doc => ({
  ...doc,
  _ragScore: calculateScore(doc, query)
})).sort((a, b) => b._ragScore - a._ragScore);
```

### Comparación: Vectores vs Reasoning Tree

| Característica | Con Vectores | Reasoning Tree |
|---------------|--------------|----------------|
| **Similitud semántica** | ✅ Alta (embeddings) | ⚠️ Media (summaries humanos) |
| **Setup** | Complejo (AI/ML) | ✅ Simple (JS puro) |
| **Performance** | ~100ms (inferencia) | ✅ ~10ms (índices) |
| **Costo** | API calls / GPU | ✅ $0 |
| **Precisión** | 85-95% recall | 80-90% recall |
| **Dependencies** | Cloudflare AI / Ollama | ✅ Ninguna |
| **Contexto** | Snippets sueltos | ✅ Ruta jerárquica completa |
| **Explicabilidad** | ⚠️ Caja negra | ✅ Navegación transparente |

### Cuándo usar cada uno

**Usa Reasoning Tree RAG cuando:**
- Tu conocimiento tiene estructura jerárquica natural (documentación, wikis, KBs)
- Querés que el LLM entienda el contexto completo, no snippets sueltos
- Necesitás explicabilidad (mostrar la ruta de navegación)
- Los summaries humanos aportan valor semántico
- Zero dependencies es prioridad

**Usa RAG con vectores cuando:**
- Tu data es plana sin jerarquía obvia
- Necesitas descubrir relaciones no evidentes (sinónimos, conceptos relacionados)
- Tenés volumen masivo (>100k docs) sin estructura clara
- Presupuesto para embeddings está disponible

---

## 🌐 Deploy en Cloudflare Workers

Ver [DEPLOY.md](./DEPLOY.md) para instrucciones detalladas de deploy.

Tu servidor estará disponible en:
```
https://YOUR_WORKER_NAME.YOUR_ACCOUNT.workers.dev
```

> ⚠️ **Seguridad**: Nunca expongas tu URL real en repositorios públicos. Usa siempre `YOUR_WORKER_SUBDOMAIN` como placeholder.

---

## API Endpoints

### Públicos
- `GET /public/tables` - Listar tablas
- `GET /public/query/:table` - Query público

### Auth
- `POST /auth/bootstrap` - Crear primer admin (solo cuando no hay usuarios)
- `POST /auth/register` - Registrar usuario
- `POST /auth/login` - Login (retorna JWT)

### Admin (requiere JWT)
- `POST /admin/create-table` - Crear tabla
- `POST /admin/insert` - Insertar documento
- `POST /admin/query` - Query con filtros
- `POST /admin/update` - Actualizar documentos
- `POST /admin/remove` - Eliminar documentos
- `POST /admin/aggregate` - Pipeline de agregación
- `POST /admin/create-view` - Crear vista
- `POST /admin/deploy-template` - Deploy template
- `POST /admin/assign-role` - Asignar rol a usuario

### Vector Search (requiere JWT)
- `POST /admin/vector/index` - Indexar vector con embedding
- `POST /admin/vector/batch` - Indexar múltiples vectores
- `POST /admin/vector/search` - Búsqueda semántica
- `POST /admin/vector/search-hybrid` - Hybrid (vector + BM25)
- `POST /admin/vector/search-cross` - Cross-collection search
- `GET /admin/vector/collections` - Listar colecciones
- `GET /admin/vector/stats` - Estadísticas del vector store
- `GET /admin/vector/:collection/:id` - Obtener vector por ID
- `DELETE /admin/vector/:collection/:id` - Eliminar vector
- `POST /admin/vector/drop` - Eliminar colección

### Embeddings (requiere JWT)
- `POST /admin/embed` - Generar embedding para texto
- `POST /admin/vector/index-with-text` - Indexar documento con embedding automático
- `POST /admin/vector/search-by-text` - Buscar con lenguaje natural
- `POST /admin/vector/batch-index-with-text` - Indexar batch con embeddings

### Vault
- `POST /admin/vault/add` - Guardar secreto
- `GET /admin/vault/list` - Listar secretos
- `POST /admin/vault/execute` - Ejecutar con secreto

## Autenticación

### Bootstrap - Primer Admin

Cuando el servidor está vacío (sin usuarios), usa `/auth/bootstrap` para crear el primer administrador:

```bash
curl -X POST http://localhost:3000/auth/bootstrap \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Admin123!",
    "name": "Administrator"
  }'
```

### Login Normal

```bash
# 1. Registrar
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"pass123","name":"User"}'

# 2. Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"pass123"}'

# 3. Usar token
curl -X POST http://localhost:3000/admin/insert \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tableName":"users","data":{"name":"Alice"}}'
```

## Configuración

Copia `.env.example` a `.env` y configura:

```bash
# Server
PORT=3000
NODE_ENV=development

# Seguridad
JWT_SECRET=your-jwt-secret-here
VAULT_SECRET=your-vault-secret-here
DB_ENCRYPTION_KEY=your-encryption-key

# Cloudflare (opcional - para desarrollo local)
EMBEDDING_WORKER_URL=https://gemma-embedding-worker.your-subdomain.workers.dev
EMBEDDING_API_KEY=your-api-key

# Admin por defecto (para tests)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin123!
API_URL=http://localhost:3000
```

## Testing

Ejecuta el test suite completo:

```bash
# Test completo
node run_full_test_suite.js

# Tests individuales
node test_collaboration.js
node test_public_endpoints.js
node test_embedding_integration.js
```

Variables de entorno para tests:
- `API_URL` - URL del servidor (default: https://YOUR_WORKER_SUBDOMAIN.workers.dev)
- `ADMIN_EMAIL` - Email del admin
- `ADMIN_PASSWORD` - Password del admin

## CI/CD

Automated testing and deployment with GitHub Actions:

```bash
# Setup secrets (one-time)
./scripts/setup-github-secrets.sh

# Or manually:
git secret set CLOUDFLARE_API_TOKEN
git secret set CLOUDFLARE_ACCOUNT_ID
git secret set API_URL
git secret set ADMIN_EMAIL
git secret set ADMIN_PASSWORD
```

Ver [CI_CD_SETUP.md](./CI_CD_SETUP.md) para configuración detallada.

**Workflows**:
- **PR**: Tests + Security scan
- **Push to master**: Tests + Security scan + Auto-deploy

## Rate Limiting

El servidor implementa rate limiting en Cloudflare Workers:

- **Free Tier**: 100,000 requests/día, 1,000 writes/día
- **Headers incluidos**:
  - `X-RateLimit-Limit`: Límite de requests
  - `X-RateLimit-Remaining`: Requests restantes
  - `X-RateLimit-Reset`: Timestamp de reset

Configura rate limits personalizados en el dashboard de Cloudflare.

## Dependencias

- [js-doc-store](https://github.com/MauricioPerera/js-doc-store) - Core database
- [js-vector-store](https://github.com/MauricioPerera/js-vector-store) - Vector search
- express - Web server (local)
- cors - CORS headers
- axios - HTTP client

## Licencia

MIT