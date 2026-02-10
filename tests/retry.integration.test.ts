import {describe, expect, test, vi} from "vitest"
import {runAgentWithRetry} from "../src/executor.js"
import type {TaskResult} from "../src/types.js"

describe("retry integration", () => {
  test("runAgentWithRetry integrates with retry config", async () => {
    let attemptCount = 0

    // Mock the actual runAgent function
    const mockRunAgent = vi.fn().mockImplementation(async options => {
      attemptCount++

      // First two attempts fail
      if (attemptCount < 3) {
        return {
          id: options.id,
          task: options.task,
          model: options.model,
          exitCode: 1,
          output: "",
          stderr: `Attempt ${attemptCount} failed with network error`,
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
          },
          error: "network error: connection timeout"
        } as TaskResult
      }

      // Third attempt succeeds
      return {
        id: options.id,
        task: options.task,
        model: options.model,
        exitCode: 0,
        output: "Success after retries",
        stderr: "",
        truncated: false,
        durationMs: 200,
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          cost: 0,
          contextTokens: 0,
          turns: 0
        }
      } as TaskResult
    })

    const result = await runAgentWithRetry(
      {
        task: "Test network operation",
        cwd: "/tmp",
        id: "test-retry-integration",
        retry: {
          maxAttempts: 4,
          backoffMs: 10,
          retryOn: ["network error", "timeout"]
        }
      },
      mockRunAgent
    )

    expect(result.exitCode).toBe(0)
    expect(result.output).toBe("Success after retries")
    expect(attemptCount).toBe(3)
    expect(mockRunAgent).toHaveBeenCalledTimes(3)
  })

  test("runAgentWithRetry respects skipOn patterns", async () => {
    let attemptCount = 0

    const mockRunAgent = vi.fn().mockImplementation(async options => {
      attemptCount++
      return {
        id: options.id,
        task: options.task,
        model: options.model,
        exitCode: 1,
        output: "",
        stderr: "fatal error: cannot recover",
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
        },
        error: "fatal error"
      } as TaskResult
    })

    const result = await runAgentWithRetry(
      {
        task: "Test fatal error",
        cwd: "/tmp",
        id: "test-skipon",
        retry: {
          maxAttempts: 3,
          backoffMs: 10,
          retryOn: ["error"],
          skipOn: ["fatal error"] // Should not retry on fatal errors
        }
      },
      mockRunAgent
    )

    expect(result.exitCode).toBe(1)
    expect(result.error).toContain("fatal error")
    expect(attemptCount).toBe(1) // Only tried once, no retries
    expect(mockRunAgent).toHaveBeenCalledTimes(1)
  })
})
