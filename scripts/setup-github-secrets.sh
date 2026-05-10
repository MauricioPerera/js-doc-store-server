#!/bin/bash
# Setup GitHub Actions Secrets
# This script helps configure the required secrets for CI/CD

echo "══════════════════════════════════════════════════"
echo "   GitHub Actions Secrets Setup"
echo "══════════════════════════════════════════════════"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed"
    echo "   Install from: https://cli.github.com/"
    exit 1
fi

# Check authentication
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub CLI"
    echo "   Run: gh auth login"
    exit 1
fi

REPO=$(git remote get-url origin 2>/dev/null | sed 's/.*github.com[:/]\(.*\)\.git/\1/')
if [ -z "$REPO" ]; then
    echo "❌ Could not detect GitHub repository"
    echo "   Make sure you're in a git repository with GitHub remote"
    exit 1
fi

echo "Repository: $REPO"
echo ""

# Function to set secret
set_secret() {
    local name=$1
    local value=$2

    if [ -z "$value" ]; then
        echo "⚠️  Skipping $name (empty value)"
        return
    fi

    echo "$value" | gh secret set "$name" -R "$REPO"
    if [ $? -eq 0 ]; then
        echo "✅ Set $name"
    else
        echo "❌ Failed to set $name"
    fi
}

echo "Required secrets:"
echo "  1. CLOUDFLARE_API_TOKEN - For deploying to Cloudflare"
echo "  2. CLOUDFLARE_ACCOUNT_ID - Your Cloudflare account ID"
echo "  3. API_URL - Your worker URL (for tests)"
echo "  4. ADMIN_EMAIL - Test admin email"
echo "  5. ADMIN_PASSWORD - Test admin password"
echo ""

read -p "Do you want to set up secrets now? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Enter your secrets:"
echo ""

# Get Cloudflare API Token
echo "1. CLOUDFLARE_API_TOKEN"
echo "   Create at: https://dash.cloudflare.com/profile/api-tokens"
echo "   Required permissions: Cloudflare Workers (Edit)"
read -s -p "   Token: " CF_TOKEN
echo ""
set_secret "CLOUDFLARE_API_TOKEN" "$CF_TOKEN"

# Get Cloudflare Account ID
echo ""
echo "2. CLOUDFLARE_ACCOUNT_ID"
echo "   Find in: https://dash.cloudflare.com/ (right sidebar)"
read -p "   Account ID: " CF_ACCOUNT
echo ""
set_secret "CLOUDFLARE_ACCOUNT_ID" "$CF_ACCOUNT"

# Get API URL
echo ""
echo "3. API_URL"
echo "   Your deployed worker URL"
echo "   Example: https://doc-store-api-prod.YOUR_SUBDOMAIN.workers.dev"
read -p "   API URL: " API_URL
echo ""
set_secret "API_URL" "$API_URL"

# Get Admin Email
echo ""
echo "4. ADMIN_EMAIL"
echo "   Test admin email for CI tests"
read -p "   Email [admin@example.com]: " ADMIN_EMAIL
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@example.com}
echo ""
set_secret "ADMIN_EMAIL" "$ADMIN_EMAIL"

# Get Admin Password
echo ""
echo "5. ADMIN_PASSWORD"
echo "   Test admin password for CI tests"
read -s -p "   Password: " ADMIN_PASSWORD
echo ""
set_secret "ADMIN_PASSWORD" "$ADMIN_PASSWORD"

echo ""
echo "══════════════════════════════════════════════════"
echo "   Setup Complete!"
echo "══════════════════════════════════════════════════"
echo ""
echo "Secrets configured:"
echo "  ✅ CLOUDFLARE_API_TOKEN"
echo "  ✅ CLOUDFLARE_ACCOUNT_ID"
echo "  ✅ API_URL"
echo "  ✅ ADMIN_EMAIL"
echo "  ✅ ADMIN_PASSWORD"
echo ""
echo "You can verify at:"
echo "  https://github.com/$REPO/settings/secrets/actions"
echo ""
echo "The next push to master will trigger CI/CD."
