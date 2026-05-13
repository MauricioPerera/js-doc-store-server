# 📚 API Reference - js-doc-store-server

Complete REST API documentation for js-doc-store-server.

**Base URL**: `https://YOUR_WORKER_SUBDOMAIN.workers.dev`

---

## 📋 Índice

- [Authentication](#authentication)
- [Public Endpoints](#public-endpoints)
- [Admin Endpoints](#admin-endpoints)
- [Vector Search Endpoints](#-vector-search-endpoints-js-vector-store-integration)
- [Vault Endpoints](#vault-endpoints)
- [Connection Metadata Endpoints](#connection-metadata-endpoints)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)

---

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication.

### Getting a Token

1. **Register** a new user: `POST /auth/register`
2. **Login** to get token: `POST /auth/login`
3. **Use** the token in the `Authorization` header:
   ```
   Authorization: Bearer YOUR_JWT_TOKEN
   ```

### Token Lifetime

Tokens are valid for **7 days** by default.

---

## 🌐 Public Endpoints

No authentication required.

### GET /public/tables

List all available tables/collections.

**Request:**
```bash
curl https://YOUR_WORKER_SUBDOMAIN.workers.dev/public/tables
```

**Response:**
```json
{
  "success": true,
  "tables": ["users", "orders", "products"]
}
```

---

### GET /public/query/:tableName

Query a table with public access (limited).

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| tableName | string | Yes | Name of the table |

**Request:**
```bash
curl https://YOUR_WORKER_SUBDOMAIN.workers.dev/public/query/users
```

**Response:**
```json
{
  "success": true,
  "data": [
    {"_id": "abc123", "name": "Alice", "email": "alice@example.com"}
  ]
}
```

---

## 🔑 Authentication Endpoints

### POST /auth/bootstrap

Create the first admin user when the system has no users. This endpoint only works when there are zero registered users in the database.

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "SecureAdminPassword123!",
  "name": "Administrator"
}
```

**Validation Rules:**
- `email`: Valid email format
- `password`: Minimum 6 characters
- `name`: Optional

**Request:**
```bash
curl -X POST https://YOUR_WORKER_SUBDOMAIN.workers.dev/auth/bootstrap \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Admin123!",
    "name": "Administrator"
  }'
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "First admin created",
  "user": {
    "_id": "admin-abc123",
    "email": "admin@example.com",
    "name": "Administrator",
    "roles": ["admin"],
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**Error Response (403):**
```json
{
  "success": false,
  "message": "Users already exist. Use /auth/register instead."
}
```

---

### POST /auth/register

Register a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe"
}
```

**Validation Rules:**
- `email`: Valid email format
- `password`: Minimum 6 characters
- `name`: Optional

**Request:**
```bash
curl -X POST https://YOUR_WORKER_SUBDOMAIN.workers.dev/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "name": "John Doe"
  }'
```

**Success Response (201):**
```json
{
  "success": true,
  "user": {
    "_id": "user-abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "roles": ["user"],
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Email already registered"
}
```

---

### POST /auth/login

Authenticate and get JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Request:**
```bash
curl -X POST https://YOUR_WORKER_SUBDOMAIN.workers.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'
```

**Success Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "_id": "user-abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "roles": ["user"]
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

---

## ⚙️ Admin Endpoints

Require authentication via JWT Bearer token.

### POST /admin/create-table

Create a new table with schema.

**Authentication:** Required (Admin role)

**Request Body:**
```json
{
  "tableName": "contacts",
  "columns": [
    {"name": "Name", "type": "text", "required": true},
    {"name": "Email", "type": "email", "unique": true},
    {"name": "Phone", "type": "phone"},
    {"name": "Status", "type": "select", "options": ["Lead", "Active", "Churned"]},
    {"name": "Revenue", "type": "number", "default": 0}
  ]
}
```

**Column Types:**
- `text` - String values
- `number` - Numeric values
- `checkbox` - Boolean values
- `email` - Validated email strings
- `url` - URL validation
- `phone` - Phone number validation
- `select` - Single choice from options
- `multiselect` - Multiple choices from options
- `relation` - Reference to another table
- `json` - JSON objects
- `attachment` - File URLs
- `autonumber` - Auto-incrementing number

**Request:**
```bash
curl -X POST https://YOUR_WORKER_SUBDOMAIN.workers.dev/admin/create-table \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "tableName": "contacts",
    "columns": [
      {"name": "Name", "type": "text", "required": true},
      {"name": "Email", "type": "email", "unique": true}
    ]
  }'
```

**Success Response:**
```json
{
  "success": true,
  "message": "Table contacts created."
}
```

---

### POST /admin/insert

Insert a document into a table.

**Authentication:** Required

**Request Body:**
```json
{
  "tableName": "contacts",
  "data": {
    "Name": "Alice Smith",
    "Email": "alice@example.com",
    "Phone": "+1 555-1234",
    "Status": "Active"
  }
}
```

**Request:**
```bash
curl -X POST https://YOUR_WORKER_SUBDOMAIN.workers.dev/admin/insert \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "tableName": "contacts",
    "data": {
      "Name": "Alice Smith",
      "Email": "alice@example.com"
    }
  }'
```

**Success Response:**
```json
{
  "success": true,
  "id": "abc123-def456"
}
```

---

### POST /admin/query

Query documents with filters, sort, and limit.

**Authentication:** Required

**Request Body:**
```json
{
  "tableName": "contacts",
  "filter": {"Status": "Active", "Revenue": {"$gte": 1000}},
  "sort": {"Revenue": -1},
  "limit": 10
}
```

**Query Operators:**
- `$eq` - Equal to
- `$ne` - Not equal to
- `$gt` / `$gte` - Greater than (or equal)
- `$lt` / `$lte` - Less than (or equal)
- `$in` - In array
- `$regex` - Regular expression match
- `$exists` - Field exists

**Request:**
```bash
curl -X POST https://YOUR_WORKER_SUBDOMAIN.workers.dev/admin/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "tableName": "contacts",
    "filter": {"Status": "Active"},
    "sort": {"Name": 1},
    "limit": 10
  }'
```

**Success Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "abc123",
      "Name": "Alice Smith",
      "Email": "alice@example.com",
      "Status": "Active",
      "Revenue": 5000
    }
  ]
}
```

---

### POST /admin/update

Update documents matching a filter.

**Authentication:** Required

**Request Body:**
```json
{
  "tableName": "contacts",
  "filter": {"_id": "abc123"},
  "update": {
    "$set": {"Status": "Churned", "Revenue": 0},
    "$inc": {"Visits": 1}
  }
}
```

**Update Operators:**
- `$set` - Set field values
- `$unset` - Remove fields
- `$inc` - Increment/decrement numbers
- `$push` - Add to array
- `$pull` - Remove from array
- `$rename` - Rename field

**Request:**
```bash
curl -X POST https://YOUR_WORKER_SUBDOMAIN.workers.dev/admin/update \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "tableName": "contacts",
    "filter": {"_id": "abc123"},
    "update": {"$set": {"Status": "Churned"}}
  }'
```

**Success Response:**
```json
{
  "success": true
}
```

---

### POST /admin/aggregate

Perform aggregation pipeline operations.

**Authentication:** Required

**Request Body:**
```json
{
  "tableName": "orders",
  "pipeline": [
    {"stage": "match", "params": {"status": "completed"}},
    {"stage": "group", "params": {
      "field": "customerId",
      "accumulators": {
        "totalRevenue": {"$sum": "amount"},
        "orderCount": {"$count": true},
        "avgOrder": {"$avg": "amount"}
      }
    }},
    {"stage": "sort", "params": {"totalRevenue": -1}},
    {"stage": "limit", "params": 10}
  ]
}
```

**Pipeline Stages:**
- `match` - Filter documents
- `lookup` - Join with another collection
- `group` - Group and aggregate
- `sort` - Sort results
- `limit` - Limit results
- `project` - Select fields
- `unwind` - Decompose arrays

**Accumulators:**
- `$count` - Count documents
- `$sum` - Sum of field values
- `$avg` - Average of field values
- `$min` / `$max` - Min/max values
- `$push` - Create array of values

**Request:**
```bash
curl -X POST https://YOUR_WORKER_SUBDOMAIN.workers.dev/admin/aggregate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "tableName": "orders",
    "pipeline": [
      {"stage": "match", "params": {"status": "completed"}},
      {"stage": "group", "params": {
        "field": "customerId",
        "accumulators": {"total": {"$sum": "amount"}}
      }}
    ]
  }'
```

**Success Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "customer-123",
      "total": 15000
    }
  ]
}
```

---

### POST /admin/create-view

Create a saved view (predefined query).

**Authentication:** Required

**Request Body:**
```json
{
  "tableName": "contacts",
  "viewName": "active-vip",
  "filter": {"Status": "Active", "Tags": {"$contains": "VIP"}},
  "sort": {"Revenue": -1},
  "limit": 50
}
```

---

### POST /admin/execute-view

Execute a saved view.

**Authentication:** Required

**Request Body:**
```json
{
  "tableName": "contacts",
  "viewName": "active-vip"
}
```

**Success Response:**
```json
{
  "success": true,
  "data": [...]
}
```

---

### POST /admin/deploy-template

Deploy a table from a predefined template.

**Authentication:** Required (Admin)

**Templates Available:**
- `crm` - CRM with Name, Email, Phone, Status, Revenue, etc.
- `tasks` - Task management with Title, Status, Priority, DueDate, etc.
- `inventory` - Inventory with SKU, Name, Category, Price, Stock, etc.
- `content` - Content management with Title, Body, Author, Status, etc.

**Request Body:**
```json
{
  "tableName": "my-crm",
  "templateName": "crm"
}
```

---

### POST /admin/assign-role

Assign a role to a user (Admin only).

**Authentication:** Required (Admin role)

**Request Body:**
```json
{
  "userId": "user-abc123",
  "role": "admin"
}
```

**Roles:**
- `user` - Default role
- `admin` - Full access

---

## 🔍 Vector Search Endpoints (js-vector-store integration)

Semantic search with embeddings. Supports multiple store types: `float32`, `int8`, `binary`, and `polar`.

### Store Types Comparison

| Store | Bytes/vec (768d) | Compression | Recall@5 | Best For |
|-------|------------------|-------------|----------|----------|
| `float32` | 3,072 | 1x | 100% | Maximum precision |
| `int8` | 776 | 4x | 100% | Balance |
| `binary` | 96 | **32x** | 85% | Maximum compression |
| `polar` | 144 | 21x | 100% | **Best trade-off** |

---

### POST /admin/vector/index

Index a document with its embedding vector.

**Authentication:** Required

**Request Body:**
```json
{
  "collection": "articles",
  "id": "article-123",
  "vector": [0.1, -0.2, 0.3, ...],
  "text": "Article content for BM25 indexing",
  "metadata": { "title": "AI in Healthcare", "author": "John Doe" }
}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| collection | string | No | Collection name (default: "default") |
| id | string | Yes | Document ID |
| vector | number[] | Yes | Embedding array (768 dimensions) |
| text | string | No | Text for BM25 hybrid indexing |
| metadata | object | No | Additional metadata |

