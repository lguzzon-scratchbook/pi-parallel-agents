import {describe, expect, test} from "vitest"
import type {AgentConfig} from "../src/agents.js"

describe("Agent inheritance", () => {
  test("AgentConfig can have extends property", () => {
    const agent: AgentConfig & {extends?: string} = {
      name: "derived",
      description: "A derived agent",
      extends: "base",
      source: "user",
      filePath: "/test/derived.md",
      systemPrompt: "Extended capabilities"
    }
    expect(agent.extends).toBe("base")
  })

  test("AgentConfig supports resolved fields after inheritance", () => {
    const agent: AgentConfig & {
      extends?: string
      resolvedTools?: string[]
      resolvedModel?: string
    } = {
      name: "derived",
      description: "A derived agent",
      extends: "base",
      source: "user",
      filePath: "/test/derived.md",
      systemPrompt: "Extended capabilities",
      tools: ["read", "bash"],
      model: "claude-sonnet-4-5",
      resolvedTools: ["read", "bash", "grep", "find"],
      resolvedModel: "claude-sonnet-4-5"
    }
    expect(agent.resolvedTools).toContain("grep")
    expect(agent.resolvedTools).toContain("find")
    expect(agent.resolvedModel).toBe("claude-sonnet-4-5")
  })
})
