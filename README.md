# js-doc-store-server

API REST para js-doc-store con autenticación JWT, RBAC y multi-agent collaboration.

## 🚀 Quick Start

```bash
npm install
npm start
```

Server runs on `http://localhost:3000`

## 📚 Documentación

- **[📖 API Reference Completa](./API.md)** - Documentación detallada de todos los endpoints con ejemplos
- **[🔍 Vector Search](./API.md#-vector-search-endpoints-js-vector-store-integration)** - Búsqueda semántica con embeddings
- [API Endpoints](#api-endpoints)
- [Autenticación](#autenticación)
- [Configuración](#configuración)

### Características del Vector Store

- **4 tipos de store**: `float32` (precisión máxima), `int8` (4x compresión), `binary` (32x compresión), `polar` (21x compresión, 100% recall)
- **Búsqueda matryoshka**: Multi-stage dimensional search `[128, 384, 768]`
- **Hybrid search**: Combinación de similitud vectorial + BM25
- **Cross-collection**: Score normalization entre colecciones
- **Zero dependencies**: js-vector-store incluido en el worker

---

## 🌐 Deploy en Cloudflare Workers

El servidor está desplegado y disponible en:

```
https://js-doc-store-server.rckflr.workers.dev
```

Ver [DEPLOY.md](./DEPLOY.md) para instrucciones detalladas de deploy.

---

## API Endpoints

### Públicos
- `GET /public/tables` - Listar tablas
- `GET /public/query/:table` - Query público

### Auth
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

### Vector Search (requiere JWT)
- `POST /admin/vector/index` - Indexar vector con embedding
- `POST /admin/vector/batch` - Indexar múltiples vectores
- `POST /admin/vector/search` - Búsqueda semántica
- `POST /admin/vector/search-hybrid` - Hybrid (vector + BM25)
- `POST /admin/vector/search-cross` - Cross-collection search
- `GET /admin/vector/collections` - Listar colecciones
- `GET /admin/vector/stats` - Estadísticas del vector store
- `DELETE /admin/vector/:collection/:id` - Eliminar vector
- `POST /admin/vector/drop` - Eliminar colección

### Vault
- `POST /admin/vault/add` - Guardar secreto
- `GET /admin/vault/list` - Listar secretos
- `POST /admin/vault/execute` - Ejecutar con secreto

## Autenticación

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

Variables de entorno:
- `PORT` - Puerto (default: 3000)
- `DATA_DIR` - Directorio de datos
- `JWT_SECRET` - Secreto para JWT
- `DB_ENCRYPTION_KEY` - Clave de encriptación

## Dependencias

- [js-doc-store](https://github.com/MauricioPerera/js-doc-store) - Core database
- express - Web server
- cors - CORS headers
- axios - HTTP client

## Licencia

MIT
