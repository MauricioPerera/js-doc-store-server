# 🚀 Deploy en Cloudflare Workers - Guía Completa

## 📋 Pre-requisitos

- Cuenta de Cloudflare (gratis)
- Node.js instalado
- Terminal/Bash

## ⚡ Deploy Rápido (5 minutos)

### Opción 1: Script Automatizado

```bash
# Clonar repo
git clone https://github.com/MauricioPerera/js-doc-store-server.git
cd js-doc-store-server

# Ejecutar script de deploy
chmod +x deploy-cloudflare.sh
./deploy-cloudflare.sh
```

### Opción 2: Manual Paso a Paso

#### Paso 1: Instalar dependencias
```bash
npm install
```

#### Paso 2: Instalar Wrangler CLI
```bash
npm install -g wrangler
```

#### Paso 3: Login en Cloudflare
```bash
wrangler login
```

#### Paso 4: Crear KV Namespace
```bash
wrangler kv:namespace create "DOC_STORE_KV"
```

**Copia el ID que te muestra** y actualiza `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "DOC_STORE_KV"
id = "TU_ID_AQUI"  # ← Reemplazar
```

#### Paso 5: Configurar JWT Secret
```bash
wrangler secret put JWT_SECRET
# Ingresa un string aleatorio seguro (mínimo 32 caracteres)
```

#### Paso 6: Deploy
```bash
wrangler deploy
```

✅ **Listo!** Tu API estará en:
```
https://js-doc-store-server.TU_SUBDOMAIN.workers.dev
```

---

## 🧪 Test del Deploy

```bash
# Verificar que responde
curl https://js-doc-store-server.TU_SUBDOMAIN.workers.dev/public/tables

# Respuesta esperada:
# {"success":true,"tables":[]}
```

---

## 📊 Monitoreo

### Ver logs en tiempo real
```bash
wrangler tail
```

### Ver métricas
```bash
wrangler deployment list
```

### Actualizar deploy
```bash
# Después de hacer cambios:
wrangler deploy
```

---

## 🔧 Configuración Avanzada

### Variables de entorno adicionales
```bash
# Para producción
wrangler secret put DB_ENCRYPTION_KEY
```

### Dominio personalizado
1. Ve a Cloudflare Dashboard
2. Workers & Pages → js-doc-store-server
3. Settings → Domains & Routes
4. Add Custom Domain

### Rate limiting (recomendado)
En tu dashboard de Cloudflare, activa:
- Bot Management
- Rate Limiting Rules

---

## 💡 Troubleshooting

### Error: "KV namespace not found"
Asegúrate de haber reemplazado el ID en `wrangler.toml`

### Error: "JWT_SECRET not set"
Ejecuta: `wrangler secret put JWT_SECRET`

### Error: "Cannot resolve module"
Verifica que tengas `type: "module"` en package.json o usa `.mjs`

---

## 📚 Recursos

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Pricing](https://developers.cloudflare.com/workers/platform/pricing/)

**Costo: $0/mes (Free Tier)**
