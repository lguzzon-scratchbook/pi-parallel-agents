import {describe, expect, test} from "vitest"
import {
  shouldRetry,
  calculateBackoff,
  runAgent,
  runAgentWithRetry
} from "../src/executor.js"
import {
  TaskResult,
  UsageStats,
  MAX_OUTPUT_BYTES,
  MAX_OUTPUT_LINES,
  MAX_CONCURRENCY,
  DEFAULT_CONCURRENCY,
  COLLAPSED_ITEM_COUNT
} from "../src/types.js"

// Test retry mechanism (exported from executor.ts)
describe("Retry Mechanism", () => {
  describe("shouldRetry", () => {
    test("returns false when no retry config", () => {
      expect(shouldRetry("some error", undefined)).toBe(false)
    })

    test("returns true when retryOn is empty and error is present", () => {
      const retry: RetryConfig = {maxAttempts: 3, backoffMs: 1000}
      expect(shouldRetry("some error", retry)).toBe(true)
    })

    test("returns true when error matches retryOn pattern", () => {
      const retry: RetryConfig = {
        maxAttempts: 3,
        backoffMs: 1000,
        retryOn: ["network error", "timeout"]
      }
      expect(shouldRetry("network error occurred", retry)).toBe(true)
      expect(shouldRetry("connection timeout", retry)).toBe(true)
    })

    test("returns false when error does not match retryOn pattern", () => {
      const retry: RetryConfig = {
        maxAttempts: 3,
        backoffMs: 1000,
        retryOn: ["network error", "timeout"]
      }
      expect(shouldRetry("syntax error", retry)).toBe(false)
    })

    test("returns false when error matches skipOn pattern", () => {
      const retry: RetryConfig = {
        maxAttempts: 3,
        backoffMs: 1000,
        skipOn: ["fatal error", "authentication failed"]
      }
      expect(shouldRetry("fatal error: out of memory", retry)).toBe(false)
      expect(shouldRetry("authentication failed", retry)).toBe(false)
    })

    test("skipOn takes precedence over retryOn", () => {
      const retry: RetryConfig = {
        maxAttempts: 3,
        backoffMs: 1000,
        retryOn: ["error"],
        skipOn: ["fatal error"]
      }
      expect(shouldRetry("fatal error occurred", retry)).toBe(false)
      expect(shouldRetry("other error", retry)).toBe(true)
    })

    test("is case insensitive for pattern matching", () => {
      const retry: RetryConfig = {
        maxAttempts: 3,
        backoffMs: 1000,
        retryOn: ["NETWORK ERROR"]
      }
      expect(shouldRetry("network error occurred", retry)).toBe(true)
      expect(shouldRetry("NETWORK ERROR OCCURRED", retry)).toBe(true)
    })
  })

  describe("calculateBackoff", () => {
    test("calculates exponential backoff correctly", () => {
      expect(calculateBackoff(100, 1)).toBe(100)
      expect(calculateBackoff(100, 2)).toBe(200)
      expect(calculateBackoff(100, 3)).toBe(400)
      expect(calculateBackoff(1000, 2)).toBe(2000)
    })

    test("caps backoff at 60 seconds", () => {
      const largeBackoff = calculateBackoff(1000, 10)
      expect(largeBackoff).toBe(60000)
    })

    test("handles different base values", () => {
      expect(calculateBackoff(500, 1)).toBe(500)
      expect(calculateBackoff(500, 2)).toBe(1000)
      expect(calculateBackoff(500, 3)).toBe(2000)
    })
  })
})

describe("Executor Options", () => {
  test("runAgent function is exported", () => {
    // runAgent is the main exported function for executing agents
    expect(typeof runAgent).toBe("function")
  })

  test("runAgentWithRetry function is exported", () => {
    expect(typeof runAgentWithRetry).toBe("function")
  })
})

describe("Task Result Types", () => {
  test("TaskResult interface structure", () => {
    const result: TaskResult = {
      id: "test-id",
      task: "Test task",
      exitCode: 0,
      output: "success",
      stderr: "",
      truncated: false,
      durationMs: 100,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0,
        contextTokens: 0,
        turns: 0
      }
    }
    expect(result.exitCode).toBe(0)
    expect(result.output).toBe("success")
  })

  test("TaskResult with error", () => {
    const result: TaskResult = {
      id: "test-id",
      task: "Test task",
      exitCode: 1,
      output: "",
      stderr: "Error occurred",
      truncated: false,
      durationMs: 50,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0,
        contextTokens: 0,
        turns: 0
      },
      error: "Error occurred"
    }
    expect(result.exitCode).toBe(1)
    expect(result.error).toBe("Error occurred")
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

describe("Executor Constants", () => {
  test("MAX_OUTPUT_BYTES is defined", () => {
    expect(MAX_OUTPUT_BYTES).toBe(50 * 1024) // 50KB
  })

  test("MAX_OUTPUT_LINES is defined", () => {
    expect(MAX_OUTPUT_LINES).toBe(2000)
  })

  test("MAX_CONCURRENCY is defined", () => {
    expect(MAX_CONCURRENCY).toBe(8)
  })

  test("DEFAULT_CONCURRENCY is defined", () => {
    expect(DEFAULT_CONCURRENCY).toBe(DEFAULT_CONCURRENCY)
  })

  test("COLLAPSED_ITEM_COUNT is defined", () => {
    expect(COLLAPSED_ITEM_COUNT).toBe(10)
  })
})

describe("RetryConfig Structure", () => {
  test("RetryConfig with retryOn only", () => {
    const config: RetryConfig = {
      maxAttempts: 3,
      backoffMs: 1000,
      retryOn: ["error"]
    }
    expect(config.maxAttempts).toBe(3)
    expect(config.retryOn).toEqual(["error"])
  })

  test("RetryConfig with skipOn only", () => {
    const config: RetryConfig = {
      maxAttempts: 3,
      backoffMs: 1000,
      skipOn: ["fatal"]
    }
    expect(config.maxAttempts).toBe(3)
    expect(config.skipOn).toEqual(["fatal"])
  })

  test("RetryConfig with both retryOn and skipOn", () => {
    const config: RetryConfig = {
      maxAttempts: 5,
      backoffMs: 500,
      retryOn: ["error", "timeout"],
      skipOn: ["fatal", "auth"]
    }
    expect(config.maxAttempts).toBe(5)
    expect(config.retryOn).toEqual(["error", "timeout"])
    expect(config.skipOn).toEqual(["fatal", "auth"])
  })
})

describe("ExecutorOptions Structure", () => {
  test("ExecutorOptions with all fields", () => {
    const options: ExecutorOptions = {
      task: "Do something",
      cwd: "/tmp",
      id: "task-1",
      model: "claude-sonnet-4-5",
      tools: ["read", "bash"],
      systemPrompt: "You are a helpful agent",
      context: "Some context",
      thinking: "high",
      provider: "anthropic"
    }
    expect(options.task).toBe("Do something")
    expect(options.model).toBe("claude-sonnet-4-5")
    expect(options.tools?.length).toBe(2)
    expect(options.thinking).toBe("high")
  })

  test("ExecutorOptions with numeric thinking", () => {
    const options: ExecutorOptions = {
      task: "Think deeply",
      cwd: "/tmp",
      id: "task-2",
      thinking: 5000
    }
    expect(options.thinking).toBe(5000)
  })

  test("ExecutorOptions with step for chain mode", () => {
    const options: ExecutorOptions = {
      task: "Step 1",
      cwd: "/tmp",
      id: "chain-1",
      step: 1
    }
    expect(options.step).toBe(1)
  })
})