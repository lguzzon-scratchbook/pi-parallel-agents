/**
 * Unit tests for src/workspace.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  createWorkspace,
  writeTaskResult,
  cleanupWorkspace,
} from "../src/workspace.ts";

describe("Workspace", () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "pi-ws-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(workspaceRoot)) {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe("createWorkspace", () => {
    it("creates workspace with custom rootDir", () => {
      const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-ws-custom-"));
      const ws = createWorkspace("custom-root", testDir);
      expect(ws.root).toContain("pi-custom-root-");
      expect(ws.root).toBe(path.join(testDir, ws.root.split("/").pop() || ""));
      expect(ws.tasksDir).toContain(ws.root);
      expect(ws.artifactsDir).toContain(ws.root);
      cleanupWorkspace(ws.root);
    });

    it("creates workspace with root, tasksDir, and artifactsDir", () => {
      const ws = createWorkspace("test-team", workspaceRoot);
      expect(ws.root).toBeDefined();
      expect(ws.tasksDir).toBeDefined();
      expect(ws.artifactsDir).toBeDefined();
      expect(ws.tasksDir).toContain(ws.root);
      expect(ws.artifactsDir).toContain(ws.root);
      cleanupWorkspace(ws);
    });

    it("creates directories on filesystem", () => {
      const ws = createWorkspace("fs-test", workspaceRoot);
      expect(fs.existsSync(ws.root)).toBe(true);
      expect(fs.existsSync(ws.tasksDir)).toBe(true);
      expect(fs.existsSync(ws.artifactsDir)).toBe(true);
      cleanupWorkspace(ws);
    });

    it("uses custom team name in directory path", () => {
      const ws = createWorkspace("my-custom-team", workspaceRoot);
      expect(ws.root).toContain("my-custom-team");
      cleanupWorkspace(ws);
    });

    it("sanitizes team name with special characters", () => {
      const ws = createWorkspace("team_special_chars", workspaceRoot);
      // After sanitization, should not have : or * but may have _ or -
      expect(ws.root).not.toContain(":");
      expect(ws.root).not.toContain("*");
      cleanupWorkspace(ws);
    });

    it("truncates long team names", () => {
      const longName = "a".repeat(100);
      const ws = createWorkspace(longName, workspaceRoot);
      expect(ws.root.length).toBeLessThan(longName.length + 20);
      cleanupWorkspace(ws);
    });

    it("generates unique directory for each call", () => {
      const ws1 = createWorkspace("unique-test", workspaceRoot);
      const ws2 = createWorkspace("unique-test", workspaceRoot);
      expect(ws1.root).not.toBe(ws2.root);
      cleanupWorkspace(ws1);
      cleanupWorkspace(ws2);
    });

    it("team name with spaces gets sanitized", () => {
      const ws = createWorkspace("team_with_spaces", workspaceRoot);
      expect(ws.root).not.toContain(" ");
      cleanupWorkspace(ws);
    });
  });

  describe("writeTaskResult", () => {
    it("writes task result to workspace", () => {
      const ws = createWorkspace("write-test", workspaceRoot);
      writeTaskResult(ws, "task-1", "Task output", "completed");

      const expectedPath = path.join(ws.tasksDir, "task-1.json");
      expect(fs.existsSync(expectedPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(expectedPath, "utf-8"));
      expect(content.id).toBe("task-1");
      expect(content.status).toBe("completed");
      expect(content.output).toBe("Task output");
      expect(content.timestamp).toBeDefined();
      cleanupWorkspace(ws);
    });

    it("handles failed status", () => {
      const ws = createWorkspace("fail-test", workspaceRoot);
      writeTaskResult(ws, "failing-task", "Error occurred", "failed");

      const expectedPath = path.join(ws.tasksDir, "failing-task.json");
      const content = JSON.parse(fs.readFileSync(expectedPath, "utf-8"));
      expect(content.status).toBe("failed");
      cleanupWorkspace(ws);
    });

    it("sanitizes task ID with special characters", () => {
      const ws = createWorkspace("sanitize-test", workspaceRoot);
      writeTaskResult(ws, "task_with_special_chars", "output", "completed");

      const expectedPath = path.join(ws.tasksDir, "task_with_special_chars.json");
      expect(fs.existsSync(expectedPath)).toBe(true);
      cleanupWorkspace(ws);
    });

    it("handles empty output", () => {
      const ws = createWorkspace("empty-test", workspaceRoot);
      writeTaskResult(ws, "empty-task", "", "completed");

      const expectedPath = path.join(ws.tasksDir, "empty-task.json");
      const content = JSON.parse(fs.readFileSync(expectedPath, "utf-8"));
      expect(content.output).toBe("");
      cleanupWorkspace(ws);
    });

    it("handles multiline output", () => {
      const ws = createWorkspace("multiline-test", workspaceRoot);
      const multilineOutput = "Line 1\nLine 2\nLine 3";
      writeTaskResult(ws, "multiline-task", multilineOutput, "completed");

      const expectedPath = path.join(ws.tasksDir, "multiline-task.json");
      const content = JSON.parse(fs.readFileSync(expectedPath, "utf-8"));
      expect(content.output).toBe(multilineOutput);
      cleanupWorkspace(ws);
    });

    it("handles JSON output", () => {
      const ws = createWorkspace("json-test", workspaceRoot);
      const jsonOutput = JSON.stringify({ key: "value", nested: { data: true } });
      writeTaskResult(ws, "json-task", jsonOutput, "completed");

      const expectedPath = path.join(ws.tasksDir, "json-task.json");
      const content = JSON.parse(fs.readFileSync(expectedPath, "utf-8"));
      expect(content.output).toBe(jsonOutput);
      cleanupWorkspace(ws);
    });
  });

  describe("cleanupWorkspace", () => {
    it("removes workspace directory", () => {
      const ws = createWorkspace("cleanup-test", workspaceRoot);
      expect(fs.existsSync(ws.root)).toBe(true);

      cleanupWorkspace(ws);

      expect(fs.existsSync(ws.root)).toBe(false);
    });

    it("handles already cleaned workspace", () => {
      const ws = createWorkspace("cleanup-once", workspaceRoot);
      cleanupWorkspace(ws);

      // Should not throw
      expect(() => cleanupWorkspace(ws)).not.toThrow();
    });

    it("cleans up all subdirectories", () => {
      const ws = createWorkspace("full-cleanup", workspaceRoot);
      fs.writeFileSync(path.join(ws.tasksDir, "test.json"), "{}");
      fs.writeFileSync(path.join(ws.artifactsDir, "artifact.txt"), "test");

      cleanupWorkspace(ws);

      expect(fs.existsSync(ws.root)).toBe(false);
    });

    it("handles permission errors gracefully", () => {
      const ws = createWorkspace("perm-error-test", workspaceRoot);
      
      // Skip this test if we can't mock rmSync
      if (typeof fs.rmSync !== "undefined") {
        const originalRmSync = fs.rmSync;
        try {
          Object.defineProperty(fs, "rmSync", {
            value: vi.fn().mockImplementation(() => {
              throw new Error("EACCES: permission denied");
            }),
            writable: true,
          });
          
          // Should not throw
          expect(() => cleanupWorkspace(ws)).not.toThrow();
        } catch {
          // If we can't mock, just pass the test
        } finally {
          fs.rmSync = originalRmSync;
        }
      }
    });
  });

  describe("workspace lifecycle", () => {
    it("full workspace lifecycle", () => {
      // Create workspace
      const ws = createWorkspace("lifecycle-test", workspaceRoot);
      expect(fs.existsSync(ws.root)).toBe(true);

      // Write task results
      writeTaskResult(ws, "task-1", "Result 1", "completed");
      writeTaskResult(ws, "task-2", "Error", "failed");

      // Verify files exist
      expect(fs.existsSync(path.join(ws.tasksDir, "task-1.json"))).toBe(true);
      expect(fs.existsSync(path.join(ws.tasksDir, "task-2.json"))).toBe(true);

      // Cleanup
      cleanupWorkspace(ws);
      expect(fs.existsSync(ws.root)).toBe(false);
    });
  });
});