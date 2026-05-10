#!/bin/bash
# Deploy script for Cloudflare Workers
# Usage: ./deploy-cloudflare.sh

set -e

echo "══════════════════════════════════════════════════"
echo "   🚀 Cloudflare Workers Deploy Script"
echo "══════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

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

# Step 1: Install dependencies
echo "📦 Step 1: Installing dependencies..."
npm install

# Step 2: Create KV Namespace
echo ""
echo "📦 Step 2: Creating KV Namespace..."
echo -e "${YELLOW}Note: If you already have a KV namespace, you can skip this step${NC}"
read -p "Create new KV namespace? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Creating KV namespace 'DOC_STORE_KV'..."
    wrangler kv:namespace create "DOC_STORE_KV"
    echo -e "${GREEN}✅ KV namespace created${NC}"
    echo -e "${YELLOW}⚠️  IMPORTANT: Update wrangler.toml with the KV ID shown above${NC}"
    echo "   Edit wrangler.toml and replace 'YOUR_KV_NAMESPACE_ID_HERE'"
    echo ""
    read -p "Have you updated wrangler.toml with the KV ID? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}⚠️  Please update wrangler.toml and run this script again${NC}"
        exit 0
    fi
else
    echo -e "${YELLOW}⚠️  Make sure wrangler.toml has your KV namespace ID${NC}"
fi

# Step 3: Set JWT Secret
echo ""
echo "📦 Step 3: Setting JWT Secret..."
if ! wrangler secret list | grep -q JWT_SECRET; then
    echo -e "${YELLOW}Enter your JWT secret (generate a secure random string):${NC}"
    wrangler secret put JWT_SECRET
    echo -e "${GREEN}✅ JWT_SECRET configured${NC}"
else
    echo -e "${GREEN}✅ JWT_SECRET already exists${NC}"
fi

# Step 4: Deploy
echo ""
echo "📦 Step 4: Deploying to Cloudflare..."
read -p "Ready to deploy? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    wrangler deploy
    echo ""
    echo -e "${GREEN}══════════════════════════════════════════════════"
    echo "   ✅ DEPLOYMENT SUCCESSFUL!"
    echo "══════════════════════════════════════════════════${NC}"
    echo ""
    echo "Your API is now live at:"
    echo "  https://js-doc-store-server.YOUR_SUBDOMAIN.workers.dev"
    echo ""
    echo "══════════════════════════════════════════════════"
    echo "   FIRST-TIME SETUP:"
    echo "══════════════════════════════════════════════════"
    echo ""
    echo "1. Create first admin user (bootstrap):"
    echo "   curl -X POST https://js-doc-store-server.YOUR_SUBDOMAIN.workers.dev/auth/bootstrap \\"
    echo "     -H 'Content-Type: application/json' \\"
    echo "     -d '{"email": "admin@example.com", "password": "securepassword", "name": "Admin"}'"
    echo ""
    echo "2. Login to get token:"
    echo "   curl -X POST https://js-doc-store-server.YOUR_SUBDOMAIN.workers.dev/auth/login \\"
    echo "     -H 'Content-Type: application/json' \\"
    echo "     -d '{"email": "admin@example.com", "password": "securepassword"}'"
    echo ""
    echo "3. Test with token:"
    echo "   curl https://js-doc-store-server.YOUR_SUBDOMAIN.workers.dev/admin/vector/stats \\"
    echo "     -H 'Authorization: Bearer YOUR_TOKEN_HERE'"
    echo ""
else
    echo -e "${YELLOW}⚠️  Deploy cancelled${NC}"
fi
