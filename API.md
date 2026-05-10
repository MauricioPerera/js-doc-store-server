# 📚 API Reference - js-doc-store-server

Complete REST API documentation for js-doc-store-server.

**Base URL**: `https://js-doc-store-server.rckflr.workers.dev`

---

## 📋 Índice

- [Authentication](#authentication)
- [Public Endpoints](#public-endpoints)
- [Admin Endpoints](#admin-endpoints)
- [Vault Endpoints](#vault-endpoints)
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
curl https://js-doc-store-server.rckflr.workers.dev/public/tables
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
curl https://js-doc-store-server.rckflr.workers.dev/public/query/users
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
curl -X POST https://js-doc-store-server.rckflr.workers.dev/auth/register \
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
curl -X POST https://js-doc-store-server.rckflr.workers.dev/auth/login \
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
curl -X POST https://js-doc-store-server.rckflr.workers.dev/admin/create-table \
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
curl -X POST https://js-doc-store-server.rckflr.workers.dev/admin/insert \
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
curl -X POST https://js-doc-store-server.rckflr.workers.dev/admin/query \
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
curl -X POST https://js-doc-store-server.rckflr.workers.dev/admin/update \
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
curl -X POST https://js-doc-store-server.rckflr.workers.dev/admin/aggregate \
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

### POST /admin/vault/execute

Execute an HTTP request using a stored secret.

**Authentication:** Required

**Request Body:**
```json
{
  "secretId": "stripe-api-key",
  "url": "https://api.stripe.com/v1/customers",
  "method": "GET",
  "body": {}
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

## 🚦 Rate Limits

### Cloudflare Free Tier
- 100,000 requests/day
- 1,000 writes/day
- 1 GB storage

### Best Practices
1. Use batch operations when possible
2. Cache results client-side
3. Implement retry logic with exponential backoff

---

## 📝 Examples

### Complete CRUD Flow

```bash
# 1. Login
TOKEN=$(curl -s -X POST https://js-doc-store-server.rckflr.workers.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' | jq -r '.token')

# 2. Create table
curl -X POST https://js-doc-store-server.rckflr.workers.dev/admin/create-table \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tableName":"products","columns":[{"name":"Name","type":"text","required":true}]}'

# 3. Insert document
curl -X POST https://js-doc-store-server.rckflr.workers.dev/admin/insert \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tableName":"products","data":{"Name":"Laptop"}}'

# 4. Query
curl -X POST https://js-doc-store-server.rckflr.workers.dev/admin/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tableName":"products","filter":{}}'
```

---

**Last Updated**: 2024
**Version**: 1.0.0
