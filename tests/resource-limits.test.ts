import {describe, expect, test} from "vitest"
import type {ResourceLimits} from "../src/types.js"

describe("ResourceLimits interface", () => {
  test("ResourceLimits can specify maxMemoryMB", () => {
    const limits: ResourceLimits = {maxMemoryMB: 512}
    expect(limits.maxMemoryMB).toBe(512)
  })

  test("ResourceLimits can specify maxDurationMs", () => {
    const limits: ResourceLimits = {
      maxDurationMs: 300000 // 5 minutes
    }
    expect(limits.maxDurationMs).toBe(300000)
  })

  test("ResourceLimits can specify maxConcurrentToolCalls", () => {
    const limits: ResourceLimits = {maxConcurrentToolCalls: 10}
    expect(limits.maxConcurrentToolCalls).toBe(10)
  })

  test("ResourceLimits can specify enforceLimits flag", () => {
    const limits: ResourceLimits = {enforceLimits: true}
    expect(limits.enforceLimits).toBe(true)
  })

  test("ResourceLimits can combine all options", () => {
    const limits: ResourceLimits = {
      maxMemoryMB: 1024,
      maxDurationMs: 600000,
      maxConcurrentToolCalls: 8,
      enforceLimits: true
    }
    expect(limits.maxMemoryMB).toBe(1024)
    expect(limits.maxDurationMs).toBe(600000)
    expect(limits.maxConcurrentToolCalls).toBe(8)
    expect(limits.enforceLimits).toBe(true)
  })
})
