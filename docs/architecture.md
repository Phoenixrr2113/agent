# Agent Platform Architecture

> Complete architecture documentation reflecting the actual codebase implementation

## Monorepo Structure

```mermaid
graph TB
    subgraph packages["📦 packages/"]
        shared["@agent/shared<br/>Utilities, Logging, Types"]
        core["@agent/core<br/>Runtime, Orchestration, Tools"]
        memory["@agent/memory<br/>RAG, Knowledge Graph, Profiles"]
        server["@agent/server<br/>HTTP/WebSocket Server"]
        apiClient["@agent/api-client<br/>Client SDK"]
        deviceUse["@agent/device-use<br/>Device Control"]
        ui["@agent/ui<br/>Component Library"]
        tailwind["@agent/tailwind-config<br/>Shared Styles"]
        benchmarks["@agent/benchmarks<br/>Performance Testing"]
        mobileA11y["@agent/mobile-accessibility<br/>Mobile Support"]
    end

    subgraph apps["📱 apps/"]
        cli["@agent/cli<br/>Command Line Interface"]
        expo["@agent/expo<br/>React Native App"]
    end

    cli --> apiClient
    expo --> apiClient
    apiClient --> server
    server --> core
    core --> memory
    core --> deviceUse
    core --> shared
    memory --> shared
    deviceUse --> shared
```

## System Architecture

```mermaid
graph LR
    subgraph Clients
        ExpoApp["Expo App"]
        CLI["CLI"]
    end

    subgraph APILayer["API Layer"]
        ApiClient["@agent/api-client"]
    end

    subgraph Server["Server (@agent/server)"]
        HTTP["HTTP API"]
        WS["WebSocket"]
    end

    subgraph Core["Agent Core (@agent/core)"]
        Runtime["Agent Runtime"]
        Orchestrator["Orchestrator"]
        ToolRegistry["Tool Registry<br/>+ Semantic Search"]
        ToolActivation["Activation Manager"]
        ContextMgr["Context Summarization"]
    end

    subgraph Models["Model Selection"]
        Fast["MODEL_FAST<br/>Quick Tasks"]
        Standard["MODEL_STANDARD<br/>Normal Ops"]
        Reasoning["MODEL_REASONING<br/>Deep Thinking"]
        Powerful["MODEL_POWERFUL<br/>Complex Tasks"]
    end

    subgraph External["External Services"]
        LLMAPIs["LLM APIs<br/>OpenAI, Anthropic, etc."]
        Cohere["Cohere API<br/>Reranking"]
        Embeddings["Embedding APIs<br/>OpenAI, Ollama"]
    end

    subgraph Device["Device Control"]
        DeviceUse["@agent/device-use"]
        Safety["Safety System"]
    end

    ExpoApp --> ApiClient
    CLI --> ApiClient
    ApiClient --> HTTP
    ApiClient --> WS
    HTTP --> Runtime
    WS --> Runtime
    Runtime --> Orchestrator
    Orchestrator --> ToolRegistry
    Orchestrator --> ToolActivation
    Orchestrator --> ContextMgr
    Orchestrator --> Models
    Models --> LLMAPIs
    Core --> Cohere
    Core --> Embeddings
    Core --> DeviceUse
    DeviceUse --> Safety
```

## Memory System & RAG Pipeline

```mermaid
graph TB
    subgraph Input["Input Processing"]
        CodeFile["Code File"]
        Scanner["Workspace Scanner<br/>Exclusion Patterns"]
    end

    subgraph Chunking["Intelligent Chunking"]
        AST["AST-Based Strategy<br/>TS, Python, Rust, Go, Java, C/C++"]
        Fallback["Fallback Strategy<br/>Fixed-size, Brace-aware"]
        LangDetect["Language Detection"]
    end

    subgraph Context["Context Generation"]
        LLMContext["LLM Contextual<br/>Enrichment"]
        MetaExtract["Metadata Extraction<br/>Functions, Types, Scopes"]
    end

    subgraph Storage["Storage Layer"]
        Cache["File Cache<br/>SHA256 Hash Validation<br/>.rag-cache/"]
        VectorDB["Vector Database"]
        EmbedModel["Embedding Model<br/>OpenAI / Ollama"]
    end

    subgraph Search["Hybrid Search Pipeline"]
        QueryEmbed["Query Embedding"]
        Semantic["Semantic Search<br/>Cosine Similarity"]
        BM25["BM25 Search<br/>Keyword Matching"]
        RRF["RRF Merge<br/>Reciprocal Rank Fusion"]
        Rerank["Cohere Reranking<br/>rerank-v3.5"]
        TokenFilter["Token Budget<br/>Filtering"]
        Results["Final Results"]
    end

    CodeFile --> Scanner
    Scanner --> LangDetect
    LangDetect --> AST
    LangDetect --> Fallback
    AST --> MetaExtract
    Fallback --> MetaExtract
    MetaExtract --> LLMContext
    LLMContext --> EmbedModel
    EmbedModel --> VectorDB
    EmbedModel --> Cache

    QueryEmbed --> Semantic
    QueryEmbed --> BM25
    VectorDB --> Semantic
    Semantic --> RRF
    BM25 --> RRF
    RRF --> Rerank
    Rerank --> TokenFilter
    TokenFilter --> Results
```

