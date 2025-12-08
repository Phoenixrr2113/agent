# Contributing to AI Agent Platform

Thank you for your interest in contributing! We welcome contributions from everyone. This document provides guidelines for developing in our monorepo.

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior via GitHub issues.

## How to Contribute

There are many ways to contribute to AI Agent Platform:

- 🐛 **Report bugs** via [GitHub Issues](https://github.com/Phoenixrr2113/agent/issues/new?template=bug_report.yml)
- 💡 **Suggest features** via [GitHub Issues](https://github.com/Phoenixrr2113/agent/issues/new?template=feature_request.yml)
- 📝 **Improve documentation** by submitting PRs
- 🔧 **Fix bugs** or implement features
- ❓ **Answer questions** in [GitHub Discussions](https://github.com/Phoenixrr2113/agent/discussions)
- ⭐ **Star the project** to show your support

## Getting Help

- 📖 Read the [README](README.md) for project overview
- 🏗️ Check [ARCHITECTURE.md](docs/ARCHITECTURE.md) for design details
- 💬 Ask questions in [GitHub Discussions](https://github.com/Phoenixrr2113/agent/discussions)
- 🐛 Search [existing issues](https://github.com/Phoenixrr2113/agent/issues) before creating new ones

## Prerequisites

- **Node.js** 20+ (required)
- **pnpm** 8+ (required)
- **Git** for version control

## Getting Started

### 1. Fork and Clone

For external contributors:

```bash
# Fork the repository on GitHub first, then:
git clone https://github.com/YOUR_USERNAME/agent.git
cd agent
pnpm install
```

For maintainers or direct access:

```bash
git clone https://github.com/Phoenixrr2113/agent.git
cd agent
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your API keys:
- **Required**: `OPENROUTER_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`
- **Optional**: `BRAVE_API_KEY`, `TAVILY_API_KEY`

### 3. Build

```bash
pnpm build
```

### 4. Verify Setup

```bash
# Run interactive chat
pnpm chat

# Or start HTTP server
pnpm server
```

## Monorepo Structure

```
agent-platform/
├── packages/
│   ├── shared/         # Base utilities (logger, performance)
│   ├── core/           # Agent runtime engine
│   └── server/         # HTTP API server
├── apps/
│   └── cli/            # CLI applications
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

### Package Dependencies

```
@agent/shared (no dependencies)
    ↓
@agent/core (depends on: @agent/shared)
    ↓
@agent/server (depends on: @agent/core, @agent/shared)
    ↓
@agent/cli (depends on: @agent/core, @agent/server, @agent/shared)
```

## Development Workflow

### Making Changes

1. **Create a branch** for your changes
2. **Make your changes** to the appropriate package
3. **Build** to compile TypeScript
4. **Test** your changes
5. **Commit** with clear messages
6. **Push** and create a pull request

### Building

```bash
# Build all packages (Turborepo handles dependencies automatically)
pnpm build

# Build specific package
pnpm --filter @agent/core build

# Clean and rebuild
pnpm clean && pnpm build
```

Turborepo automatically:
- Builds packages in dependency order
- Caches build outputs (< 1s on cache hit!)
- Rebuilds dependent packages when needed

### Testing

```bash
# Run all tests
pnpm test

# Test specific package
pnpm --filter @agent/core test

# Watch mode (specific package)
pnpm --filter @agent/core test --watch
```

### Running Development Servers

```bash
# Interactive chat CLI
pnpm chat

# HTTP server (auto-restarts on changes)
pnpm server

# All packages in dev mode (parallel)
pnpm dev
```

## Working with Packages

### Adding Dependencies

```bash
# Add to specific package
pnpm --filter @agent/core add <package-name>

# Add dev dependency
pnpm --filter @agent/core add -D <package-name>

# Add to root (for build tools, etc.)
pnpm add -Dw <package-name>
```

### Using Workspace Packages

Packages can depend on each other using the `workspace:*` protocol:

```json
{
  "dependencies": {
    "@agent/shared": "workspace:*"
  }
}
```

### Creating a New Package

1. Create package directory:
```bash
mkdir -p packages/new-package/src
```

2. Create `package.json`:
```json
{
  "name": "@agent/new-package",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@agent/shared": "workspace:*"
  }
}
```

3. Create `tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "composite": true
  },
  "include": ["src/**/*"]
}
```

4. Update `pnpm-workspace.yaml` if needed
5. Build: `pnpm build`

## Code Style

### TypeScript

- Use **strict mode** (enabled in tsconfig.base.json)
- Prefer **explicit types** for public APIs
- Use **async/await** over promises
- Avoid `any` - use `unknown` if type is truly unknown

### Naming Conventions

- **Files**: kebab-case (e.g., `agent-runtime.ts`)
- **Classes**: PascalCase (e.g., `AgentRuntime`)
- **Functions/variables**: camelCase (e.g., `createSession`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `DEFAULT_TIMEOUT`)
- **Types/Interfaces**: PascalCase (e.g., `AgentConfig`)

### Imports

- Use **absolute imports** for workspace packages: `import { logger } from '@agent/shared'`
- Use **relative imports** within the same package: `import { helper } from './utils'`
- Group imports: workspace packages → third-party → relative

```typescript
// Good
import { logger } from '@agent/shared';
import { generateText } from 'ai';
import { helper } from './utils';

// Bad
import { helper } from './utils';
import { generateText } from 'ai';
import { logger } from '@agent/shared';
```

## Testing

### Writing Tests

Place tests alongside source files with `.test.ts` extension:

```
src/
├── runtime/
│   ├── agent-runtime.ts
│   └── agent-runtime.test.ts
```

### Test Structure

```typescript
import { describe, it, expect } from 'vitest';

describe('FeatureName', () => {
  describe('specific behavior', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### Running Tests

```bash
# All tests
pnpm test

# Specific package
pnpm --filter @agent/core test

# Watch mode
pnpm --filter @agent/core test --watch

# Coverage
pnpm --filter @agent/core test --coverage
```

## Commit Guidelines

### Commit Message Format

```
<type>: <description>

[optional body]

[optional footer]
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Build process, dependencies, etc.
- **perf**: Performance improvements

### Examples

```
feat: add device-use package for cross-platform control

Implements native device control for desktop and mobile platforms.
Supports macOS, Linux, Windows, iOS, and Android.

Closes #123
```

```
fix: resolve memory leak in session cleanup

Sessions were not properly disposing of event listeners,
causing memory to accumulate over time.
```

```
docs: update README with monorepo structure
```

## Pull Request Process

### Before Submitting

1. ✅ **Build passes**: `pnpm build`
2. ✅ **Tests pass**: `pnpm test`
3. ✅ **No TypeScript errors**: Build should complete without errors
4. ✅ **Code follows style guidelines**
5. ✅ **Commits are clean and descriptive**

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How were these changes tested?

## Checklist
- [ ] Build passes (`pnpm build`)
- [ ] Tests pass (`pnpm test`)
- [ ] Documentation updated (if needed)
- [ ] No new warnings or errors
```

## Troubleshooting

### Build Issues

**Problem**: Turborepo cache issues
```bash
# Clear Turborepo cache
rm -rf .turbo
pnpm build
```

**Problem**: TypeScript errors after pulling changes
```bash
# Reinstall and rebuild
pnpm install
pnpm build
```

### Dependency Issues

**Problem**: Peer dependency warnings
```bash
# These are usually safe to ignore if the build passes
# If needed, check which packages need updates
pnpm outdated
```

### Test Failures

**Problem**: Tests fail due to missing API keys
```bash
# Ensure .env file exists with required keys
cp .env.example .env
# Add your API keys to .env
```

**Problem**: Tests timeout
```bash
# Some tests (especially with LLM calls) can be slow
# The timeout is disabled in vitest.config.ts
# If needed, you can skip slow tests:
pnpm test -- --exclude "**/*.integration.test.ts"
```

## Package-Specific Guidelines

### @agent/shared

- Keep **minimal dependencies**
- Must **not depend** on other workspace packages
- All exports should be **pure utilities**

### @agent/core

- Core business logic only
- **No HTTP-specific** code (that goes in @agent/server)
- **No CLI-specific** code (that goes in @agent/cli)
- Properly **export types** for consumers

### @agent/server

- HTTP layer only
- Use **@agent/core** for business logic
- Follow **REST conventions**
- Document **all endpoints**

### @agent/cli

- CLI interface only
- Use **@agent/core** and **@agent/server** for functionality
- Provide **clear error messages**
- Support **--help** for all commands

## Architecture Decisions

For major architectural changes:

1. **Open an issue** to discuss the proposal
2. **Get consensus** from maintainers
3. **Update docs/ARCHITECTURE.md** with the design
4. **Implement** in phases if large
5. **Update** this CONTRIBUTING.md if development workflow changes

## Resources

- [Architecture Documentation](docs/ARCHITECTURE.md)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Turborepo Docs](https://turbo.build/repo/docs)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions or ideas
- Check existing issues and discussions first

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