---

### POST /admin/vector/batch

Batch index multiple vectors.

**Authentication:** Required

**Request Body:**
```json
{
  "collection": "articles",
  "vectors": [
    { "id": "doc-1", "vector": [0.1, -0.2, ...], "metadata": { "title": "Doc 1" } },
    { "id": "doc-2", "vector": [0.3, -0.1, ...], "metadata": { "title": "Doc 2" } }
  ]
}
```

---

### POST /admin/vector/search

Semantic vector search.

**Authentication:** Required

**Request Body:**
```json
{
  "collection": "articles",
  "vector": [0.1, -0.2, 0.3, ...],
  "limit": 10,
  "metric": "cosine",
  "weights": [0.7, 0.3]
}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| collection | string | No | Collection name (default: "default") |
| vector | number[] | Yes | Query embedding |
| limit | number | No | Max results (default: 10) |
| metric | string | No | `cosine`\|`euclidean`\|`dotProduct`\|`manhattan` |
| weights | number[] | No | Weights for hybrid search [vectorWeight, textWeight] (default: [0.7, 0.3]) |

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": "article-123", "score": 0.92, "metadata": { "title": "AI in Healthcare" } },
    { "id": "article-456", "score": 0.87, "metadata": { "title": "Medical AI" } }
  ]
}
```

