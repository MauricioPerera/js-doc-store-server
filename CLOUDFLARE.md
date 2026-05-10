# ☁️ Cloudflare Workers Deployment

Guía para deployar js-doc-store-server en Cloudflare Workers.

## 🎯 Diferencias con Node.js Server

| Feature | Node.js (Express) | Cloudflare Workers |
|---------|-------------------|-------------------|
| Runtime | Node.js | V8 Isolate |
| Storage | File System (local) | Cloudflare KV |
| HTTP Server | Express | Fetch API |
| Auth | bcrypt (CPU intensive) | Web Crypto API |
| Duración | Persistente | Request-based |

## 🚀 Quick Deploy

### 1. Instalar Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Login en Cloudflare

```bash
wrangler login
```

### 3. Crear KV Namespace

```bash
wrangler kv:namespace create "DOC_STORE_KV"
```

Copia el ID generado y actualiza `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "DOC_STORE_KV"
id = "tu-kv-namespace-id-aqui"
```

### 4. Configurar Secretos

```bash
wrangler secret put JWT_SECRET
# Ingresa tu secreto JWT
```

### 5. Deploy

```bash
wrangler deploy
```

## 📁 Estructura

```
js-doc-store-server/
├── cloudflare-worker.js    # Entry point para Workers
├── wrangler.toml           # Configuración
├── CLOUDFLARE.md           # Esta guía
└── server.js               # Versión Node.js (alternativa)
```

## 🔧 Endpoints Soportados

### Públicos
- `GET /public/tables` - Listar tablas
- `GET /public/query/:table` - Query público

### Auth
- `POST /auth/register` - Registrar usuario
- `POST /auth/login` - Login (JWT)

### Admin (requiere JWT)
- `POST /admin/create-table` - Crear tabla
- `POST /admin/insert` - Insertar documento
- `POST /admin/query` - Query con filtros
- `POST /admin/aggregate` - Aggregation pipeline

## 💡 Consideraciones

### ✅ Ventajas de Cloudflare

1. **Global Edge Network** - Baja latencia mundial
2. **Serverless** - Paga por request, no por uptime
3. **Auto-scaling** - Infinito scaling automático
4. **Sin servidor** - Zero mantenimiento
5. **Free tier** - 100K requests/día gratis

### ⚠️ Limitaciones

1. **Cold starts** - ~50ms en el primer request
2. **KV latencia** - ~50-100ms para escrituras
3. **Request timeout** - 30 segundos máximo
4. **No WebSockets** - HTTP request/response only
5. **Crypto limits** - Algunas operaciones pueden ser más lentas

### 🔒 Seguridad

- **JWT Secret**: Nunca hardcodeado, siempre usar `wrangler secret`
- **CORS**: Configurado por defecto
- **HTTPS**: Automático en Workers

## 📊 Comparativa Costos

| Plan | Node.js (VPS) | Cloudflare Workers |
|------|---------------|-------------------|
| Setup | $5-10/mes servidor | $0 (free tier) |
| Requests | Ilimitado | 100K/día gratis |
| Storage | Local disk | KV ($0.50/GB) |
| Escalado | Manual | Automático |

## 🧪 Testing Local

```bash
# Instalar dependencias
npm install

# Preview local
wrangler dev

# Abrir http://localhost:8787
```

## 🔄 Migración desde Node.js

Si tienes datos en el servidor Node.js:

```javascript
// Exportar desde Node.js
const data = fs.readFileSync('./data/users.docs.json');

// Importar a KV (usando wrangler CLI)
wrangler kv:key put --binding=DOC_STORE_KV "users.docs.json" --path=./data/users.docs.json
```

## 📚 Más Información

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [KV Storage](https://developers.cloudflare.com/workers/runtime-apis/kv/)

---

**Nota**: El worker usa el mismo `js-doc-store` core, por lo que todas las queries, índices y aggregation funcionan igual que en Node.js.
