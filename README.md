# pi-parallel-agents

A [pi](https://github.com/badlogic/pi-mono) extension for dynamic parallel agent execution. Run multiple agents with different models in parallel, with or without pre-defined agent configurations.

## Features

- **Dynamic Model Selection**: Specify model per task inline (e.g., `claude-haiku-4-5`, `gpt-4o-mini`)
- **Agent Integration**: Reference existing agents from `~/.pi/agent/agents` or `.pi/agents`
- **Four Execution Modes**:
  - **Single**: One task with optional model/tools override
  - **Parallel**: Multiple tasks running concurrently with configurable concurrency
  - **Chain**: Sequential execution with `{previous}` placeholder for context passing
  - **Race**: Multiple models compete on the same task, first to complete wins
- **Streaming Progress**: Real-time updates showing tool calls and partial output
- **Context Building**: Auto-read files and git context before execution
- **Cross-Task References**: Use `{task_N}` to reference outputs from earlier parallel tasks
- **Cost Tracking**: See per-task and total API costs
- **Tool Restrictions**: Optionally restrict tools per task for safety/efficiency
- **Custom System Prompts**: Override system prompts per task

## Installation

```bash
pi install npm:pi-parallel-agents
```

Or for local development:

```bash
pi install /path/to/pi-parallel-agents
```

## Usage

The extension registers a `parallel` tool that the LLM can use. Just describe what you want in natural language:

### Using Existing Agents

Reference agents defined in `~/.pi/agent/agents/*.md` (user-level) or `.pi/agents/*.md` (project-level):

```
Use the scout agent to find all authentication code
```

```
Run a chain: scout to analyze the codebase, then planner to create an implementation plan
```

```
In parallel, have scout find models and worker implement the changes
```

Agent settings (model, tools, systemPrompt) are used as defaults. Inline parameters override agent defaults:

```
Use the scout agent with sonnet model to analyze performance
```

To include project-local agents, set `agentScope` to `"both"`:

```
Use agent scope "both" and run the project-specific linter agent
```

### Single Task

Run a task with a specific model:

```
Use haiku to scan the codebase for authentication-related files, only allow grep and find tools
```

```
Have gpt-4o-mini review this function for potential bugs
```

### Parallel Tasks

Run multiple tasks at the same time:

```
In parallel:
- Use haiku to find all database queries
- Use haiku to scan for API endpoints  
- Use sonnet to review the security model
```

```
Run these tasks concurrently with haiku:
1. Count lines of code in src/
2. Find TODO comments
3. List all exported functions
```

With shared context:

```
We're migrating from REST to GraphQL. In parallel, have haiku:
- Find all REST endpoint definitions
- Identify data fetching patterns
- Look for API client usage
```

### Chain Mode

Run tasks sequentially, where each step can use the output from the previous:

```
Chain these steps:
1. Use haiku with grep to find all error handling code
2. Have sonnet analyze the patterns found and suggest improvements
3. Have sonnet implement the top 3 suggestions
```

```
First use haiku to scan for performance issues, then have sonnet create a detailed optimization plan based on the findings
```

### Race Mode

Have multiple models compete on the same task - first to finish wins:

```
Race haiku, gpt-4o-mini, and gemini-flash to summarize the README
```

```
Have claude-haiku and gpt-4o-mini race to answer: what's the main purpose of this codebase?
```

### Context Features

#### Auto-read Files

Specify files to read automatically and include as context:

```json
{
  "tasks": [...],
  "contextFiles": ["src/config.ts", "README.md"]
}
```

#### Git Context

Include git information automatically:

```json
{
  "tasks": [...],
  "gitContext": true
}
```

This includes branch name, status, and changed files. For full diff:

```json
{
  "gitContext": { "branch": true, "diff": true, "log": 5 }
}
```

Options: `branch`, `status`, `diff`, `diffStats`, `log` (number of commits)

#### Cross-Task References

Reference earlier task outputs in parallel mode:

```json
{
  "tasks": [
    { "task": "Analyze the codebase structure", "name": "analyzer" },
    { "task": "Based on {task_0}, suggest improvements", "name": "improver" }
  ]
}
```

When cross-references are detected, tasks run sequentially to allow substitution.

## Parameters Reference

### Single Mode

| Parameter | Type | Description |
|-----------|------|-------------|
| `task` | string | Task to execute |
| `agent` | string | Name of an existing agent to use (optional) |
| `model` | string | Model to use (e.g., "claude-haiku-4-5"). Overrides agent default |
| `tools` | string[] | Restrict to specific tools. Overrides agent default |
| `systemPrompt` | string | Override system prompt. Overrides agent default |
| `thinking` | number \| string | Thinking budget (tokens or "low"/"medium"/"high") |
| `cwd` | string | Working directory |
| `agentScope` | "user" \| "project" \| "both" | Agent discovery scope (default: "user") |

### Parallel Mode

| Parameter | Type | Description |
|-----------|------|-------------|
| `tasks` | TaskItem[] | Array of tasks to run (each can have `agent`, `model`, `tools`, etc.) |
| `context` | string | Shared context string for all tasks |
| `contextFiles` | string[] | File paths to auto-read and include as context |
| `gitContext` | boolean \| object | Include git info (true = branch + status + diffStats) |
| `maxConcurrency` | number | Max concurrent tasks (default: 4, max: 8) |
| `agentScope` | "user" \| "project" \| "both" | Agent discovery scope (default: "user") |

### Chain Mode

| Parameter | Type | Description |
|-----------|------|-------------|
| `chain` | ChainStep[] | Sequential steps (each can have `agent`, `model`, `tools`, etc.) |
| `agentScope` | "user" \| "project" \| "both" | Agent discovery scope (default: "user") |

### Race Mode

| Parameter | Type | Description |
|-----------|------|-------------|
| `race.task` | string | Task to race |
| `race.models` | string[] | Models to compete |
| `race.tools` | string[] | Tool restrictions |
| `race.thinking` | number \| string | Thinking budget for all racers |

## Output Features

### Tool Usage Summary

Results show which tools each subagent used:

```
### ✓ code-reviewer (13 turns, claude-haiku-4-5, $0.0042)
**Tools used:** read×5, bash×3, grep×2

The code looks good overall...
```

### Cost Tracking

Per-task and total costs are displayed:

```
## Parallel: 3/3 succeeded | Total cost: $0.0156
```

### Full Output Files

When output is truncated (>2000 chars), the full output is saved to a temp file:

```
... [truncated, full output: /tmp/parallel-code_reviewer-1738793234567.md]
```

## Thinking Levels

You can specify thinking budget per task:

```
Have sonnet think deeply about this architecture problem (use high thinking)
```

```
Use opus with extended thinking to review this complex algorithm
```

Supported values:
- Numbers: Token budget (e.g., `10000`, `50000`)
- Strings: `"low"`, `"medium"`, `"high"`

## Model Names

You can use short names - the LLM will understand:

- `haiku` → claude-haiku-4-5
- `sonnet` → claude-sonnet-4-5
- `opus` → claude-opus-4
- `gpt-4o-mini`, `gpt-4o`
- `gemini-flash`, `gemini-pro`

## Development

```bash
# Clone the repo
git clone https://github.com/messense/pi-parallel-agents
cd pi-parallel-agents

# Install dependencies
npm install

# Test locally
pi -e ./src/index.ts
```

## How It Works

1. Each task spawns a separate `pi` subprocess with `--mode json`
2. Progress is streamed via JSON events from the subprocess
3. Context is built from files, git info, and user-provided strings
4. Results include tool usage, costs, and full output files
5. Session persistence works automatically via `details`

## License

MIT