---

### POST /admin/vector/search-hybrid

Hybrid search combining vector similarity + BM25 text relevance.

**Authentication:** Required

**Request Body:**
```json
{
  "collection": "articles",
  "vector": [0.1, -0.2, 0.3, ...],
  "text": "artificial intelligence in medicine",
  "limit": 10,
  "mode": "rrf",
  "weights": [0.6, 0.4]
}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| mode | string | No | `rrf` (Reciprocal Rank Fusion) or `weighted` |
| weights | number[] | No | Weights for hybrid search [vectorWeight, textWeight] (default: [0.7, 0.3]) |

---

### POST /admin/vector/search-cross

Cross-collection search with score normalization.

**Authentication:** Required

**Request Body:**
```json
{
  "collections": ["articles", "products", "docs"],
  "vector": [0.1, -0.2, 0.3, ...],
  "limit": 10
}
```

---

### GET /admin/vector/collections

List all vector collections with document counts.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "collections": [
    { "name": "articles", "count": 1543 },
    { "name": "products", "count": 892 }
  ]
}
```

---

### GET /admin/vector/stats

Vector store statistics and configuration.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "config": {
    "dimensions": 768,
    "storeType": "binary"
  },
  "collections": ["articles", "products"],
  "stats": { ... }
}
```

---

### DELETE /admin/vector/:collection/:id

Remove a vector from the index.

**Authentication:** Required

**Example:**
```bash
curl -X DELETE https://YOUR_WORKER_SUBDOMAIN.workers.dev/admin/vector/articles/article-123 \
  -H "Authorization: Bearer $TOKEN"
