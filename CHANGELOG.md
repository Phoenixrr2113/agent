# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Open source contribution infrastructure
  - GitHub issue templates (bug report, feature request, question)
  - Pull request template with comprehensive checklist
  - GitHub Actions CI workflow (multi-OS, multi-Node version testing)
  - Dependabot configuration for automated dependency updates
  - CODE_OF_CONDUCT.md (Contributor Covenant v2.0)
  - SECURITY.md with vulnerability reporting process
  - CODEOWNERS file for automatic review assignment
  - Comprehensive .env.example with all configuration options
  - README badges for CI status, license, and version info
  - GitHub setup guide for repository configuration

## [0.3.0] - 2024-12-XX

### Added
- Device use package (`@agent/device-use`)
  - Cross-platform device control using nut.js
  - Support for macOS, Linux (X11/Wayland), and Windows
  - High-performance native automation (100x faster than CLI tools)
  - Safety layer with rate limiting and validation
  - iOS and Android placeholders for Phase 3

### Changed
- Updated architecture documentation with device use implementation details

## [0.2.0] - 2024-11-XX

### Added
- Monorepo structure with pnpm workspaces and Turborepo
  - `@agent/shared` - Base utilities and types
  - `@agent/core` - Agent runtime engine
  - `@agent/server` - HTTP API server
  - `@agent/cli` - Command-line interfaces
- Turborepo build caching (< 1s builds with cache)
- Package-specific build and test scripts

### Changed
- Migrated from single-package to monorepo architecture
- Updated all imports to use workspace protocol
- Improved build system with dependency-aware compilation

### Fixed
- Cleaned up compiled .js files from source directories
- Removed circular dependencies

## [0.1.0] - 2024-10-XX

### Added
- Initial release with core agent runtime
- Memory system
  - SQLite-based knowledge graph
  - Automatic entity and fact extraction
  - Semantic search with embeddings
  - Dual provider support (native + Graphiti API)
- RAG (Retrieval-Augmented Generation)
  - Hybrid semantic code search
  - AST-based chunking via code-chopper
  - BM25 + text-embedding-004
  - Reranking with Google's reranker
- Tools system
  - Core tools: shell, web_search, fetch_page
  - Memory tools: memory_search, memory_save, etc.
  - Workspace tools: search_codebase, grep_codebase
  - Meta tools: task_complete, ask_user, plan, validate
  - Smart tool management with deferred loading
  - Tool activation/deactivation for token optimization
- HTTP Server
  - Hono-based REST API
  - Server-Sent Events (SSE) streaming
  - Session management
  - Multiple concurrent conversations
- CLI
  - Interactive chat mode
  - Server launcher
  - Programmatic API
- Multi-tier model support via OpenRouter
  - Fast: DeepSeek Chat
  - Standard: Google Gemini 2.0 Flash
  - Reasoning: DeepSeek R1
  - Powerful: Claude Sonnet 4
- Sequential thinking tool for complex reasoning
- Plan tool for multi-step task breakdown
- Workspace support for codebase tools
- Web search integration (Brave, Tavily)

### Documentation
- Comprehensive README with installation and usage
- Architecture documentation
- Contributing guidelines
- Testing guide
- Tool registration guide

---

## Release Types

- **Major version** (X.0.0): Breaking changes
- **Minor version** (0.X.0): New features, backward compatible
- **Patch version** (0.0.X): Bug fixes, backward compatible

## Versioning Guidelines

We follow [Semantic Versioning](https://semver.org/):

- **Breaking changes**: Require major version bump
- **New features**: Require minor version bump
- **Bug fixes**: Require patch version bump
- **Documentation**: No version bump needed (unless significant)

[Unreleased]: https://github.com/Phoenixrr2113/agent/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/Phoenixrr2113/agent/releases/tag/v0.3.0
[0.2.0]: https://github.com/Phoenixrr2113/agent/releases/tag/v0.2.0
[0.1.0]: https://github.com/Phoenixrr2113/agent/releases/tag/v0.1.0