## Knowledge Graph & User Profile

```mermaid
graph TB
    subgraph Extraction["Entity Extraction"]
        TextInput["Text Input"]
        LLMExtract["LLM Extraction<br/>generateObject + Zod"]
        Entities["Entities<br/>name, type, attributes"]
        Relations["Relations<br/>from, to, type, weight"]
        Facts["Facts<br/>content, entities, confidence"]
    end

    subgraph Conflict["Conflict Resolution"]
        ConflictDetect["Entity Conflict<br/>Detection"]
        LLMResolve["LLM Resolution<br/>shouldMerge, mergedAttributes"]
        AttrMerge["Attribute Merging<br/>Newer/More Specific Wins"]
    end

    subgraph Contradiction["Contradiction Handling"]
        ContradictDetect["Contradiction<br/>Detection"]
        BatchProcess["Batch Processing"]
        Supersede["Fact Superseding"]
        Invalidate["Invalidation"]
    end

    subgraph Graph["Knowledge Graph"]
        User((User))
        TypeScript((TypeScript))
        AgentX((Agent X))
        Other(((...)))

        User -->|"Relation"| TypeScript
        User -->|"Relation"| AgentX
        TypeScript -->|"Relation"| AgentX
        AgentX -->|"Relations"| Other
    end

    subgraph Profile["User Profile System"]
        Preferences["Preferences<br/>work_habits, communication_style<br/>preferences, tool_usage"]
        ToolHints["Tool Hints<br/>toolName, actions, reminderTemplate"]
        ProfileStore["Profile Storage<br/>SQLite Backend"]
    end

    subgraph Providers["Memory Providers"]
        Factory["Auto-Detection Factory"]
        MemoryLite["MemoryLite<br/>Pure TypeScript"]
        Graphiti["Graphiti Provider<br/>External API"]
    end

    TextInput --> LLMExtract
    LLMExtract --> Entities
    LLMExtract --> Relations
    LLMExtract --> Facts

    Entities --> ConflictDetect
    ConflictDetect --> LLMResolve
    LLMResolve --> AttrMerge
    AttrMerge --> Graph

    Facts --> ContradictDetect
    ContradictDetect --> BatchProcess
    BatchProcess --> Supersede
    Supersede --> Invalidate

    Relations --> Graph

    Profile --> ProfileStore
    Factory --> MemoryLite
    Factory --> Graphiti
```

## Tool Lifecycle

```mermaid
graph TB
    subgraph Lifecycle["Tool Execution Lifecycle"]
        Before["beforeExecute<br/>Transform/Prepare Input"]
        Validate["validate<br/>Input Validation"]
        Execute["execute<br/>Core Tool Logic"]
        After["afterExecute<br/>Post-process Output"]
        Cleanup["cleanup<br/>Resource Cleanup<br/>(Always Runs)"]
        OnError["onError<br/>Error Recovery"]
    end

    subgraph Instrumentation["Instrumentation"]
        Timing["Timing Wrapper<br/>wrapWithTiming()"]
        Metrics["Performance Metrics<br/>durationMs, toolName"]
    end

    subgraph Errors["Error Handling"]
        ToolError["ToolError Class"]
        ErrorTypes["Error Types:<br/>FILE_NOT_FOUND<br/>PERMISSION_DENIED<br/>TIMEOUT<br/>INVALID_INPUT<br/>RATE_LIMITED<br/>NETWORK_ERROR"]
    end

    subgraph Middleware["Middleware Chain"]
        Chain["applyToolMiddleware()"]
        InstrMiddle["Instrumentation<br/>Middleware"]
        ActivateMiddle["Activation<br/>Middleware"]
        LifecycleMiddle["Lifecycle<br/>Middleware"]
    end

    Before --> Validate
    Validate -->|"Valid"| Execute
    Validate -->|"Invalid"| ToolError
    Execute -->|"Success"| After
    Execute -->|"Error"| OnError
    After --> Cleanup
    OnError -->|"Recover"| After
    OnError -->|"Throw"| Cleanup

    Timing --> Before
    Timing --> After

    Chain --> InstrMiddle
    InstrMiddle --> ActivateMiddle
    ActivateMiddle --> LifecycleMiddle
```

