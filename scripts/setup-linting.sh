#!/bin/bash
# setup-linting.sh
# Run this script to set up strict TypeScript linting in your project

set -e

echo "🔧 Setting up TypeScript strict linting configuration..."

# Check for package manager
if [ -f "pnpm-lock.yaml" ]; then
    PKG_MGR="pnpm"
elif [ -f "yarn.lock" ]; then
    PKG_MGR="yarn"
elif [ -f "bun.lockb" ]; then
    PKG_MGR="bun"
else
    PKG_MGR="npm"
fi

echo "📦 Using $PKG_MGR as package manager"

# Install dependencies
echo "📥 Installing dependencies..."
$PKG_MGR install -w --save-dev \
    @eslint/js \
    @types/node \
    eslint \
    eslint-import-resolver-typescript \
    eslint-plugin-import \
    eslint-plugin-promise \
    eslint-plugin-security \
    eslint-plugin-sonarjs \
    eslint-plugin-unicorn \
    jiti \
    typescript \
    typescript-eslint \
    prettier \
    eslint-config-prettier

# Optional: Set up husky and lint-staged
read -p "🪝 Set up pre-commit hooks with husky? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Installing husky and lint-staged..."
    $PKG_MGR install -w --save-dev husky lint-staged
    npx husky init
    echo 'npx lint-staged' > .husky/pre-commit
    echo "✅ Pre-commit hooks configured"
fi

# Add scripts to package.json
echo "📝 Adding scripts to package.json..."
npx json -I -f package.json -e '
this.scripts = this.scripts || {};
this.scripts.lint = "eslint . --cache";
this.scripts["lint:fix"] = "eslint . --fix --cache";
this.scripts["lint:strict"] = "eslint . --max-warnings=0";
this.scripts.typecheck = "tsc --noEmit";
this.scripts.check = "npm run typecheck && npm run lint";
this.scripts["check:fix"] = "npm run typecheck && npm run lint:fix";
this.scripts.format = "prettier --write .";
'

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Copy eslint.config.ts to your project root"
echo "   2. Copy tsconfig.json to your project root (or merge with existing)"
echo "   3. Copy .prettierrc.json to your project root"
echo "   4. Copy .vscode/settings.json for editor integration"
echo ""
echo "🚀 Run 'npm run check' to verify your setup"