```

---

### POST /admin/vector/drop

Delete an entire vector collection.

**Authentication:** Required

**Request Body:**
```json
{
  "collection": "articles"
}
```

---

### GET /admin/vector/:collection/:id

Get a specific vector by ID.

**Authentication:** Required

**Example:**
```bash
curl https://YOUR_WORKER_SUBDOMAIN.workers.dev/admin/vector/articles/article-123 \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "success": true,
  "id": "article-123",
  "vector": [0.1, -0.2, 0.3, ...],
  "metadata": { "title": "AI in Healthcare" }
}
```

---

## 🤖 Embedding Endpoints (Google Gemma 300M)

Automatic text-to-vector generation using Cloudflare AI with Google's Gemma 300M model. Supports Matryoshka embeddings (configurable dimensions: 64-2048).

### POST /admin/embed

Generate embeddings for any text.

**Authentication:** Required

**Request Body:**
```json
{
  "text": "Machine learning is a subset of artificial intelligence",
  "dimensions": 768
}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| text | string | Yes | Text to embed |
| dimensions | number | No | Output dimensions: 64, 256, 768, or 2048 (default: 768) |

**Request:**
```bash
curl -X POST https://YOUR_WORKER_SUBDOMAIN.workers.dev/admin/embed \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Machine learning is a subset of AI",
    "dimensions": 768
  }'
```