## Tool Registry & Discovery

```mermaid
graph TB
    subgraph Registry["Tool Registry"]
        Register["register()<br/>registerMany()"]
        Metadata["Tool Metadata<br/>name, description, tags, examples"]
        Deferred["Deferred Tools<br/>Lazy Loading"]
        Active["Active Tools"]
    end

    subgraph Search["Tool Discovery"]
        TextSearch["Text Search<br/>Name/Tag Matching"]
        SemanticSearch["Semantic Search<br/>Embedding Similarity"]
        Embeddings["Tool Embeddings<br/>generateEmbeddings()"]
        Threshold["Similarity Threshold"]
    end

    subgraph Activation["Activation Manager"]
        ActivationState["Activation State"]
        ActivateTool["activateTool()"]
        DeferredCheck["Deferred Check<br/>Returns Error if Not Active"]
    end

    Register --> Metadata
    Metadata --> Active
    Metadata --> Deferred

    TextSearch --> Active
    TextSearch --> Deferred

    SemanticSearch --> Embeddings
    Embeddings --> Threshold
    Threshold --> Active

    Deferred --> ActivateTool
    ActivateTool --> ActivationState
    ActivationState --> Active
```

## Device Control & Safety

```mermaid
graph TB
    subgraph DeviceUse["Device Use (@agent/device-use)"]
        Actions["Device Actions<br/>screenshot, key, type, click<br/>drag, scroll, wait, etc."]
        Platforms["Platform Support<br/>macOS, Linux, Windows<br/>iOS, Android"]
        Drivers["Platform Drivers"]
    end

    subgraph Safety["Safety System"]
        ActionValidate["Action Validation"]
        CoordValidate["Coordinate Validation"]
        AppList["App Allowlist/Blocklist"]
        RateLimit["Rate Limiting<br/>maxActionsPerMinute"]
        SafeMode["Safe Mode<br/>Enforcement"]
        Confirm["Confirmation<br/>Requirements"]
    end

    subgraph Integration["Core Integration"]
        DeviceTools["Device Tools<br/>list_devices, select_device<br/>device_action, tap, type_text<br/>device_screenshot, swipe"]
        AnthropicTool["Anthropic computer_20250124<br/>Tool Wrapper"]
    end

    Actions --> Safety
    Safety --> ActionValidate
    Safety --> CoordValidate
    Safety --> AppList
    Safety --> RateLimit
    Safety --> SafeMode
    Safety --> Confirm

    ActionValidate --> Drivers
    Drivers --> Platforms

    DeviceTools --> AnthropicTool
    AnthropicTool --> Actions
```

## Storage Adapter Layer

```mermaid
graph TB
    subgraph Interface["StorageAdapter Interface"]
        EntityOps["entities:<br/>create, update, get<br/>findByName, findByType<br/>search, all"]
        RelationOps["relations:<br/>create, get<br/>findByEntity, findBetween<br/>all"]
        FactOps["facts:<br/>create, update, get<br/>findByEntity, findValid<br/>search, invalidate"]
        EpisodeOps["episodes:<br/>create, get<br/>findByGroup"]
    end

    subgraph Implementations["Storage Implementations"]
        MemoryStorage["In-Memory Storage<br/>Fast, No Persistence<br/>Good for Testing"]
        SQLiteStorage["SQLite Storage<br/>Persistent, Indexed<br/>WAL Mode, Transactions"]
    end

    subgraph SQLiteSchema["SQLite Schema"]
        Tables["Tables:<br/>entities, relations<br/>facts, episodes"]
        Indexes["Indexes:<br/>(user_id, type)<br/>(entity_id)<br/>(created_at)"]
    end

    EntityOps --> MemoryStorage
    EntityOps --> SQLiteStorage
    RelationOps --> MemoryStorage
    RelationOps --> SQLiteStorage
    FactOps --> MemoryStorage
    FactOps --> SQLiteStorage
    EpisodeOps --> MemoryStorage
    EpisodeOps --> SQLiteStorage

    SQLiteStorage --> Tables
    SQLiteStorage --> Indexes
```

## Context Summarization Flow

