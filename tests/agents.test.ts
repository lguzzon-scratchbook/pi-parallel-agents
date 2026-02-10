/**
 * Unit tests for src/agents.ts
 * Tests public API: discoverAgents, findAgent, formatAgentList
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  discoverAgents,
  findAgent,
  formatAgentList,
  type AgentConfig
} from "../src/agents.ts";

describe("Agent Discovery", () => {
  const testAgentContent = `---
name: test-agent
description: A test agent for unit testing
tools: read, bash, grep
model: claude-sonnet-4-5
thinking: high
---
You are a test agent.
`;

  const testAgentContent2 = `---
name: another-agent
description: Another test agent
tools: read
model: claude-haiku-4-5
---
You are another agent.
`;

  describe("discoverAgents", () => {
    it("returns agents from project directory with 'project' scope", () => {
      const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-agents-test-"));
      const projectAgentsDir = path.join(testDir, ".pi", "agents");
      fs.mkdirSync(projectAgentsDir, { recursive: true });
      const agentFile = path.join(projectAgentsDir, "test-agent.md");
      fs.writeFileSync(agentFile, testAgentContent, "utf-8");

      const result = discoverAgents(testDir, "project");
      expect(result.agents.length).toBe(1);
      expect(result.agents[0].name).toBe("test-agent");
      expect(result.projectAgentsDir).toBe(projectAgentsDir);

      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it("returns agents from project directory with 'both' scope", () => {
      const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-agents-test-"));
      const projectAgentsDir = path.join(testDir, ".pi", "agents");
      fs.mkdirSync(projectAgentsDir, { recursive: true });
      const agent1 = path.join(projectAgentsDir, "agent1.md");
      const agent2 = path.join(projectAgentsDir, "agent2.md");
      fs.writeFileSync(agent1, testAgentContent, "utf-8");
      fs.writeFileSync(agent2, testAgentContent2, "utf-8");

      const result = discoverAgents(testDir, "both");
      expect(result.agents.length).toBe(2);
      expect(result.projectAgentsDir).toBe(projectAgentsDir);

      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it("returns empty array when no agents exist", () => {
      const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-agents-test-"));
      const result = discoverAgents(testDir, "project");
      expect(result.agents).toEqual([]);
      expect(result.projectAgentsDir).toBeNull();

      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it("returns empty when .pi/agents exists but is empty", () => {
      const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-agents-test-"));
      const projectAgentsDir = path.join(testDir, ".pi", "agents");
      fs.mkdirSync(projectAgentsDir, { recursive: true });

      const result = discoverAgents(testDir, "project");
      expect(result.agents).toEqual([]);
      expect(result.projectAgentsDir).toBe(projectAgentsDir);

      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it("skips files without .md extension", () => {
      const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-agents-test-"));
      const projectAgentsDir = path.join(testDir, ".pi", "agents");
      fs.mkdirSync(projectAgentsDir, { recursive: true });
      fs.writeFileSync(path.join(projectAgentsDir, "readme.txt"), "Not an agent", "utf-8");

      const result = discoverAgents(testDir, "project");
      expect(result.agents).toEqual([]);

      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it("handles non-existent project directory", () => {
      const testDir = path.join(os.tmpdir(), "non-existent-" + Date.now());
      const result = discoverAgents(testDir, "project");
      expect(result.agents).toEqual([]);
      expect(result.projectAgentsDir).toBeNull();
    });

    it("returns empty array with 'user' scope when no user agents exist", () => {
      const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-agents-test-"));
      
      const result = discoverAgents(testDir, "user");
      expect(result.agents).toEqual([]);
      expect(result.projectAgentsDir).toBeNull();

      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it("handles file read permission error", () => {
      const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-agents-test-"));
      const projectAgentsDir = path.join(testDir, ".pi", "agents");
      fs.mkdirSync(projectAgentsDir, { recursive: true });
      const agentFile = path.join(projectAgentsDir, "test-agent.md");
      fs.writeFileSync(agentFile, testAgentContent, "utf-8");
      // Remove read permissions (on Unix systems)
      try { fs.chmodSync(agentFile, 0o000); } catch {}

      const result = discoverAgents(testDir, "project");
      // Should still return empty since file can't be read
      expect(result.agents).toEqual([]);

      // Restore permissions for cleanup
      try { fs.chmodSync(agentFile, 0o644); } catch {}
      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it("handles directory read permission error", () => {
      const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-agents-test-"));
      const projectAgentsDir = path.join(testDir, ".pi", "agents");
      fs.mkdirSync(projectAgentsDir, { recursive: true });
      const agentFile = path.join(projectAgentsDir, "test-agent.md");
      fs.writeFileSync(agentFile, testAgentContent, "utf-8");
      // Remove read permissions on directory (on Unix systems)
      try { fs.chmodSync(projectAgentsDir, 0o000); } catch {}

      const result = discoverAgents(testDir, "project");
      // Should return empty since directory can't be read
      expect(result.agents).toEqual([]);

      // Restore permissions for cleanup
      try { fs.chmodSync(projectAgentsDir, 0o755); } catch {}
      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it("handles malformed frontmatter", () => {
      const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-agents-test-"));
      const projectAgentsDir = path.join(testDir, ".pi", "agents");
      fs.mkdirSync(projectAgentsDir, { recursive: true });
      
      // File with valid YAML but missing required fields
      const malformedContent = `---
name: test-agent
---`;
      const agentFile = path.join(projectAgentsDir, "malformed.md");
      fs.writeFileSync(agentFile, malformedContent, "utf-8");

      const result = discoverAgents(testDir, "project");
      // Should skip file because description is missing
      expect(result.agents).toEqual([]);

      fs.rmSync(testDir, { recursive: true, force: true });
    });
  });

  describe("findAgent", () => {
    it("returns undefined for non-existent agent", () => {
      const agents: AgentConfig[] = [
        { name: "agent1", description: "Test", systemPrompt: "", source: "user", filePath: "/test" }
      ];
      const result = findAgent(agents, "non-existent");
      expect(result).toBeUndefined();
    });

    it("returns agent by name", () => {
      const agents: AgentConfig[] = [
        { name: "agent1", description: "Test 1", systemPrompt: "", source: "user", filePath: "/test1" },
        { name: "agent2", description: "Test 2", systemPrompt: "", source: "user", filePath: "/test2" }
      ];
      const result = findAgent(agents, "agent2");
      expect(result).toBeDefined();
      expect(result!.name).toBe("agent2");
    });
  });

  describe("formatAgentList", () => {
    it("returns 'none' for empty array", () => {
      const result = formatAgentList([], 10);
      expect(result.text).toBe("none");
      expect(result.remaining).toBe(0);
    });

    it("formats agents correctly with maxItems", () => {
      const agents: AgentConfig[] = [
        { name: "agent1", description: "Description 1", systemPrompt: "", source: "user", filePath: "/test1" },
        { name: "agent2", description: "Description 2", systemPrompt: "", source: "project", filePath: "/test2" },
        { name: "agent3", description: "Description 3", systemPrompt: "", source: "user", filePath: "/test3" }
      ];
      const result = formatAgentList(agents, 2);
      expect(result.text).toContain("agent1");
      expect(result.text).toContain("agent2");
      expect(result.text).not.toContain("agent3");
      expect(result.remaining).toBe(1);
    });

    it("includes source in format", () => {
      const agents: AgentConfig[] = [
        { name: "user-agent", description: "User agent", systemPrompt: "", source: "user", filePath: "/test1" },
        { name: "proj-agent", description: "Project agent", systemPrompt: "", source: "project", filePath: "/test2" }
      ];
      const result = formatAgentList(agents, 2);
      expect(result.text).toContain("user-agent (user)");
      expect(result.text).toContain("proj-agent (project)");
    });
  });
});