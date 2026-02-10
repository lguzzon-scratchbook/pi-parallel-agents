import {describe, expect, test} from "vitest"
import {shouldRetry} from "../src/executor.js"

// Test TaskModifications interface structure
describe("TaskModifications interface", () => {
  test("TaskModifications can have newTasks property", () => {
    const mods = {
      newTasks: [{id: "new-task", task: "New task", assignee: "worker"}]
    }
    expect(mods.newTasks).toBeDefined()
    expect(mods.newTasks?.length).toBe(1)
  })

  test("TaskModifications can have updateDependencies property", () => {
    const mods = {updateDependencies: {"task-2": ["task-1"]}}
    expect(mods.updateDependencies).toBeDefined()
    expect(mods.updateDependencies?.["task-2"]).toEqual(["task-1"])
  })

  test("TaskModifications can have markFailed property", () => {
    const mods = {markFailed: ["task-1", "task-2"]}
    expect(mods.markFailed).toBeDefined()
    expect(mods.markFailed?.length).toBe(2)
  })
})

describe("retry with skipOn patterns", () => {
  test("skipOn prevents retry on matching patterns", () => {
    const retry = {
      maxAttempts: 3,
      backoffMs: 1000,
      skipOn: ["fatal error", "authentication failed"]
    }

    // These should NOT be retried (skipOn takes precedence)
    expect(shouldRetry("fatal error: out of memory", retry)).toBe(false)
    expect(shouldRetry("authentication failed", retry)).toBe(false)
  })
})