```mermaid
graph TB
    subgraph Trigger["Summarization Trigger"]
        MsgCount["Message Count > 40?"]
    end

    subgraph Process["Summarization Process"]
        Head["Keep 2 Head Messages"]
        Tail["Keep 15 Tail Messages"]
        Middle["Middle Messages"]
        LLMSummary["LLM Summarization<br/>MODEL_FAST"]
        Combined["Combined Context<br/>Head + Summary + Tail"]
    end

    subgraph Result["Result"]
        Preserved["17 Messages Preserved"]
        Summary["Summary of Removed"]
    end

    MsgCount -->|"Yes"| Head
    MsgCount -->|"No"| Preserved
    Head --> Middle
    Middle --> LLMSummary
    LLMSummary --> Tail
    Tail --> Combined
    Combined --> Result
```

## Complete Data Flow

```mermaid
graph TB
    subgraph UserInput["User Input"]
        Message["User Message"]
    end

    subgraph Runtime["Agent Runtime"]
        Session["Session Management"]
        History["Message History"]
        PerfTimer["Performance Timer"]
    end

    subgraph Orchestration["Orchestration"]
        PrepareStep["Prepare Step"]
        ToolSelect["Tool Selection"]
        ContextSum["Context Summarization"]
        StepExec["Step Execution"]
    end

    subgraph ToolExec["Tool Execution"]
        Registry["Tool Registry"]
        Lifecycle["Tool Lifecycle"]
        Middleware["Middleware Chain"]
    end

    subgraph Memory["Memory Operations"]
        Search["Hybrid Search"]
        Extract["Entity Extraction"]
        Store["Storage Adapter"]
    end

    subgraph Response["Response"]
        Output["Agent Response"]
        Events["Event Stream"]
    end

    Message --> Session
    Session --> History
    History --> PrepareStep
    PrepareStep --> ToolSelect
    ToolSelect --> Registry
    Registry --> Lifecycle
    Lifecycle --> Middleware
    Middleware --> Memory
    Memory --> Search
    Memory --> Extract
    Search --> Store
    Extract --> Store
    Store --> StepExec
    StepExec --> ContextSum
    ContextSum --> Output
    Output --> Events
    PerfTimer --> Output
```

## Environment Configuration

```
┌─────────────────────────────────────────────────────────────┐
│                  Environment Variables                       │
├─────────────────────────────────────────────────────────────┤
│  EMBEDDING                                                   │
│  ├── OPENAI_EMBEDDING_MODEL=text-embedding-3-small          │
│  ├── OLLAMA_ENABLED=false                                   │
│  └── OLLAMA_BASE_URL=http://localhost:11434/api             │
│                                                              │
│  MODELS                                                      │
│  ├── MODEL_FAST=deepseek/deepseek-chat-v3-0324:free         │
│  ├── MODEL_STANDARD=google/gemini-2.0-flash-001             │
│  ├── MODEL_REASONING=deepseek/deepseek-r1:free              │
│  └── MODEL_POWERFUL=anthropic/claude-sonnet-4               │
│                                                              │
│  STORAGE                                                     │
│  ├── MEMORY_DB_PATH=./memory.db                             │
│  └── GRAPHITI_URL=undefined                                  │
│                                                              │
│  RAG OPTIONS                                                 │
│  ├── enableCache=true                                       │
│  ├── enableContextGeneration=true                           │
│  ├── enableBM25=true                                        │
│  ├── enableReranking=true                                   │
│  ├── rerankTopN=100                                         │
│  ├── returnTopN=8                                           │
│  └── maxTokensPerSearch=configurable                        │
└─────────────────────────────────────────────────────────────┘
```

## Core Tools Registered

```
┌─────────────────────────────────────────────────────────────┐
│                    Registered Core Tools                     │
├─────────────────────────────────────────────────────────────┤
│  FILE SYSTEM           │  AGENT                              │
│  ├── fs                │  ├── delegate                       │
│  └── shell             │  ├── task                           │
│                        │  ├── plan                           │
│  WEB                   │  ├── sequential_thinking            │
│  └── web               │  ├── ask_user                       │
│                        │  └── task_complete                  │
│  MEMORY                │                                     │
│  └── memory            │  DEVICE                             │
│                        │  ├── list_devices                   │
│                        │  ├── select_device                  │
│                        │  ├── device_action                  │
│                        │  ├── tap                            │
│                        │  ├── type_text                      │
│                        │  ├── device_screenshot              │
│                        │  └── swipe                          │
└─────────────────────────────────────────────────────────────┘
```
