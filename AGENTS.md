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
├── executor.ts   # Subprocess execution, spawns `pi --mode json` processes
├── parallel.ts   # Concurrency utilities (worker pool, race with abort)
├── render.ts     # TUI rendering for progress and results
├── types.ts      # TypeScript types and Typebox schemas
└── agents.ts     # Agent discovery and configuration resolution
```

### Key Design Decisions

1. **Subprocess-based execution**: Each task spawns a separate `pi` process with `--mode json` to capture structured output. This provides isolation and allows different models/configs per task.

2. **State in tool details**: Results are stored in the tool result `details` field, which pi automatically persists. This enables session branching/restore without additional state management.

3. **Streaming progress**: Uses `onUpdate` callback to emit progress during execution. The TUI shows real-time tool calls and output.

4. **Hybrid agent model**: Users can specify model/tools/thinking inline OR reference existing agents. When an agent is referenced, its settings are used as defaults and inline parameters override them.

5. **Agent discovery**: Agents are discovered from `~/.pi/agent/agents/*.md` (user-level) and optionally `.pi/agents/*.md` (project-level) based on `agentScope` parameter.

## Execution Modes

| Mode | Entry Point | Description |
|------|-------------|-------------|
| Single | `params.task` | One task with optional agent/model overrides |
| Parallel | `params.tasks[]` | Concurrent execution with worker pool |
| Chain | `params.chain[]` | Sequential, `{previous}` passes output between steps |
| Race | `params.race` | Multiple models compete, first success wins |

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

### Resolution Order

When an `agent` parameter is specified:
1. Look up the agent by name
2. Use agent's `model`, `tools`, `systemPrompt`, `thinking` as defaults
3. Inline parameters override agent defaults

Example: `{ agent: "scout", model: "claude-sonnet-4-5" }` uses scout's tools/systemPrompt but with sonnet model.

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

## Dependencies

- `@mariozechner/pi-coding-agent`: Core pi types and extension API
- `@mariozechner/pi-ai`: Message types for parsing subprocess output
- `@mariozechner/pi-tui`: TUI components (Container, Text)
- `@sinclair/typebox`: Runtime schema validation

All are peer dependencies - pi provides them at runtime.

## Error Handling

- Subprocess failures set `exitCode !== 0` and populate `error` field
- Chain mode stops on first failure, returns partial results
- Race mode aborts losers when winner completes
- Parallel mode continues all tasks, aggregates successes/failures
- AbortSignal propagates to kill subprocesses gracefully

## Output Limits

Defined in `types.ts`:
- `MAX_OUTPUT_BYTES`: 50KB per task
- `MAX_OUTPUT_LINES`: 2000 lines per task
- `MAX_CONCURRENCY`: 8 parallel tasks
- `COLLAPSED_ITEM_COUNT`: 10 items shown before "expand" prompt
