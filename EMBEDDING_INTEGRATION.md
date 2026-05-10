# Embedding Integration Guide

## Overview

The js-doc-store-server now integrates with Google's Gemma Embedding model for automatic vector generation. This enables semantic search capabilities directly from text.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Client Request │────▶│  doc-store-server │────▶│  Cloudflare AI  │
│  (text query)   │     │  (embedding logic) │     │  (Gemma 300M)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                 │
                                 ▼
                          ┌──────────────────┐
                          │  Vector Store    │
                          │  (KV Storage)    │
                          └──────────────────┘
```

## New Endpoints

### 1. POST /admin/embed
Generate embeddings for any text.

**Request:**
```bash
curl -X POST https://js-doc-store-server.rckflr.workers.dev/admin/embed \
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

### 2. POST /admin/vector/index-with-text
Index a document with auto-generated embedding.

**Request:**
```bash
curl -X POST https://js-doc-store-server.rckflr.workers.dev/admin/vector/index-with-text \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "collection": "documents",
    "id": "doc-123",
    "text": "This is the document content to be embedded",
    "metadata": { "category": "tech" },
    "dimensions": 768
  }'
```

### 3. POST /admin/vector/search-by-text
Search vectors using natural language (auto-embeds the query).

**Request:**
```bash
curl -X POST https://js-doc-store-server.rckflr.workers.dev/admin/vector/search-by-text \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "collection": "documents",
    "query": "artificial intelligence research",
    "limit": 10,
    "dimensions": 768
  }'
```

### 4. POST /admin/vector/batch-index-with-text
Batch index multiple documents with embeddings.

**Request:**
```bash
curl -X POST https://js-doc-store-server.rckflr.workers.dev/admin/vector/batch-index-with-text \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "collection": "articles",
    "textField": "content",
    "documents": [
      { "id": "1", "content": "First article text..." },
      { "id": "2", "content": "Second article text..." }
    ]
  }'
```

## Configuration

### Cloudflare Workers (Recommended)

The worker uses Cloudflare's native AI binding for direct model access:

```toml
# wrangler.toml
[ai]
binding = "AI"
```

**Benefits:**
- No external API calls
- Lower latency (~50-100ms)
- No rate limiting issues
- Built-in security

### Local/Express Server

For local development, the server can use the external embedding worker:

```bash
# Set environment variables
export EMBEDDING_WORKER_URL="https://gemma-embedding-worker.YOUR_SUBDOMAIN.workers.dev"
export EMBEDDING_API_KEY="your-secret-api-key"

# Or use the local embedding worker
cd workers-ai && node gemma-embedding-worker.js
```

## Matryoshka Embeddings

Support for configurable dimensions (truncating from 2048):

| Dimensions | Use Case | Speed | Precision |
|------------|----------|-------|-----------|
| 64 | Mobile/Edge | ⚡⚡⚡ | ⭐⭐ |
| 256 | Web apps | ⚡⚡⚡ | ⭐⭐⭐ |
| 768 | Standard search | ⚡⚡ | ⭐⭐⭐⭐ |
| 2048 | Maximum quality | ⚡ | ⭐⭐⭐⭐⭐ |

## Multilingual Support

Gemma embeddings support 100+ languages:
- English, Spanish, French, German
- Chinese, Japanese, Korean
- Arabic, Hindi, Portuguese
- And many more...

## Example Workflow

```javascript
// 1. Index a document with embedding
const indexRes = await fetch(`${API}/admin/vector/index-with-text`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    collection: 'articles',
    id: 'article-123',
    text: 'Transformers revolutionized NLP...',
    metadata: { author: 'John', category: 'AI' }
  })
});

// 2. Search with natural language
const searchRes = await fetch(`${API}/admin/vector/search-by-text`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    collection: 'articles',
    query: 'neural network architecture',
    limit: 5
  })
});

const results = await searchRes.json();
// Returns top 5 semantically similar articles
```

## Testing

Run the embedding integration tests:

```bash
# Test all embedding endpoints
node test_embedding_integration.js

# Test direct integration
node test_direct_integration.js
```

## Files

- `cloudflare-worker.js` - Main worker with embedding endpoints
- `server.js` - Express server with same endpoints
- `workers-ai/gemma-embedding-worker.js` - Standalone embedding worker (optional)

## Security

- All embedding endpoints require admin authentication
- API keys are stored as Cloudflare secrets
- The standalone embedding worker is protected by API key

## Cost

Using Cloudflare AI binding:
- Free tier: 100,000 requests/day
- No additional cost for embeddings

Using external worker:
- Subject to Cloudflare Workers pricing
- Embedding worker API key required
