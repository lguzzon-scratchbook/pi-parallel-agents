/**
 * Context building utilities for parallel agents.
 * 
 * Handles:
 * - Reading files specified in contextFiles
 * - Gathering git context (branch, diff, status, log)
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export interface GitContextOptions {
  branch?: boolean;
  diff?: boolean;
  diffStats?: boolean;
  log?: number;
  status?: boolean;
}

/**
 * Read files and return their contents as context.
 */
export function readContextFiles(cwd: string, files: string[]): string {
  const sections: string[] = [];
  
  for (const file of files) {
    const filePath = path.isAbsolute(file) ? file : path.join(cwd, file);
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const relativePath = path.relative(cwd, filePath);
      sections.push(`## File: ${relativePath}\n\n\`\`\`\n${content}\n\`\`\``);
    } catch (err) {
      sections.push(`## File: ${file}\n\n(Error reading file: ${err instanceof Error ? err.message : String(err)})`);
    }
  }
  
  return sections.join("\n\n");
}

/**
 * Gather git context based on options.
 */
export function getGitContext(cwd: string, options: GitContextOptions | boolean): string {
  // Normalize boolean to default options, false means no git context
  if (options === false) {
    return "";
  }
  const opts: GitContextOptions = options === true 
    ? { branch: true, diffStats: true, status: true }
    : options;
  
  const sections: string[] = [];
  
  // Helper to run git commands safely
  const git = (args: string, maxLen = 10000): string | null => {
    try {
      const result = execSync(`git ${args}`, { 
        cwd, 
        encoding: "utf-8",
        timeout: 5000,
        maxBuffer: 1024 * 1024,
      }).trim();
      if (result.length > maxLen) {
        return result.slice(0, maxLen) + `\n... [truncated, ${result.length - maxLen} more chars]`;
      }
      return result;
    } catch {
      return null;
    }
  };
  
  // Check if we're in a git repo
  if (!git("rev-parse --git-dir")) {
    return "(not a git repository)";
  }
  
  if (opts.branch) {
    const branch = git("rev-parse --abbrev-ref HEAD");
    if (branch) {
      sections.push(`**Branch:** ${branch}`);
    }
  }
  
  if (opts.status) {
    const status = git("status --short");
    if (status) {
      sections.push(`**Git Status:**\n\`\`\`\n${status}\n\`\`\``);
    } else {
      sections.push("**Git Status:** (clean)");
    }
  }
  
  if (opts.diffStats) {
    // Show what files changed, not the full diff
    const stats = git("diff --stat HEAD");
    if (stats) {
      sections.push(`**Changed Files:**\n\`\`\`\n${stats}\n\`\`\``);
    }
  }
  
  if (opts.diff) {
    // Full diff - be careful about size
    const diff = git("diff HEAD", 50000);
    if (diff) {
      sections.push(`**Git Diff:**\n\`\`\`diff\n${diff}\n\`\`\``);
    }
  }
  
  if (opts.log && opts.log > 0) {
    const log = git(`log --oneline -${opts.log}`);
    if (log) {
      sections.push(`**Recent Commits:**\n\`\`\`\n${log}\n\`\`\``);
    }
  }
  
  if (sections.length === 0) {
    return "";
  }
  
  return `## Git Context\n\n${sections.join("\n\n")}`;
}

/**
 * Build full context from all sources.
 */
export function buildContext(
  cwd: string,
  options: {
    context?: string;
    contextFiles?: string[];
    gitContext?: GitContextOptions | boolean;
  }
): string {
  const parts: string[] = [];
  
  // User-provided context string
  if (options.context?.trim()) {
    parts.push(options.context.trim());
  }
  
  // Files to read
  if (options.contextFiles && options.contextFiles.length > 0) {
    const fileContext = readContextFiles(cwd, options.contextFiles);
    if (fileContext) {
      parts.push(fileContext);
    }
  }
  
  // Git context
  if (options.gitContext) {
    const gitCtx = getGitContext(cwd, options.gitContext);
    if (gitCtx) {
      parts.push(gitCtx);
    }
  }
  
  return parts.join("\n\n---\n\n");
}
