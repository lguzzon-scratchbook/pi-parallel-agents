import {describe, expect, test, beforeEach} from "vitest"
import * as fs from "node:fs"
import * as path from "node:path"
import {
  readContextFiles,
  getGitContext,
  buildContext
} from "../src/context.ts"

describe("Context Building", () => {
  const testDir = path.join(require("node:os").tmpdir(), "pi-test-context-" + Date.now())
  const testFile1 = path.join(testDir, "test1.txt")
  const testFile2 = path.join(testDir, "test2.md")

  beforeEach(() => {
    try { fs.mkdirSync(testDir, { recursive: true }) } catch {}
    try { fs.writeFileSync(testFile1, "File 1 content", "utf-8") } catch {}
    try { fs.writeFileSync(testFile2, "# Test Markdown\n\nSome content here.", "utf-8") } catch {}
  })

  describe("readContextFiles", () => {
    test("reads single file successfully", () => {
      const result = readContextFiles(testDir, ["test1.txt"])
      expect(result).toContain("File 1 content")
      expect(result).toContain("test1.txt")
    })

    test("reads multiple files", () => {
      const result = readContextFiles(testDir, ["test1.txt", "test2.md"])
      expect(result).toContain("File 1 content")
      expect(result).toContain("Test Markdown")
    })

    test("handles non-existent file with error message", () => {
      const result = readContextFiles(testDir, ["non-existent.txt"])
      expect(result).toContain("Error reading file")
    })

    test("handles absolute paths", () => {
      const result = readContextFiles(testDir, [testFile1])
      expect(result).toContain("File 1 content")
    })

    test("handles empty files array", () => {
      const result = readContextFiles(testDir, [])
      expect(result).toBe("")
    })

    test("uses relative path in output", () => {
      const result = readContextFiles(testDir, ["test1.txt"])
      expect(result).toContain("## File: test1.txt")
    })
  })

  describe("getGitContext", () => {
    test("returns empty string for false option", () => {
      const result = getGitContext(testDir, false)
      expect(result).toBe("")
    })

    test("returns (not a git repository) for non-git directory", () => {
      const result = getGitContext(testDir, true)
      expect(result).toContain("not a git repository")
    })

    test("returns (not a git repository) when branch option is set", () => {
      const result = getGitContext(testDir, { branch: true, diff: false, diffStats: false, log: 0, status: false })
      expect(result).toContain("not a git repository")
    })
  })

  describe("buildContext", () => {
    test("returns empty string when no options provided", () => {
      const result = buildContext(testDir, {})
      expect(result).toBe("")
    })

    test("includes user-provided context string", () => {
      const result = buildContext(testDir, { context: "Custom context" })
      expect(result).toContain("Custom context")
    })

    test("trims whitespace from context string", () => {
      const result = buildContext(testDir, { context: "  Custom context  " })
      expect(result).toContain("Custom context")
      expect(result).not.toContain("  Custom")
    })

    test("includes context from files", () => {
      const result = buildContext(testDir, { contextFiles: ["test1.txt"] })
      expect(result).toContain("File 1 content")
    })

    test("includes git context for non-git directory", () => {
      const result = buildContext(testDir, { gitContext: true })
      expect(result).toContain("not a git repository")
    })

    test("combines context from files and user context", () => {
      const result = buildContext(testDir, {
        context: "User context",
        contextFiles: ["test1.txt"]
      })

      expect(result).toContain("User context")
      expect(result).toContain("File 1 content")
      expect(result).toContain("---") // Separator between sections
    })

    test("handles empty contextFiles array", () => {
      const result = buildContext(testDir, { contextFiles: [] })
      expect(result).toBe("")
    })

    test("handles undefined options gracefully", () => {
      const result = buildContext(testDir, {
        context: "test",
        contextFiles: undefined,
        gitContext: undefined
      } as any)
      expect(result).toContain("test")
    })

    test("combines all three context sources", () => {
      const result = buildContext(testDir, {
        context: "User string",
        contextFiles: ["test1.txt"],
        gitContext: true
      })
      expect(result).toContain("User string")
      expect(result).toContain("File 1 content")
      expect(result).toContain("not a git repository")
      
      // Check separators
      const parts = result.split("\n\n---\n\n")
      expect(parts.length).toBeGreaterThanOrEqual(3)
    })

    test("uses correct separator between sections", () => {
      const result = buildContext(testDir, {
        context: "A",
        contextFiles: ["test1.txt"],
        gitContext: false
      })
      expect(result).toContain("A")
      expect(result).toContain("File 1 content")
      expect(result).toContain("\n\n---\n\n")
    })

    test("does not include empty context sections", () => {
      const result = buildContext(testDir, {
        context: "",
        contextFiles: [],
        gitContext: false
      })
      expect(result).toBe("")
    })

    test("preserves context string formatting", () => {
      const result = buildContext(testDir, { context: "Line 1\nLine 2\n\nParagraph 2" })
      expect(result).toContain("Line 1")
      expect(result).toContain("Line 2")
    })

    test("handles very long context string", () => {
      const result = buildContext(testDir, { context: "x".repeat(5000) })
      expect(result).toContain("x".repeat(5000))
    })

    test("handles file with no content", () => {
      const emptyFile = path.join(testDir, "empty.txt")
      fs.writeFileSync(emptyFile, "", "utf-8")
      const result = buildContext(testDir, { contextFiles: ["empty.txt"] })
      expect(result).toContain("empty.txt")
      expect(result).toContain("```")
    })
  })

  describe("buildContext - edge cases", () => {
    test("handles null context string as undefined", () => {
      const result = buildContext(testDir, {
        context: null as any,
        contextFiles: ["test1.txt"]
      } as any)
      expect(result).toContain("File 1 content")
    })

    test("handles null contextFiles array as undefined", () => {
      const result = buildContext(testDir, {
        context: "test",
        contextFiles: null as any
      } as any)
      expect(result).toContain("test")
    })

    test("handles null gitContext as undefined", () => {
      const result = buildContext(testDir, {
        context: "test",
        gitContext: null as any
      } as any)
      expect(result).toContain("test")
    })

    test("uses absolute paths for files in different directories", () => {
      const result = buildContext(testDir, { contextFiles: [testFile1] })
      expect(result).toContain("File 1 content")
    })

    test("handles relative path resolution correctly", () => {
      // When file is in testDir, relative path should show just filename
      const result = buildContext(testDir, { contextFiles: ["test1.txt"] })
      expect(result).toContain("## File: test1.txt")
      // Should not contain absolute path
      expect(result).not.toContain(testDir)
    })
  })

  describe("GitContextOptions type", () => {
    test("all boolean options work independently", () => {
      // Enable only branch
      const branchResult = getGitContext(testDir, { branch: true, diff: false, diffStats: false, log: 0, status: false })
      // Enable only status
      const statusResult = getGitContext(testDir, { branch: false, diff: false, diffStats: false, log: 0, status: true })
      
      // Both should show "not a git repository"
      expect(branchResult).toContain("not a git repository")
      expect(statusResult).toContain("not a git repository")
    })

    test("log option with different values", () => {
      expect(getGitContext(testDir, { log: 1 })).toContain("not a git repository")
      expect(getGitContext(testDir, { log: 10 })).toContain("not a git repository")
    })
  })
})