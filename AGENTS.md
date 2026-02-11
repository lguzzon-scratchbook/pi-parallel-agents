# AGENTS.md

Guidelines for AI agents working on this codebase.

## Project Overview

`pi-parallel-agents` is a [pi](https://github.com/badlogic/pi-mono) extension that enables dynamic parallel execution of multiple agents with different models. This tool supports both:

1. **Inline configuration**: Specify model, tools, thinking level, and system prompts per task
2. **Agent references**: Reference existing agent definitions from `~/.pi/agent/agents` or `.pi/agents`

## Architecture

```
src/
├── index.ts      # Main extension entry point, tool registration, mode dispatch
├── executor.ts   # Subprocess execution, spawns `pi --mode json` processes, retry mechanism
├── parallel.ts   # Concurrency utilities (worker pool, race with abort)
├── dag.ts        # DAG engine for team mode (build, validate, execute task graphs, iterative review loops)
├── workspace.ts  # Shared workspace for team artifact exchange
├── render.ts     # TUI rendering for progress and results
├── types.ts      # TypeScript types and Typebox schemas
├── agents.ts     # Agent discovery and configuration resolution
└── context.ts    # Context building (files, git info)
```

### Key Design Decisions

1. **Subprocess-based execution**: Each task spawns a separate `pi` process with `--mode json` to capture structured output. This provides isolation and allows different models/configs per task.

2. **State in tool details**: Results are stored in the tool result `details` field, which pi automatically persists. This enables session branching/restore without additional state management.

3. **Streaming progress**: Uses `onUpdate` callback to emit progress during execution. The TUI shows real-time tool calls and partial output from running tasks.

4. **Hybrid agent model**: Users can specify model/tools/thinking inline OR reference existing agents. When an agent is referenced, its settings are used as defaults and inline parameters override them.

5. **Agent discovery**: Agents are discovered from `~/.pi/agent/agents/*.md` (user-level) and optionally `.pi/agents/*.md` (project-level) based on `agentScope` parameter.

6. **Context building**: Context is built from multiple sources (user string, files, git info) before execution. This avoids subagents needing to re-read the same files.

7. **Cross-task references**: When `{task_N}` placeholders are detected in parallel tasks, execution switches to sequential mode to allow substitution.

8. **Retry mechanism**: Failed tasks can be retried with exponential backoff and pattern-based error filtering via `RetryConfig`.

9. **Iterative refinement**: Team mode supports review loops where reviewers can request revisions until quality thresholds are met or max iterations reached.

## Execution Modes

| Mode | Entry Point | Description |
|------|-------------|-------------|
| Single | `params.task` | One task with optional agent/model overrides |
| Parallel | `params.tasks[]` | Concurrent execution with worker pool |
| Chain | `params.chain[]` | Sequential, `{previous}` passes output between steps |
| Race | `params.race` | Multiple models compete, first success wins |
| Team | `params.team` | DAG-based team coordination with roles, dependencies, and iterative review |

## Agent Integration

### Agent Discovery

Agents are markdown files with YAML frontmatter:

```markdown
---
name: scout
description: Fast codebase reconnaissance
tools: read, grep, find, ls
model: claude-haiku-4-5
---
System prompt goes here.
```

**Locations:**

- `~/.pi/agent/agents/*.md` - User-level (always available)
- `.pi/agents/*.md` - Project-level (requires `agentScope: "both"` or `"project"`)

### Agent Inheritance

Agents can inherit from other agents using the `extends` property:

```markdown
---
name: base-agent
description: Base agent with common tools
tools: read, bash, ls
model: claude-haiku-4-5
thinking: medium
---
# Base system prompt
```

```markdown
---
name: specialized-agent  
description: Specialized agent that extends base
extends: base-agent
tools: read, bash, grep, find, write
model: claude-sonnet-4-5
---
# Specialized system prompt that extends base
```

When an agent extends another:
1. Tools are combined (union of base and child tools)
2. Model is inherited from base unless overridden by child
3. System prompt is not inherited - child agent uses its own prompt
4. Circular dependencies are detected and will throw an error

The inheritance is resolved automatically when agents are loaded, and the resolved values are available in `resolvedTools` and `resolvedModel` fields.

### Resolution Order

When an `agent` parameter is specified:

1. Look up the agent by name
2. Resolve inheritance chain if `extends` is specified
3. Use agent's `model`, `tools`, `systemPrompt`, `thinking` as defaults (including inherited values)
4. Inline parameters override agent defaults

Example: `{ agent: "scout", model: "claude-sonnet-4-5" }` uses scout's tools/systemPrompt but with sonnet model.

## Context Building

Context is built in `context.ts` from multiple sources:

1. **User-provided string**: `params.context`
2. **Auto-read files**: `params.contextFiles` - array of paths to read
3. **Git context**: `params.gitContext` - branch, status, diff, log

```typescript
const sharedContext = buildContext(cwd, {
  context: params.context,
  contextFiles: params.contextFiles,
  gitContext: params.gitContext,
});
```

This reduces redundant file reads across parallel tasks.

## Cross-Task References

In parallel mode, tasks can reference earlier task outputs using either index-based or name-based patterns:

```json
{
  "tasks": [
    { "task": "Analyze the code", "name": "analyzer" },
    { "task": "Based on {task_0}, suggest improvements" },
    { "task": "Summarize findings from {task:analyzer}" }
  ]
}
```

**Supported patterns:**
- `{task_N}` or `{result_N}` - Index-based references (e.g., `{task_0}`, `{result_1}`)
- `{task:name}` or `{result:name}` - Name-based references (e.g., `{task:analyzer}`, `{result:analyzer}`)

When any of these patterns are detected, `maxConcurrency` is set to 1 to ensure sequential execution.

## Code Conventions

- **TypeScript strict mode**: All code must pass `tsc --noEmit`
- **Typebox schemas**: Tool parameters defined with `@sinclair/typebox` for runtime validation
- **ES modules**: Use `.js` extensions in imports (TypeScript compiles to ESM)
- **No build step**: pi loads TypeScript directly via its extension system

## Testing

Test locally without publishing:

```bash
# Run pi with the extension loaded
pi -e ./src/index.ts

# Test with JSON mode to see raw events
pi -e ./src/index.ts --mode json -p 'your prompt here'

# Test specific mode
pi -e ./src/index.ts -p 'use haiku to count files in src/'
pi -e ./src/index.ts -p 'race haiku and gpt-4o-mini to summarize README'

# Test context features
pi -e ./src/index.ts -p 'use haiku with git context to review changes'
pi -e ./src/index.ts -p 'read package.json as context and have haiku analyze dependencies'

# Test with existing agents (if you have scout defined in ~/.pi/agent/agents/)
pi -e ./src/index.ts -p 'use the scout agent to find authentication code'
pi -e ./src/index.ts -p 'run a chain: scout to analyze, then planner to plan'
```

## Common Tasks

### Adding a new parameter

1. Add to schema in `types.ts` (e.g., `TaskItemSchema`, `ChainStepSchema`, etc.)
2. Add to `ExecutorOptions` interface in `executor.ts`
3. Update `resolveAgentSettings()` in `index.ts` if it affects agent resolution
4. Pass through in `index.ts` for each mode that uses it
5. Add CLI flag handling in `runAgent()` if needed
6. Update README.md and AGENTS.md

### Implementing agent inheritance

1. Add `extends?: string` field to `AgentConfig` interface in `agents.ts`
2. Add `resolvedTools?: string[]` and `resolvedModel?: string` fields
3. Implement `resolveAgentInheritance()` function to compute inherited values
4. Update `loadAgentsFromDir()` to read `extends` from frontmatter
5. Update `discoverAgents()` to call `resolveAgentInheritance()` after loading
6. Update `resolveAgentSettings()` in `index.ts` to use `resolvedTools` and `resolvedModel`
7. Write tests for inheritance resolution and circular dependency detection

### Adding resource limits

1. Define `ResourceLimitsSchema` in `types.ts` with appropriate fields ✅ **IMPLEMENTED**
2. Add `resourceLimits?: ResourceLimits` to relevant schemas (`TaskItemSchema`, `ChainStepSchema`, etc.) ✅ **IMPLEMENTED**
3. Add `resourceLimits` to `ExecutorOptions` interface in `executor.ts` ✅ **IMPLEMENTED**
4. Update all mode handlers in `index.ts` to pass through resource limits ✅ **IMPLEMENTED**
5. Implement enforcement logic in `executor.ts` if `enforceLimits` is true ✅ **IMPLEMENTED** - Uses AbortSignal for duration, memory polling, and tool call tracking
6. Write tests for resource limit validation and schema ✅ **IMPLEMENTED**

**Note**: Resource limits are now passed through all execution modes (single, parallel, chain, race, team) with full enforcement support via AbortSignal when `enforceLimits` is true.

### Improving progress display

Tool argument previews are in `extractToolArgsPreview()` in `executor.ts`. Add tool-specific formatting there for better context during execution.

### Adding a new execution mode

1. Add schema to `types.ts`
2. Add mode detection in `index.ts` (`hasNewMode` check)
3. Implement execution logic in the mode dispatch section
4. Add TUI rendering in `render.ts` for both progress and results
5. Update README.md and AGENTS.md with examples

### Modifying agent discovery

Agent discovery logic is in `agents.ts`:

- `discoverAgents()` - Main discovery function
- `loadAgentsFromDir()` - Loads agents from a directory
- `findNearestProjectAgentsDir()` - Walks up to find `.pi/agents`
- `findAgent()` - Lookup by name
- `resolveAgentSettings()` in `index.ts` - Merges agent defaults with inline overrides

### Adding context sources

Context building is in `context.ts`:

- `readContextFiles()` - Reads files and formats as markdown
- `getGitContext()` - Gathers git info (branch, diff, status, log)
- `buildContext()` - Combines all sources into a single string

## Dependencies

- `@mariozechner/pi-coding-agent`: Core pi types and extension API
- `@mariozechner/pi-ai`: Message types for parsing subprocess output
- `@mariozechner/pi-tui`: TUI components (Container, Text)
- `@sinclair/typebox`: Runtime schema validation

All are peer dependencies - pi provides them at runtime.

## Error Handling & Retry Mechanism

- **Automatic retries**: Failed tasks can be retried with exponential backoff
- **Error filtering**: Configure `retryOn` patterns to only retry specific errors, or `skipOn` to exclude certain errors
- **Backoff calculation**: Delay doubles each attempt, capped at 60 seconds
- **Subprocess failures**: Set `exitCode !== 0` and populate `error` field
- **Chain mode**: Stops on first failure, returns partial results
- **Race mode**: Aborts losers when winner completes. If ALL models fail, returns an aggregate error with details of all failures.
- **Parallel mode**: Continues all tasks, aggregates successes/failures
- **AbortSignal**: Propagates to kill subprocesses gracefully

### Retry Configuration

```typescript
interface RetryConfig {
  maxAttempts: number;      // Maximum retry attempts (including initial)
  backoffMs: number;        // Base delay between retries (exponential)
  retryOn?: string[];       // Only retry on errors matching these patterns
  skipOn?: string[];        // Skip retry on errors matching these patterns
}
```

Retry configuration can be specified at multiple levels:
- **Task level**: Per-task retry in parallel mode
- **Chain step level**: Per-step retry in chain mode
- **Race level**: Retry configuration for all models in race mode
- **Team member level**: Per-member retry in team mode
- **Team task level**: Per-task retry in team DAG mode

The retry mechanism uses exponential backoff with a 60-second maximum delay between attempts.

### Resource Limits

```typescript
interface ResourceLimits {
  maxMemoryMB?: number;            // Maximum memory usage in MB
  maxDurationMs?: number;          // Maximum execution time in milliseconds (default: 5 minutes)
  maxConcurrentToolCalls?: number; // Maximum concurrent tool calls
  enforceLimits?: boolean;         // Whether to enforce limits or just warn
}
```

Resource limits can be specified at multiple levels:
- **Task level**: Per-task limits in parallel mode
- **Chain step level**: Per-step limits in chain mode  
- **Race level**: Limits for all models in race mode
- **Team member level**: Per-member limits in team mode
- **Team task level**: Per-task limits in team DAG mode

### Usage Examples

```typescript
// Retry on network errors only
const retryConfig = {
  maxAttempts: 3,
  backoffMs: 1000,
  retryOn: ["network error", "timeout", "connection"]
};

// Skip retry on fatal errors
const retryConfig = {
  maxAttempts: 3,
  backoffMs: 1000,
  skipOn: ["fatal error", "syntax error", "permission denied"]
};

// Resource limits example
const resourceLimits = {
  maxMemoryMB: 1024,
  maxDurationMs: 300000, // 5 minutes
  maxConcurrentToolCalls: 5,
  enforceLimits: true
};
```

## Utility Functions & Implementation Details

### Progress Display
The `extractToolArgsPreview()` function in `executor.ts` provides tool-specific formatting for better context during execution:

```typescript
function extractToolArgsPreview(toolName: string, args: Record<string, unknown>): string
```

**Supported tools and formatting:**
- `read`: Shows file path with line ranges if offset/limit specified
- `write`: Shows file path and content size
- `edit`: Shows file path
- `bash`: Shows first 60 chars of command
- `grep`/`rg`: Shows pattern and file path
- `find`: Shows path and -name pattern
- `mcp`: Shows tool/server/search name
- `subagent`: Shows task or agent name
- `todo`: Shows action and title

### Workspace Management (Team Mode)
Team mode uses a shared workspace for artifact exchange:

```typescript
// Create a workspace for team collaboration
createWorkspace(teamName?: string, rootDir?: string): Workspace

// Write task results to workspace
writeTaskResult(workspace: Workspace, taskId: string, output: string, status: "completed" | "failed"): void

// Clean up workspace directory
cleanupWorkspace(workspace: Workspace): void
```

### DAG Execution (Team Mode)
The DAG engine manages task dependencies and parallel execution:

```typescript
// Build and validate DAG from team tasks
buildDag(tasks: TeamTask[], members: Map<string, TeamMember>): Map<string, DagNode>

// Execute DAG with progress tracking
executeDag(options: DagExecutionOptions): Promise<DagExecutionResult>
```

**Key features:**
- Task dependency resolution
- Parallel execution of independent tasks
- Iterative refinement with review loops
- Plan approval workflow
- Circular dependency detection

### Context Building
Context is built from multiple sources before execution:

```typescript
// Read and format files as markdown context
readContextFiles(filePaths: string[]): string

// Gather git information (branch, status, diff, log)
getGitContext(options: GitContextOptions): string

// Combine all context sources
buildContext(cwd: string, options: ContextOptions): string
```

### Parallel Execution Utilities
```typescript
// Generic parallel execution with concurrency limit
mapWithConcurrencyLimit<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal
): Promise<{ results: R[], aborted: boolean }>

// Race multiple promises, aborting losers when winner completes
raceWithAbort<T>(tasks: Array<{ id: string; run: (signal: AbortSignal) => Promise<T> }>, signal?: AbortSignal): Promise<{ winner: string; result: T }>
```

### Agent Discovery & Inheritance
```typescript
// Discover agents from user and project directories
discoverAgents(cwd: string, scope: AgentScope): AgentDiscoveryResult

// Load agents from a directory
loadAgentsFromDir(dir: string, source: "user" | "project"): AgentConfig[]

// Find nearest .pi/agents directory
findNearestProjectAgentsDir(cwd: string): string | null

// Look up agent by name
findAgent(agents: AgentConfig[], name: string): AgentConfig | undefined

// Resolve agent inheritance chain
resolveAgentInheritance(agents: AgentConfig[]): AgentConfig[]

// Format agent list for display
formatAgentList(agents: AgentConfig[], max?: number): { text: string; count: number }
```

### Error Handling & Retry Mechanism
```typescript
// Check if error should trigger a retry
shouldRetry(error: string, retry?: RetryConfig): boolean

// Calculate exponential backoff with 60-second cap
calculateBackoff(baseMs: number, attempt: number): number

// Run agent with retry logic
runAgentWithRetry(options: ExecutorOptions, runAgentFn: (opts: ExecutorOptions) => Promise<TaskResult>): Promise<TaskResult>
```

### TypeScript Interfaces
**Key interfaces defined in `types.ts`:**
- `TaskProgress`: Progress tracking for running tasks
- `TaskResult`: Final result from single task execution
- `ParallelToolDetails`: Tool details stored in session for persistence
- `AgentConfig`: Agent definition with inheritance support
- `TeamMember` & `TeamTask`: Team coordination types
- `DagNode` & `DagExecutionOptions`: DAG execution types
- `ResourceLimits` & `RetryConfig`: Resource and retry configuration

### Testing Infrastructure
- **13 test files** with **179 tests** covering all major components
- **Integration tests** for retry mechanism
- **DAG tests** including dynamic task modifications
- **Agent inheritance tests** with circular dependency detection
- **Resource limits** schema validation tests
- **Workspace management** tests

## Output Features

- **Tool usage summary**: Shows which tools each subagent used (e.g., `read×5, bash×3`)
- **Cost tracking**: Per-task and total API costs in output
- **Full output files**: When output > 2000 chars, saves to temp file and includes path
- **Streaming progress**: Updates include partial output from running tasks

## Output Limits

Defined in `types.ts`:

- `MAX_OUTPUT_BYTES`: 50KB per task
- `MAX_OUTPUT_LINES`: 2000 lines per task
- `MAX_CONCURRENCY`: 8 parallel tasks
- `COLLAPSED_ITEM_COUNT`: 10 items shown before "expand" prompt
