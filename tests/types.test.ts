import {describe, expect, test, beforeEach} from "vitest"
import * as fs from "node:fs"
import * as path from "node:path"
import {
  createEmptyUsage,
  addUsage,
  type UsageStats
} from "../src/types.ts"

describe("Types", () => {
  describe("UsageStats", () => {
    test("createEmptyUsage returns zero values", () => {
      const usage = createEmptyUsage()
      expect(usage.input).toBe(0)
      expect(usage.output).toBe(0)
      expect(usage.cacheRead).toBe(0)
      expect(usage.cacheWrite).toBe(0)
      expect(usage.cost).toBe(0)
      expect(usage.contextTokens).toBe(0)
      expect(usage.turns).toBe(0)
    })

    test("addUsage adds values correctly", () => {
      const target: UsageStats = createEmptyUsage()
      const source: Partial<UsageStats> = {
        input: 100,
        output: 200,
        cacheRead: 50,
        cacheWrite: 25,
        cost: 0.5,
        contextTokens: 500,
        turns: 3
      }

      addUsage(target, source)

      expect(target.input).toBe(100)
      expect(target.output).toBe(200)
      expect(target.cacheRead).toBe(50)
      expect(target.cacheWrite).toBe(25)
      expect(target.cost).toBe(0.5)
      expect(target.contextTokens).toBe(500)
      expect(target.turns).toBe(3)
    })

    test("addUsage accumulates values", () => {
      const target: UsageStats = createEmptyUsage()

      addUsage(target, { input: 100 })
      addUsage(target, { input: 50 })

      expect(target.input).toBe(150)
    })

    test("addUsage handles undefined source values", () => {
      const target: UsageStats = createEmptyUsage()
      target.input = 100

      addUsage(target, { input: undefined as any })

      expect(target.input).toBe(100)
    })

    test("addUsage handles partial objects", () => {
      const target: UsageStats = createEmptyUsage()

      addUsage(target, { input: 100, output: 50 })
      addUsage(target, { cost: 0.5 })

      expect(target.input).toBe(100)
      expect(target.output).toBe(50)
      expect(target.cost).toBe(0.5)
    })

    test("addUsage does not reset other fields", () => {
      const target: UsageStats = createEmptyUsage()
      target.input = 100
      target.output = 200

      addUsage(target, { cost: 0.5 })

      expect(target.input).toBe(100)
      expect(target.output).toBe(200)
      expect(target.cost).toBe(0.5)
    })
  })
})