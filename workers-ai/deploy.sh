#!/bin/bash
# Deploy script for Gemma Embedding Worker

set -e

echo "══════════════════════════════════════════════════"
echo "   🚀 Gemma Embedding Worker Deploy Script"
echo "══════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${YELLOW}⚠️  Wrangler not found. Installing...${NC}"
    npm install -g wrangler
fi

# Check login
echo "🔐 Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in. Running wrangler login...${NC}"
    wrangler login
fi

echo -e "${GREEN}✅ Authenticated with Cloudflare${NC}"
echo ""

# Deploy
echo "📦 Deploying Gemma Embedding Worker..."
wrangler deploy

echo ""
echo -e "${GREEN}══════════════════════════════════════════════════"
echo "   ✅ DEPLOYMENT SUCCESSFUL!"
echo "══════════════════════════════════════════════════${NC}"
echo ""
echo "Your embedding API is now live!"
echo ""
echo "Quick test:"
echo '  curl -X POST https://gemma-embedding-worker.YOUR_SUBDOMAIN.workers.dev/embed \'
echo '    -H "Content-Type: application/json" \'
echo '    -d \'{"text": "Hello world", "dimensions": 768}\''
echo ""
echo "For more examples, see README.md"
