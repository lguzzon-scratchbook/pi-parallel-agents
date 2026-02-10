import {describe, expect, test, vi, beforeEach} from "vitest"
import type {TaskResult, TaskProgress, ParallelToolDetails, UsageStats} from "../src/types.js"

describe("Render Module", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Module Exports", () => {
    test("formatTokens is exported", async () => {
      const mod = await import("../src/render.js")
      expect(mod.formatTokens).toBeDefined()
      expect(typeof mod.formatTokens).toBe("function")
    })

    test("formatDuration is exported", async () => {
      const mod = await import("../src/render.js")
      expect(mod.formatDuration).toBeDefined()
      expect(typeof mod.formatDuration).toBe("function")
    })

    test("formatUsageStats is exported", async () => {
      const mod = await import("../src/render.js")
      expect(mod.formatUsageStats).toBeDefined()
      expect(typeof mod.formatUsageStats).toBe("function")
    })
  })

  describe("formatTokens", () => {
    test("formats small numbers", async () => {
      const { formatTokens } = await import("../src/render.js")
      expect(formatTokens(0)).toBe("0")
      expect(formatTokens(100)).toBe("100")
      expect(formatTokens(999)).toBe("999")
    })

    test("formats thousands", async () => {
      const { formatTokens } = await import("../src/render.js")
      expect(formatTokens(1000)).toBe("1.0k")
      expect(formatTokens(1500)).toBe("1.5k")
      expect(formatTokens(9999)).toBe("10.0k")
      expect(formatTokens(50000)).toBe("50k")
    })

    test("formats millions", async () => {
      const { formatTokens } = await import("../src/render.js")
      expect(formatTokens(1000000)).toBe("1.0M")
      expect(formatTokens(1500000)).toBe("1.5M")
      expect(formatTokens(10000000)).toBe("10.0M")
    })
  })

  describe("formatDuration", () => {
    test("formats milliseconds", async () => {
      const { formatDuration } = await import("../src/render.js")
      expect(formatDuration(0)).toBe("0ms")
      expect(formatDuration(100)).toBe("100ms")
      expect(formatDuration(999)).toBe("999ms")
    })

    test("formats seconds", async () => {
      const { formatDuration } = await import("../src/render.js")
      expect(formatDuration(1000)).toBe("1.0s")
      expect(formatDuration(1500)).toBe("1.5s")
      expect(formatDuration(30000)).toBe("30.0s")
      expect(formatDuration(59999)).toBe("60.0s")
    })

    test("formats minutes", async () => {
      const { formatDuration } = await import("../src/render.js")
      expect(formatDuration(60000)).toBe("1m0s")
      expect(formatDuration(90000)).toBe("1m30s")
      expect(formatDuration(120000)).toBe("2m0s")
      expect(formatDuration(3661000)).toBe("61m1s")
    })
  })

  describe("formatUsageStats", () => {
    test("formats empty usage", async () => {
      const { formatUsageStats } = await import("../src/render.js")
      const result = formatUsageStats({
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0,
        contextTokens: 0,
        turns: 0
      })
      expect(result).toBe("")
    })

    test("formats turns only", async () => {
      const { formatUsageStats } = await import("../src/render.js")
      const result = formatUsageStats({
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0,
        contextTokens: 0,
        turns: 3
      })
      expect(result).toContain("3 turns")
    })

    test("formats single turn", async () => {
      const { formatUsageStats } = await import("../src/render.js")
      const result = formatUsageStats({
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0,
        contextTokens: 0,
        turns: 1
      })
      expect(result).toContain("1 turn")
    })

    test("formats input/output", async () => {
      const { formatUsageStats } = await import("../src/render.js")
      const result = formatUsageStats({
        input: 1000,
        output: 5000,
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0,
        contextTokens: 0,
        turns: 0
      })
      expect(result).toContain("↑1.0k")
      expect(result).toContain("↓5.0k")
    })

    test("formats cache read/write", async () => {
      const { formatUsageStats } = await import("../src/render.js")
      const result = formatUsageStats({
        input: 0,
        output: 0,
        cacheRead: 5000,
        cacheWrite: 1000,
        cost: 0,
        contextTokens: 0,
        turns: 0
      })
      expect(result).toContain("R5.0k")
      expect(result).toContain("W1.0k")
    })

    test("formats cost", async () => {
      const { formatUsageStats } = await import("../src/render.js")
      const result = formatUsageStats({
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0.0150,
        contextTokens: 0,
        turns: 0
      })
      expect(result).toContain("$0.0150")
    })

    test("formats context tokens", async () => {
      const { formatUsageStats } = await import("../src/render.js")
      const result = formatUsageStats({
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0,
        contextTokens: 5000,
        turns: 0
      })
      expect(result).toContain("ctx:5.0k")
    })

    test("formats with model name", async () => {
      const { formatUsageStats } = await import("../src/render.js")
      const result = formatUsageStats({
        input: 100,
        output: 500,
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0.01,
        contextTokens: 0,
        turns: 1
      }, "claude-sonnet-4-5")
      expect(result).toContain("claude-sonnet-4-5")
    })

    test("combines multiple metrics", async () => {
      const { formatUsageStats } = await import("../src/render.js")
      const result = formatUsageStats({
        input: 1000,
        output: 5000,
        cacheRead: 500,
        cacheWrite: 100,
        cost: 0.015,
        contextTokens: 10000,
        turns: 2
      })
      expect(result).toContain("2 turns")
      expect(result).toContain("↑1.0k")
      expect(result).toContain("↓5.0k")
      expect(result).toContain("R500")
      expect(result).toContain("W100")
      expect(result).toContain("$0.0150")
      expect(result).toContain("ctx:10k")
    })
  })

  describe("Progress Types", () => {
    test("progress structure is valid", () => {
      const progress: TaskProgress = {
        id: "test-id",
        name: "Test Task",
        status: "running",
        task: "Doing work",
        model: "claude-sonnet-4-5",
        currentTool: "read",
        currentToolArgs: "/path/to/file.txt",
        recentTools: [{tool: "read", args: "/path/file1.txt"}, {tool: "bash", args: "ls -la"}],
        recentOutput: ["Processing...", "Step 1 complete"],
        toolCount: 5,
        tokens: 1000,
        durationMs: 5000
      }
      expect(progress.id).toBe("test-id")
      expect(progress.status).toBe("running")
      expect(progress.toolCount).toBe(5)
      expect(progress.currentTool).toBe("read")
    })

    test("all progress statuses are valid", () => {
      const statuses: Array<TaskProgress["status"]> = ["pending", "running", "completed", "failed", "aborted"]
      for (const status of statuses) {
        const progress: TaskProgress = {
          id: "test",
          status,
          task: "Test",
          recentTools: [],
          recentOutput: [],
          toolCount: 0,
          tokens: 0,
          durationMs: 0
        }
        expect(progress.status).toBe(status)
      }
    })
  })

  describe("Result Types", () => {
    test("TaskResult structure is valid", () => {
      const result: TaskResult = {
        id: "test-id",
        task: "Test task",
        exitCode: 0,
        output: "Success",
        stderr: "",
        truncated: false,
        durationMs: 1000,
        usage: {
          input: 100,
          output: 500,
          cacheRead: 0,
          cacheWrite: 0,
          cost: 0.01,
          contextTokens: 1000,
          turns: 1
        }
      }
      expect(result.exitCode).toBe(0)
      expect(result.output).toBe("Success")
      expect(result.usage.turns).toBe(1)
    })

    test("TaskResult with error", () => {
      const result: TaskResult = {
        id: "test-id",
        task: "Test task",
        exitCode: 1,
        output: "",
        stderr: "Error",
        truncated: false,
        durationMs: 100,
        usage: {
          input: 50,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          cost: 0.005,
          contextTokens: 500,
          turns: 0
        },
        error: "Error"
      }
      expect(result.exitCode).toBe(1)
      expect(result.error).toBe("Error")
    })

    test("ParallelToolDetails structure is valid", () => {
      const details: ParallelToolDetails = {
        mode: "parallel",
        results: [],
        totalDurationMs: 5000,
        usage: {
          input: 1000,
          output: 5000,
          cacheRead: 100,
          cacheWrite: 50,
          cost: 0.15,
          contextTokens: 10000,
          turns: 10
        }
      }
      expect(details.mode).toBe("parallel")
      expect(details.results.length).toBe(0)
      expect(details.totalDurationMs).toBe(5000)
    })

    test("ParallelToolDetails with winner", () => {
      const details: ParallelToolDetails = {
        mode: "race",
        results: [],
        totalDurationMs: 500,
        usage: {
          input: 100,
          output: 200,
          cacheRead: 0,
          cacheWrite: 0,
          cost: 0.01,
          contextTokens: 1000,
          turns: 1
        },
        winner: "model-1"
      }
      expect(details.mode).toBe("race")
      expect(details.winner).toBe("model-1")
    })

    test("ParallelToolDetails with DAG info", () => {
      const details: ParallelToolDetails = {
        mode: "team",
        results: [],
        totalDurationMs: 10000,
        usage: {
          input: 1000,
          output: 2000,
          cacheRead: 0,
          cacheWrite: 0,
          cost: 0.1,
          contextTokens: 10000,
          turns: 5
        },
        dagInfo: {
          objective: "Complete project",
          members: [{role: "worker"}, {role: "reviewer"}],
          tasks: [
            {id: "task1", assignee: "worker", depends: [], status: "completed"},
            {id: "task2", assignee: "reviewer", depends: ["task1"], status: "completed"}
          ]
        }
      }
      expect(details.mode).toBe("team")
      expect(details.dagInfo?.objective).toBe("Complete project")
      expect(details.dagInfo?.members.length).toBe(2)
    })

    test("UsageStats can be created", () => {
      const usage: UsageStats = {
        input: 1000,
        output: 5000,
        cacheRead: 100,
        cacheWrite: 50,
        cost: 0.15,
        contextTokens: 10000,
        turns: 5
      }
      expect(usage.input).toBe(1000)
      expect(usage.cost).toBe(0.15)
      expect(usage.turns).toBe(5)
    })
  })
})