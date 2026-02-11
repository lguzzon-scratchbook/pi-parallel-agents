/**
 * Agent discovery and configuration.
 * 
 * Discovers agent definitions from:
 * - User-level: ~/.pi/agent/agents/*.md
 * - Project-level: .pi/agents/*.md (nearest ancestor)
 * 
 * Agent files are markdown with YAML frontmatter:
 * ---
 * name: my-agent
 * description: What this agent does
 * tools: read, grep, find
 * model: claude-haiku-4-5
 * ---
 * System prompt goes here.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parseFrontmatter } from "@mariozechner/pi-coding-agent";

export type AgentScope = "user" | "project" | "both";

export interface AgentConfig {
  name: string;
  description: string;
  tools?: string[];
  model?: string;
  systemPrompt: string;
  thinking?: number | string;
  source: "user" | "project";
  filePath: string;
  /** Name of base agent to inherit from */
  extends?: string;
  /** Computed tools after inheritance resolution */
  resolvedTools?: string[];
  /** Computed model after inheritance resolution */
  resolvedModel?: string;
  /** Computed thinking after inheritance resolution */
  resolvedThinking?: number | string;
}

export interface AgentDiscoveryResult {
  agents: AgentConfig[];
  projectAgentsDir: string | null;
}

/**
 * Load agent definitions from a directory.
 */
function loadAgentsFromDir(dir: string, source: "user" | "project"): AgentConfig[] {
  const agents: AgentConfig[] = [];

  if (!fs.existsSync(dir)) {
    return agents;
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return agents;
  }

  for (const entry of entries) {
    if (!entry.name.endsWith(".md")) continue;
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;

    const filePath = path.join(dir, entry.name);
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    const { frontmatter, body } = parseFrontmatter<Record<string, string>>(content);

    if (!frontmatter.name || !frontmatter.description) {
      continue;
    }

    const tools = frontmatter.tools
      ?.split(",")
      .map((t: string) => t.trim())
      .filter(Boolean);

    agents.push({
      name: frontmatter.name,
      description: frontmatter.description,
      tools: tools && tools.length > 0 ? tools : undefined,
      model: frontmatter.model,
      systemPrompt: body,
      thinking: frontmatter.thinking,
      source,
      filePath,
      extends: frontmatter.extends,
    });
  }

  return agents;
}

/**
 * Check if a path is a directory.
 */
function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Resolve agent inheritance by computing resolvedTools and resolvedModel fields.
 * Base agents are looked up by name in the provided agents list.
 * Tools from base agents are combined (union) with child agent tools.
 * Model from child overrides base model.
 * Circular dependencies are detected and will throw an error.
 */
export function resolveAgentInheritance(agents: AgentConfig[]): AgentConfig[] {
  // Create a map for quick lookup
  const agentMap = new Map<string, AgentConfig>();
  for (const agent of agents) {
    agentMap.set(agent.name, agent);
  }

  // Track visited agents to detect cycles
  const visited = new Set<string>();
  const resolved = new Set<string>();

  function resolve(agentName: string, path: string[] = []): void {
    if (path.includes(agentName)) {
      throw new Error(`Circular inheritance detected: ${path.join(" -> ")} -> ${agentName}`);
    }

    const agent = agentMap.get(agentName);
    if (!agent) {
      throw new Error(`Base agent "${agentName}" not found`);
    }

    if (resolved.has(agentName)) {
      return; // Already resolved
    }

    if (visited.has(agentName)) {
      throw new Error(`Circular inheritance detected involving "${agentName}"`);
    }

    visited.add(agentName);

    // Resolve base agent first if any
    if (agent.extends) {
      resolve(agent.extends, [...path, agentName]);
      const baseAgent = agentMap.get(agent.extends);
      if (baseAgent) {
        // Combine tools: union of base and child tools
        const baseTools = baseAgent.resolvedTools || baseAgent.tools || [];
        const childTools = agent.tools || [];
        const combinedTools = [...new Set([...baseTools, ...childTools])];
        if (combinedTools.length > 0) {
          agent.resolvedTools = combinedTools;
        }

        // Model: child overrides base
        agent.resolvedModel = agent.model || baseAgent.resolvedModel || baseAgent.model;

        // Thinking: child overrides base
        if (!agent.thinking) {
          agent.resolvedThinking = baseAgent.resolvedThinking ?? baseAgent.thinking;
        }
      }
    } else {
      // No inheritance, just copy tools/model/thinking to resolved fields
      if (agent.tools && agent.tools.length > 0) {
        agent.resolvedTools = [...agent.tools];
      }
      if (agent.model) {
        agent.resolvedModel = agent.model;
      }
      if (agent.thinking) {
        agent.resolvedThinking = agent.thinking;
      }
    }

    resolved.add(agentName);
    visited.delete(agentName);
  }

  // Resolve all agents
  for (const agent of agents) {
    if (!resolved.has(agent.name)) {
      resolve(agent.name);
    }
  }

  return agents;
}

/**
 * Find the nearest .pi/agents directory by walking up from cwd.
 */
function findNearestProjectAgentsDir(cwd: string): string | null {
  let currentDir = cwd;
  while (true) {
    const candidate = path.join(currentDir, ".pi", "agents");
    if (isDirectory(candidate)) return candidate;

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) return null;
    currentDir = parentDir;
  }
}

/**
 * Discover available agents based on scope.
 * 
 * @param cwd - Current working directory (for project-level agents)
 * @param scope - Which directories to search:
 *   - "user": Only ~/.pi/agent/agents
 *   - "project": Only .pi/agents (nearest ancestor)
 *   - "both": Both, with project overriding user for same name
 */
export function discoverAgents(cwd: string, scope: AgentScope): AgentDiscoveryResult {
  const userDir = path.join(os.homedir(), ".pi", "agent", "agents");
  const projectAgentsDir = findNearestProjectAgentsDir(cwd);

  const userAgents = scope === "project" ? [] : loadAgentsFromDir(userDir, "user");
  const projectAgents =
    scope === "user" || !projectAgentsDir ? [] : loadAgentsFromDir(projectAgentsDir, "project");

  const agentMap = new Map<string, AgentConfig>();

  if (scope === "both") {
    // User first, then project overrides
    for (const agent of userAgents) agentMap.set(agent.name, agent);
    for (const agent of projectAgents) agentMap.set(agent.name, agent);
  } else if (scope === "user") {
    for (const agent of userAgents) agentMap.set(agent.name, agent);
  } else {
    for (const agent of projectAgents) agentMap.set(agent.name, agent);
  }

  const allAgents = Array.from(agentMap.values());
  
  // Resolve inheritance for all agents
  const resolvedAgents = resolveAgentInheritance(allAgents);
  
  return { agents: resolvedAgents, projectAgentsDir };
}

/**
 * Find an agent by name.
 */
export function findAgent(agents: AgentConfig[], name: string): AgentConfig | undefined {
  return agents.find((a) => a.name === name);
}

/**
 * Format a list of agents for display.
 */
export function formatAgentList(
  agents: AgentConfig[],
  maxItems: number
): { text: string; remaining: number } {
  if (agents.length === 0) return { text: "none", remaining: 0 };
  const listed = agents.slice(0, maxItems);
  const remaining = agents.length - listed.length;
  return {
    text: listed.map((a) => `${a.name} (${a.source}): ${a.description}`).join("; "),
    remaining,
  };
}
