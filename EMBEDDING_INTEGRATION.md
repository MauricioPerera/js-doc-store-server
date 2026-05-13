### 4. POST /admin/vector/batch-index-with-text
Batch index multiple documents with embeddings.

**Request:**
```bash
curl -X POST https://YOUR_WORKER_SUBDOMAIN.workers.dev/admin/vector/batch-index-with-text \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "collection": "articles",
    "documents": [
      { "id": "1", "text": "First article text..." },
      { "id": "2", "text": "Second article text..." }
    ]
  }'
```