**Response:**
```json
{
  "success": true,
  "model": "@cf/google/embeddinggemma-300m",
  "dimensions": 768,
  "embedding": [-0.0748, 0.0031, 0.0182, ...]
}
```

---

### POST /admin/vector/index-with-text

Index a document with auto-generated embedding from text content.

**Authentication:** Required

**Request Body:**
```json
{
  "collection": "documents",
  "id": "doc-123",
  "text": "This is the document content to be embedded",
  "doc": { "content": "This is the document content...", "category": "tech", "author": "John" },
  "metadata": { "category": "tech", "author": "John" },
  "dimensions": 768
}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| collection | string | No | Collection name (default: "default") |
| id | string | Yes | Document ID |
| text | string | Yes | Text content to embed (if not providing doc) |
| doc | object | Yes | Document to extract text from (if not providing text) |
| metadata | object | No | Additional metadata |
| dimensions | number | No | Embedding dimensions (default: 768) |

**Request:**
```bash
curl -X POST https://YOUR_WORKER_SUBDOMAIN.workers.dev/admin/vector/index-with-text \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "collection": "articles",
    "id": "article-123",
    "text": "Transformers revolutionized NLP...",
    "metadata": { "author": "John", "category": "AI" },
    "dimensions": 768
  }'
```

**Response:**
```json
{
  "success": true,
  "id": "article-123",
  "textLength": 32,
  "embeddingDimensions": 768,
  "model": "@cf/google/embeddinggemma-300m"
}
```

---

### POST /admin/vector/search-by-text

Search vectors using natural language query (auto-embeds the query text).

**Authentication:** Required

**Request Body:**
```json
{
  "collection": "documents",
  "query": "artificial intelligence research",
  "limit": 10,
  "dimensions": 768,
  "metric": "cosine"
}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| collection | string | No | Collection name (default: "default") |
| query | string | Yes | Natural language query |
| limit | number | No | Max results (default: 10) |
| dimensions | number | No | Query embedding dimensions (default: 768) |
| metric | string | No | Distance metric: `cosine`, `euclidean`, `dotProduct` |

**Request:**
```bash
curl -X POST https://YOUR_WORKER_SUBDOMAIN.workers.dev/admin/vector/search-by-text \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "collection": "articles",
    "query": "neural network architecture",
    "limit": 5,
    "dimensions": 768
  }'
```

**Response:**
```json
{
  "success": true,
  "query": "neural network architecture",
  "embeddingDimensions": 768,
  "results": [
    { "id": "article-123", "score": 0.92, "metadata": { "title": "Transformers in NLP" } },
    { "id": "article-456", "score": 0.87, "metadata": { "title": "Deep Learning Basics" } }
  ]
}
```

---

### POST /admin/vector/batch-index-with-text

Batch index multiple documents with auto-generated embeddings.

**Authentication:** Required

**Request Body:**
```json
{
  "collection": "articles",
  "documents": [
    { "id": "1", "text": "First article text...", "author": "Alice" },
    { "id": "2", "text": "Second article text...", "author": "Bob" }
  ],
  "dimensions": 768
}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| collection | string | No | Collection name (default: "default") |
| documents | array | Yes | Array of documents with ids and text fields |
| dimensions | number | No | Embedding dimensions (default: 768) |

**Request:**
```bash
curl -X POST https://YOUR_WORKER_SUBDOMAIN.workers.dev/admin/vector/batch-index-with-text \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "collection": "articles",
    "documents": [
      { "id": "doc-1", "text": "Machine learning basics...", "category": "AI" },
      { "id": "doc-2", "text": "Deep learning explained...", "category": "AI" }
    ],
    "dimensions": 768
  }'
```

**Response:**
```json
{
  "success": true,
  "indexed": 2,
  "collection": "articles",
  "dimensions": 768
}
```

---

## 🔒 Vault Endpoints

Secure secret storage.

### POST /admin/vault/add

Store a secret in the vault.

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "secretId": "stripe-api-key",
  "secretValue": "sk_live_abc123...",
  "label": "Stripe Production Key"
}
```

