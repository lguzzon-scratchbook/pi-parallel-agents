import {describe, expect, test, vi} from "vitest"
import {
  calculateBackoff,
  runAgentWithRetry,
  shouldRetry
} from "../src/executor.js"

describe("retry mechanism", () => {
  test("shouldRetry - returns false when no retry config", () => {
    expect(shouldRetry("some error", undefined)).toBe(false)
  })

  test("shouldRetry - returns true when retryOn is empty and error is present", () => {
    const retry = {maxAttempts: 3, backoffMs: 1000}
    expect(shouldRetry("some error", retry)).toBe(true)
  })

  test("shouldRetry - returns true when error matches retryOn pattern", () => {
    const retry = {
      maxAttempts: 3,
      backoffMs: 1000,
      retryOn: ["network error", "timeout"]
    }
    expect(shouldRetry("network error occurred", retry)).toBe(true)
    expect(shouldRetry("connection timeout", retry)).toBe(true)
  })

  test("shouldRetry - returns false when error does not match retryOn pattern", () => {
    const retry = {
      maxAttempts: 3,
      backoffMs: 1000,
      retryOn: ["network error", "timeout"]
    }
    expect(shouldRetry("syntax error", retry)).toBe(false)
  })

  test("shouldRetry - returns false when error matches skipOn pattern", () => {
    const retry = {
      maxAttempts: 3,
      backoffMs: 1000,
      skipOn: ["fatal error", "authentication failed"]
    }
    expect(shouldRetry("fatal error: out of memory", retry)).toBe(false)
    expect(shouldRetry("authentication failed", retry)).toBe(false)
  })

  test("shouldRetry - skipOn takes precedence over retryOn", () => {
    const retry = {
      maxAttempts: 3,
      backoffMs: 1000,
      retryOn: ["error"],
      skipOn: ["fatal error"]
    }
    expect(shouldRetry("fatal error occurred", retry)).toBe(false)
    expect(shouldRetry("other error", retry)).toBe(true)
  })

  test("calculateBackoff - calculates exponential backoff correctly", () => {
    expect(calculateBackoff(100, 1)).toBe(100)
    expect(calculateBackoff(100, 2)).toBe(200)
    expect(calculateBackoff(100, 3)).toBe(400)
    expect(calculateBackoff(1000, 2)).toBe(2000)
  })

  test("calculateBackoff - caps backoff at 60 seconds", () => {
    const largeBackoff = calculateBackoff(1000, 10)
    expect(largeBackoff).toBe(60000)
  })

  test("runAgentWithRetry - succeeds on first attempt if no error", async () => {
    const mockRunAgent = vi
      .fn()
      .mockResolvedValue({
        id: "test",
        task: "test task",
        model: undefined,
        exitCode: 0,
        output: "success",
        stderr: "",
        truncated: false,
        durationMs: 0,
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          cost: 0,
          contextTokens: 0,
          turns: 0
        }
      })

    const result = await runAgentWithRetry(
      {task: "test", cwd: "/tmp", id: "test"},
      mockRunAgent
    )

    expect(result.exitCode).toBe(0)
    expect(result.output).toBe("success")
    expect(mockRunAgent).toHaveBeenCalledTimes(1)
  })

  test("runAgentWithRetry - retries failed task and succeeds", async () => {
    let attemptCount = 0
    const mockRunAgent = vi.fn().mockImplementation(() => {
      attemptCount++
      if (attemptCount < 3) {
        return Promise.resolve({
          id: "test",
          task: "test task",
          model: undefined,
          exitCode: 1,
          output: "",
          stderr: "temporary error",
          truncated: false,
          durationMs: 0,
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            cost: 0,
            contextTokens: 0,
            turns: 0
          },
          error: "temporary error"
        })
      }
      return Promise.resolve({
        id: "test",
        task: "test task",
        model: undefined,
        exitCode: 0,
        output: "success",
        stderr: "",
        truncated: false,
        durationMs: 0,
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          cost: 0,
          contextTokens: 0,
          turns: 0
        }
      })
    })

    const result = await runAgentWithRetry(
      {
        task: "test",
        cwd: "/tmp",
        id: "test",
        retry: {maxAttempts: 3, backoffMs: 10}
      },
      mockRunAgent
    )

    expect(result.exitCode).toBe(0)
    expect(result.output).toBe("success")
    expect(mockRunAgent).toHaveBeenCalledTimes(3)
  })

  test("runAgentWithRetry - fails after max attempts exceeded", async () => {
    const mockRunAgent = vi
      .fn()
      .mockResolvedValue({
        id: "test",
        task: "test task",
        model: undefined,
        exitCode: 1,
        output: "",
        stderr: "persistent error",
        truncated: false,
        durationMs: 0,
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          cost: 0,
          contextTokens: 0,
          turns: 0
        },
        error: "persistent error"
      })

    const result = await runAgentWithRetry(
      {
        task: "test",
        cwd: "/tmp",
        id: "test",
        retry: {maxAttempts: 3, backoffMs: 10}
      },
      mockRunAgent
    )

    expect(result.exitCode).toBe(1)
    expect(mockRunAgent).toHaveBeenCalledTimes(3)
    expect(result.error).toContain("persistent error")
  })
})
