import {describe, expect, test, vi, beforeEach} from "vitest"
import type {TeamConfig, TeamTask, TeamMember, DagNode, DagExecutionResult} from "../src/types.js"

describe("DAG Module", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Module Exports", () => {
    test("buildDag is exported", async () => {
      const mod = await import("../src/dag.js")
      expect(mod.buildDag).toBeDefined()
      expect(typeof mod.buildDag).toBe("function")
    })

    test("executeDag is exported", async () => {
      const mod = await import("../src/dag.js")
      expect(mod.executeDag).toBeDefined()
      expect(typeof mod.executeDag).toBe("function")
    })
  })

  describe("DAG Types", () => {
    test("TeamConfig can be created", () => {
      const config: TeamConfig = {
        objective: "Complete project",
        members: [
          {role: "worker", model: "claude-sonnet-4-5"}
        ],
        tasks: [
          {id: "task1", task: "Do work", assignee: "worker"}
        ]
      }
      expect(config.objective).toBe("Complete project")
      expect(config.members.length).toBe(1)
      expect(config.tasks?.length).toBe(1)
    })

    test("TeamMember without default task", () => {
      const member: TeamMember = {
        role: "worker",
        model: "claude-sonnet-4-5",
        tools: ["read", "bash"]
      }
      expect(member.role).toBe("worker")
      expect(member.tools?.length).toBe(2)
    })

    test("TeamTask with dependencies", () => {
      const task: TeamTask = {
        id: "task2",
        task: "Second task",
        assignee: "worker",
        depends: ["task1"]
      }
      expect(task.depends?.length).toBe(1)
      expect(task.depends![0]).toBe("task1")
    })

    test("TeamTask with review config", () => {
      const task: TeamTask = {
        id: "review",
        task: "Review work",
        assignee: "reviewer",
        review: {
          assignee: "reviewer",
          maxIterations: 5,
          task: "Review the output"
        }
      }
      expect(task.review?.maxIterations).toBe(5)
      expect(task.review?.task).toBe("Review the output")
    })

    test("DagNode structure", () => {
      const node: DagNode = {
        id: "task1",
        task: "Do work",
        assignee: "worker",
        member: {
          role: "worker",
          model: "claude-sonnet-4-5"
        },
        depends: [],
        status: "pending"
      }
      expect(node.id).toBe("task1")
      expect(node.status).toBe("pending")
    })

    test("DagExecutionResult structure", () => {
      const result: DagExecutionResult = {
        id: "task1",
        output: "Done",
        exitCode: 0
      }
      expect(result.exitCode).toBe(0)
      expect(result.output).toBe("Done")
    })
  })

  describe("TeamConfig Variations", () => {
    test("TeamConfig with maxConcurrency", () => {
      const config: TeamConfig = {
        objective: "Complete project",
        members: [{role: "worker"}],
        tasks: [{id: "task1", task: "Work"}],
        maxConcurrency: 8
      }
      expect(config.maxConcurrency).toBe(8)
    })

    test("TeamConfig with empty tasks array", () => {
      const config: TeamConfig = {
        objective: "Complete project",
        members: [{role: "worker"}],
        tasks: []
      }
      expect(config.tasks?.length).toBe(0)
    })

    test("TeamTask with requiresApproval", () => {
      const task: TeamTask = {
        id: "plan",
        task: "Create plan",
        assignee: "planner",
        requiresApproval: true
      }
      expect(task.requiresApproval).toBe(true)
    })
  })
})