---

### GET /admin/vault/list

List all secrets (without values).

**Authentication:** Required (Admin)

**Response:**
```json
{
  "success": true,
  "secrets": [
    {"_id": "stripe-api-key", "label": "Stripe Production Key", "createdAt": "2024-01-15T10:30:00Z"}
  ]
}
```

---

### POST /admin/vault/get

Get a secret value (decrypted).

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "secretId": "stripe-api-key"
}
```

**Request:**
```bash
curl -X POST https://YOUR_WORKER_SUBDOMAIN.workers.dev/admin/vault/get \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "secretId": "stripe-api-key"
  }'
```

**Success Response:**
```json
{
  "success": true,
  "secretId": "stripe-api-key",
  "label": "Stripe Production Key",
  "value": "sk_live_abc123..."
}
```

---

### POST /admin/vault/execute

Execute an HTTP request using a stored secret.

**Authentication:** Required

**Request Body:**
```json
{
  "secretId": "stripe-api-key",
  "url": "https://api.stripe.com/v1/customers",
  "method": "GET",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {},
  "headerType": "bearer"
}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| secretId | string | Yes | ID of the stored secret |
| url | string | Yes | Target URL |
| method | string | Yes | HTTP method: GET, POST, PUT, DELETE, etc. |
| headers | object | No | Additional headers to include |
| body | object/string | No | Request body |
| headerType | string | No | How to send the secret (default: "bearer") |

**Header Types:**
- `bearer` - Sends as `Authorization: Bearer {secret}`
- `basic` - Sends as `Authorization: Basic {base64(secret)}`
- `header` - Sends in custom header (requires `headerName`)
- `query` - Sends as query parameter (requires `paramName`)
- `body` - Includes in request body

**Example with headerType:**
```bash
# Bearer token (default)
curl -X POST https://YOUR_WORKER_SUBDOMAIN.workers.dev/admin/vault/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "secretId": "api-key",
    "url": "https://api.example.com/data",
    "method": "GET",
    "headerType": "bearer"
  }'

# Custom header
curl -X POST https://YOUR_WORKER_SUBDOMAIN.workers.dev/admin/vault/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "secretId": "x-api-key",
    "url": "https://api.example.com/data",
    "method": "GET",
    "headerType": "header",
    "headerName": "X-API-Key"
  }'

# Query parameter
curl -X POST https://YOUR_WORKER_SUBDOMAIN.workers.dev/admin/vault/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "secretId": "token",
    "url": "https://api.example.com/data",
    "method": "GET",
    "headerType": "query",
    "paramName": "api_key"
  }'
```

---

## 🔗 Connection Metadata Endpoints

Manage VPS/Server connection credentials.

### POST /admin/connections/register

Register a new connection.

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "name": "production-server",
  "host": "192.168.1.100",
  "port": 22,
  "username": "admin",
  "vaultSecretId": "ssh-key-production",
  "label": "Production SSH Key"
}
```

**Request:**
```bash
curl -X POST https://YOUR_WORKER_SUBDOMAIN.workers.dev/admin/connections/register \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "production-server",
    "host": "192.168.1.100",
    "port": 22,
    "username": "admin",
    "vaultSecretId": "ssh-key-production",
    "label": "Production SSH Key"
  }'
```

**Success Response:**
```json
{
  "success": true,
  "message": "Connection registered"
}
```

---

### POST /admin/connections/list

List all registered connections.

**Authentication:** Required (Admin)

**Response:**
```json
{
  "success": true,
  "connections": [
    {
      "name": "production-server",
      "host": "192.168.1.100",
      "port": 22,
      "username": "admin",
      "label": "Production SSH Key",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

## ⚠️ Error Handling

All errors follow this format:

```json
{
  "success": false,
  "message": "Description of the error"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid/missing token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 500 | Internal Server Error |

---

**Last Updated**: 2024-05-13
**Version**: 1.2.0