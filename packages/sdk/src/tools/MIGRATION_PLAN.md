# Tools Migration Plan - @agent/core → @agent/sdk

## Current State

### SDK Tools (Shallow)
```
packages/sdk/src/tools/
├── filesystem/index.ts    # Basic read/write/list (259 lines)
├── shell/index.ts         # Basic shell execution (150 lines)
├── plan/index.ts          # Stub
├── reasoning/index.ts     # Stub  
├── spawn-agent/index.ts   # Working sub-agent spawning
├── factory.ts             # Tool factory
├── provider.ts            # Tool provider
└── index.ts               # Exports
```

### Core Tools (Full Implementation)
```
packages/core/src/tools/
├── glob/                  # 6 files, 8KB - File pattern search
│   ├── cli.ts             # ripgrep-based --files mode
│   ├── constants.ts       # CLI path resolution
│   ├── tools.ts           # AI SDK tool definition
│   ├── types.ts           # GlobOptions, GlobResult, FileMatch
│   └── utils.ts           # Result formatting
│
├── grep/                  # 7 files, 20KB - Content search
│   ├── cli.ts             # ripgrep execution
│   ├── constants.ts       # CLI path with auto-install
│   ├── downloader.ts      # Auto-download ripgrep binary
│   ├── tools.ts           # AI SDK tool definition
│   ├── types.ts           # GrepOptions, GrepMatch, GrepResult
│   └── utils.ts           # Result formatting
│
├── ast-grep/              # 7 files, 28KB - Structural code search
│   ├── cli.ts             # sg CLI execution
│   ├── constants.ts       # Language mappings, CLI resolution
│   ├── downloader.ts      # Auto-download ast-grep binary
│   ├── tools.ts           # astGrepSearchTool, astGrepReplaceTool
│   ├── types.ts           # CliLanguage, CliMatch, Position, Range
│   └── utils.ts           # Result formatting
│
├── filesystem/            # 7 files - Enhanced file operations
├── shell/                 # 5 files - Enhanced shell with streaming
├── plan/                  # 5 files - Multi-step planning
├── deep-reasoning/        # 5 files - Sequential thinking
├── web/                   # 5 files - Browser/fetch tools
├── memory/                # 5 files - Memory tools
└── ...                    # 8 more modules
```

---

## Migration Plan

### Phase 1: Remove & Restructure

| Action | Details |
|--------|---------|
| **DELETE** | `filesystem/index.ts` (shallow, redundant) |
| **KEEP** | `shell/` (enhance later) |
| **KEEP** | `spawn-agent/` (working) |
| **KEEP** | `plan/`, `reasoning/` (stubs, enhance later) |

### Phase 2: Add Core Search Tools

#### 2.1 Glob Tool
**Source:** `packages/core/src/tools/glob/`

Files to copy:
- `cli.ts` → Run ripgrep in `--files` mode
- `constants.ts` → CLI path resolution
- `tools.ts` → `createGlobTool()` with inputSchema
- `types.ts` → `GlobOptions`, `GlobResult`, `FileMatch`
- `utils.ts` → `formatGlobResult()`
- `index.ts` → Exports

**Dependencies:**
- ripgrep binary (auto-downloaded)

#### 2.2 Grep Tool
**Source:** `packages/core/src/tools/grep/`

Files to copy:
- `cli.ts` → Run ripgrep for content search
- `constants.ts` → CLI resolution with fallbacks
- `downloader.ts` → Auto-download ripgrep binary
- `tools.ts` → `createGrepTool()` with inputSchema
- `types.ts` → `GrepOptions`, `GrepMatch`, `GrepResult`
- `utils.ts` → `formatGrepResult()`, `formatCountResult()`
- `index.ts` → Exports

**Features:**
- Pattern matching (regex or literal)
- Context lines (before/after)
- File type filtering
- Max matches limit
- Count-only mode

#### 2.3 AST-Grep Tool
**Source:** `packages/core/src/tools/ast-grep/`

Files to copy:
- `cli.ts` → Run `sg` CLI for structural search
- `constants.ts` → Language mappings, CLI resolution
- `downloader.ts` → Auto-download ast-grep binary
- `tools.ts` → `astGrepSearchTool`, `astGrepReplaceTool`
- `types.ts` → `CliLanguage`, `CliMatch`, `Position`, `Range`
- `utils.ts` → Result formatting
- `index.ts` → Exports

**Features:**
- Structural code search (not regex)
- Language-aware (TypeScript, Python, Go, etc.)
- Pattern variables ($VAR, $$$REST)
- Replace with structural transforms

---

## File Mapping

| Core File | SDK Destination | Notes |
|-----------|-----------------|-------|
| `core/tools/glob/*` | `sdk/tools/glob/*` | Copy all 6 files |
| `core/tools/grep/*` | `sdk/tools/grep/*` | Copy all 7 files |
| `core/tools/ast-grep/*` | `sdk/tools/ast-grep/*` | Copy all 7 files |
| `core/tools/filesystem/*` | — | Skip (use glob/grep instead) |

---

## API Changes

### Before (SDK filesystem)
```typescript
// Shallow implementation
read_text_file({ path, head?, tail? })
write_file({ path, content })
list_directory({ path })
```

### After (Glob + Grep + AST-Grep)
```typescript
// Glob: Find files by pattern
glob({
  pattern: "**/*.ts",
  cwd: "/project",
  maxDepth: 5,
  ignore: ["node_modules"]
})

// Grep: Search content
grep({
  pattern: "function create",
  path: "/project/src",
  include: ["*.ts"],
  context: 2,
  maxMatches: 100
})

// AST-Grep: Structural search
astGrepSearch({
  pattern: "console.log($$$ARGS)",
  language: "typescript",
  path: "/project/src"
})

// AST-Grep: Structural replace
astGrepReplace({
  pattern: "console.log($$$ARGS)",
  replacement: "logger.debug($$$ARGS)",
  language: "typescript",
  path: "/project/src"
})
```

---

## Dependencies

| Tool | Binary | Auto-Install |
|------|--------|--------------|
| glob | ripgrep | ✅ Yes |
| grep | ripgrep | ✅ Yes |
| ast-grep | sg | ✅ Yes |

**Binary locations:**
- `~/.agent/bin/rg` (ripgrep)
- `~/.agent/bin/sg` (ast-grep)

---

## Testing Plan

1. **Unit tests** - Copy from core, adapt paths
2. **Integration tests** - Run against sample codebase
3. **Binary availability** - Test auto-download on clean install

---

## Priority

- [x] Phase 1: Plan created
- [ ] Phase 2.1: Migrate glob tool
- [ ] Phase 2.2: Migrate grep tool
- [ ] Phase 2.3: Migrate ast-grep tool
- [ ] Phase 3: Update tool presets
- [ ] Phase 4: Add tests
- [ ] Phase 5: Update documentation

---

## Estimated Effort

| Task | Files | Lines | Time |
|------|-------|-------|------|
| Glob migration | 6 | ~400 | 1 hour |
| Grep migration | 7 | ~600 | 1.5 hours |
| AST-Grep migration | 7 | ~800 | 2 hours |
| Presets update | 1 | ~50 | 30 min |
| Tests | 3 | ~500 | 2 hours |
| **Total** | **24** | **~2350** | **7 hours** |
