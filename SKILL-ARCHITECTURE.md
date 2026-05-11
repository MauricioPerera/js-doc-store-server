# Skill Registry Architecture (js-doc-store-server)

Este servidor aloja un **registro de skills dinamico** que permite a pi descubrir
capacidades especializadas on-demand en lugar de cargarlas todas desde el filesystem.

## Como funciona

```
Filesystem (solo 1 skill)
└── skill-discovery/SKILL.md   → "Ve a localhost:3000 tabla 'skills'"

js-doc-store-server
└── tabla: skills
    ├── doc-store-server  → content: SKILL.md completo
    ├── vps-management    → content: SKILL.md completo
    ├── github-management → content: SKILL.md completo
    └── (futuras skills)  → content: SKILL.md completo
```

## Flujo de descubrimiento

1. pi inicia conversacion → carga `skill-discovery` del filesystem
2. Usuario pide algo de VPS
3. pi consulta: `POST /admin/query {tableName:"skills", filter:{tags:{$regex:"vps"}}}`
4. Recibe registro con `name`, `version`, `tags`, `description`, `content`
5. pi usa `content` (el SKILL.md completo) como contexto especializado
6. Ejecuta la tarea

## Estructura de la tabla

- `name`: string identificador unico (ej: `vps-management`)
- `version`: semver (ej: `1.1.0`)
- `tags`: string separado por comas para busqueda (`ssh,vps,deploy`)
- `description`: resumen corto para listados
- `content`: texto completo del SKILL.md (4000+ chars OK)

## Registrar una nueva skill

```bash
# 1. Definir la skill como SKILL.md
# 2. Insertar en el registro
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin123!"}' | \
  node -p "JSON.parse(require('fs').readFileSync(0,'utf-8')).token||''")

# Leer contenido del archivo
CONTENT=$(cat ruta/a/nueva-skill/SKILL.md)

# Insertar
curl -s -X POST http://localhost:3000/admin/insert \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tableName": "skills",
    "data": {
      "name": "nueva-skill",
      "version": "1.0.0",
      "tags": "categoria,tag1,tag2",
      "description": "Breve descripcion",
      "content": "'"$CONTENT"'"
    }
  }'
```

## Actualizar skill existente

```bash
curl -s -X POST http://localhost:3000/admin/update \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tableName": "skills",
    "filter": {"name":"vps-management"},
    "update": {"$set":{"version":"1.2.0","content":"NUEVO_CONTENIDO"}}
  }'
```

## Beneficios frente a skills en filesystem

| Aspecto | Filesystem (N archivos) | Registro DB (dinamico) |
|---------|-------------------------|------------------------|
| Descubrimiento | Carga fija al inicio | On-demand por tag/nombre |
| Contexto | Todo cargado siempre | Solo lo necesario |
| Versionado | No hay | Campo `version` nativo |
| Busqueda | Por nombre de archivo solo | Por tags, regex, descripcion |
| Sync multi-sesion | Imposible (archivos locales) | Persistido en `data/` |
| Rollback | N/A | Actualizar `$set` a version anterior |
| Registro nuevo | Crear carpeta + archivo | Solo 1 POST |

## Skills registradas actualmente

| name | version | tags |
|------|---------|------|
| `doc-store-server` | 1.0.0 | database,api,server,crud,jwt,vault,local |
| `vps-management` | 1.1.0 | ssh,vps,server,remote,deploy,infrastructure |
| `github-management` | 1.0.0 | github,git,ci-cd,deploy,repository,gh-cli |
