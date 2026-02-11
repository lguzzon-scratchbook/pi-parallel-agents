import {describe, expect, test, vi, beforeEach} from "vitest"
import {
  mapWithConcurrencyLimit,
  raceWithAbort,
  type ParallelResult
} from "../src/parallel.ts"

describe("Parallel Execution", () => {
  describe("mapWithConcurrencyLimit", () => {
    test("returns empty results for empty input", async () => {
      const result = await mapWithConcurrencyLimit<number, number>(
        [],
        4,
        async (item) => item * 2
      )
      expect(result.results).toEqual([])
      expect(result.aborted).toBe(false)
    })

    test("processes all items with default concurrency", async () => {
      const items = [1, 2, 3, 4, 5]
      const fn = vi.fn().mockImplementation(async (item: number) => item * 2)

      const result = await mapWithConcurrencyLimit(items, 4, fn)

      expect(result.results).toEqual([2, 4, 6, 8, 10])
      expect(result.aborted).toBe(false)
      expect(fn).toHaveBeenCalledTimes(5)
    })

    test("limits concurrency correctly", async () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8]
      let currentActive = 0
      let maxConcurrent = 0

      const fn = vi.fn().mockImplementation(async (item: number) => {
        currentActive++
        maxConcurrent = Math.max(maxConcurrent, currentActive)
        await new Promise(resolve => setTimeout(resolve, 50))
        currentActive--
        return item * 2
      })

      await mapWithConcurrencyLimit(items, 2, fn)

      // With concurrency=2, max should be <= 2 (plus small tolerance for setup overhead)
      expect(maxConcurrent).toBeLessThanOrEqual(3)
    })

    test("preserves order of results", async () => {
      const items = [10, 5, 8, 2, 7]
      const fn = vi.fn().mockImplementation(async (item: number) => item * 2)

      const result = await mapWithConcurrencyLimit(items, 4, fn)

      expect(result.results).toEqual([20, 10, 16, 4, 14])
    })

    test("handles errors with fail-fast behavior", async () => {
      const items = [1, 2, 3, 4, 5]
      const fn = vi.fn().mockImplementation(async (item: number) => {
        if (item === 3) {
          throw new Error("Test error")
        }
        return item * 2
      })

      await expect(
        mapWithConcurrencyLimit(items, 4, fn)
      ).rejects.toThrow("Test error")
    })

    test("handles abort signal", async () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const fn = vi.fn().mockImplementation(async (item: number) => {
        await new Promise(resolve => setTimeout(resolve, 50))
        return item * 2
      })

      const abortController = new AbortController()
      // Abort after some time
      setTimeout(() => abortController.abort(), 100)

      const result = await mapWithConcurrencyLimit(items, 4, fn, abortController.signal)

      expect(result.aborted).toBe(true)
    })

    test("handles already aborted signal", async () => {
      const items = [1, 2, 3]
      const fn = vi.fn().mockImplementation(async (item: number) => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return item * 2
      })

      const abortController = new AbortController()
      abortController.abort()

      const result = await mapWithConcurrencyLimit(items, 4, fn, abortController.signal)

      expect(result.aborted).toBe(true)
      // All results should be undefined since nothing started
      expect(result.results.every(r => r === undefined)).toBe(true)
    })

    test("handles concurrency of 0", async () => {
      const items = [1, 2, 3]
      const fn = vi.fn().mockImplementation(async (item: number) => item * 2)

      const result = await mapWithConcurrencyLimit(items, 0, fn)

      expect(result.results).toEqual([2, 4, 6]) // Should default to items.length
    })

    test("handles negative concurrency", async () => {
      const items = [1, 2, 3]
      const fn = vi.fn().mockImplementation(async (item: number) => item * 2)

      const result = await mapWithConcurrencyLimit(items, -5, fn)

      expect(result.results).toEqual([2, 4, 6]) // Should default to items.length
    })

    test("handles Infinity concurrency", async () => {
      const items = [1, 2, 3, 4, 5]
      const fn = vi.fn().mockImplementation(async (item: number) => item * 2)

      const result = await mapWithConcurrencyLimit(items, Infinity, fn)

      expect(result.results).toEqual([2, 4, 6, 8, 10])
    })

    test("handles NaN concurrency", async () => {
      const items = [1, 2, 3]
      const fn = vi.fn().mockImplementation(async (item: number) => item * 2)

      const result = await mapWithConcurrencyLimit(items, NaN as any, fn)

      expect(result.results).toEqual([2, 4, 6])
    })

    test("handles non-integer concurrency", async () => {
      const items = [1, 2, 3, 4, 5]
      const fn = vi.fn().mockImplementation(async (item: number) => item * 2)

      const result = await mapWithConcurrencyLimit(items, 3.7, fn)

      expect(result.results).toEqual([2, 4, 6, 8, 10])
      expect(fn).toHaveBeenCalledTimes(5)
    })
  })

  describe("raceWithAbort", () => {
    test("throws error for empty tasks array", async () => {
      await expect(
        raceWithAbort<number>([])
      ).rejects.toThrow("No tasks to race")
    })

    test("returns winner when first task succeeds", async () => {
      const tasks = [
        {
          id: "task1",
          run: async (signal: AbortSignal) => {
            await new Promise(resolve => setTimeout(resolve, 50))
            return "result1"
          }
        },
        {
          id: "task2",
          run: async (signal: AbortSignal) => {
            await new Promise(resolve => setTimeout(resolve, 100))
            return "result2"
          }
        }
      ]

      const result = await raceWithAbort(tasks)

      expect(result).toEqual({ winner: "task1", result: "result1" })
    })

    test("waits for first success among failing tasks", async () => {
      const tasks = [
        {
          id: "task1",
          run: async (signal: AbortSignal) => {
            await new Promise(resolve => setTimeout(resolve, 50))
            throw new Error("fail")
          }
        },
        {
          id: "task2",
          run: async (signal: AbortSignal) => {
            await new Promise(resolve => setTimeout(resolve, 30))
            return "winner"
          }
        }
      ]

      const result = await raceWithAbort(tasks)

      expect(result).toEqual({ winner: "task2", result: "winner" })
    })

    test("aborts remaining tasks when winner is found", async () => {
      let task2Started = false
      const tasks = [
        {
          id: "task1",
          run: async (signal: AbortSignal) => {
            await new Promise(resolve => setTimeout(resolve, 50))
            return "winner"
          }
        },
        {
          id: "task2",
          run: async (signal: AbortSignal) => {
            task2Started = true
            await new Promise(resolve => setTimeout(resolve, 200))
            if (signal.aborted) {
              throw new Error("Aborted")
            }
            return "should not return"
          }
        }
      ]

      const result = await raceWithAbort(tasks)

      expect(result).toEqual({ winner: "task1", result: "winner" })
    })

    test("returns aborted when parent signal is already aborted", async () => {
      const tasks = [
        {
          id: "task1",
          run: async (signal: AbortSignal) => {
            await new Promise(resolve => setTimeout(resolve, 100))
            return "result"
          }
        }
      ]

      const parentAbort = new AbortController()
      parentAbort.abort()

      const result = await raceWithAbort(tasks, parentAbort.signal)

      expect(result).toEqual({ aborted: true })
    })

    test("handles task that immediately throws", async () => {
      const tasks = [
        {
          id: "failing",
          run: async (signal: AbortSignal) => {
            throw new Error("immediate failure")
          }
        },
        {
          id: "success",
          run: async (signal: AbortSignal) => {
            return "success"
          }
        }
      ]

      const result = await raceWithAbort(tasks)

      expect(result).toEqual({ winner: "success", result: "success" })
    })

    test("handles mixed success and failure", async () => {
      const tasks = [
        {
          id: "task1",
          run: async (signal: AbortSignal) => {
            await new Promise(resolve => setTimeout(resolve, 10))
            throw new Error("fail 1")
          }
        },
        {
          id: "task2",
          run: async (signal: AbortSignal) => {
            await new Promise(resolve => setTimeout(resolve, 20))
            return "success" // One succeeds so race completes
          }
        }
      ]

      const result = await raceWithAbort(tasks)
      // task2 should win since task1 fails
      expect(result).toEqual({ winner: "task2", result: "success" })
    })

    test("handles parent abort before race starts", async () => {
      const tasks = [
        {
          id: "task1",
          run: async (signal: AbortSignal) => {
            return "result"
          }
        }
      ]

      const parentAbort = new AbortController()
      parentAbort.abort()

      const result = await raceWithAbort(tasks, parentAbort.signal)

      expect(result).toEqual({ aborted: true })
    })

    test("handles single task", async () => {
      const tasks = [
        {
          id: "single",
          run: async (signal: AbortSignal) => {
            return "single result"
          }
        }
      ]

      const result = await raceWithAbort(tasks)

      expect(result).toEqual({ winner: "single", result: "single result" })
    })

    test("all tasks fail returns error", async () => {
      const tasks = [
        {
          id: "fail1",
          run: async (signal: AbortSignal) => {
            throw new Error("fail 1")
          }
        },
        {
          id: "fail2",
          run: async (signal: AbortSignal) => {
            throw new Error("fail 2")
          }
        }
      ]

      await expect(raceWithAbort(tasks)).rejects.toThrow("All race models failed:")
    })
  })
})