/**
 * Parallel execution with concurrency control.
 */

export interface ParallelResult<R> {
  /** Results array - undefined entries indicate tasks that were skipped due to abort */
  results: (R | undefined)[];
  /** Whether execution was aborted before all tasks completed */
  aborted: boolean;
}

/**
 * Execute items with a concurrency limit using a worker pool pattern.
 * Results are returned in the same order as input items.
 *
 * On abort: returns partial results with `aborted: true`. Completed tasks are preserved,
 * in-progress tasks will complete with their abort handling, skipped tasks are `undefined`.
 *
 * On error: fails fast - does not wait for other workers to complete.
 */
export async function mapWithConcurrencyLimit<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal
): Promise<ParallelResult<R>> {
  if (items.length === 0) {
    return { results: [], aborted: false };
  }

  const normalizedConcurrency = Number.isFinite(concurrency)
    ? Math.floor(concurrency)
    : items.length;
  const effectiveConcurrency =
    normalizedConcurrency > 0 ? normalizedConcurrency : items.length;
  const limit = Math.max(1, Math.min(effectiveConcurrency, items.length));
  const results: (R | undefined)[] = new Array(items.length);
  let nextIndex = 0;

  // Create internal abort controller to cancel workers on any rejection
  const abortController = new AbortController();
  const workerSignal = signal
    ? AbortSignal.any([signal, abortController.signal])
    : abortController.signal;

  // Promise that rejects on first error - used to fail fast
  let rejectFirst: (error: unknown) => void;
  const firstErrorPromise = new Promise<never>((_, reject) => {
    rejectFirst = reject;
  });

  const worker = async (): Promise<void> => {
    while (true) {
      // On abort, stop picking up new work - but don't throw
      if (workerSignal.aborted) return;
      const index = nextIndex++;
      if (index >= items.length) return;
      try {
        results[index] = await fn(items[index], index);
      } catch (error) {
        // On abort, the fn itself handles it and returns a result
        // Only propagate non-abort errors
        if (!workerSignal.aborted) {
          abortController.abort();
          rejectFirst(error);
          throw error;
        }
      }
    }
  };

  // Create worker pool
  const workers = Array(limit)
    .fill(null)
    .map(() => worker());

  try {
    await Promise.race([Promise.all(workers), firstErrorPromise]);
  } catch (error) {
    // If aborted, don't rethrow - return partial results
    if (signal?.aborted) {
      return { results, aborted: true };
    }
    throw error;
  }

  return { results, aborted: signal?.aborted ?? false };
}

/**
 * Race multiple promises, returning the first successful result.
 * Cancels remaining tasks via abort signal when one completes.
 */
export async function raceWithAbort<T>(
  tasks: Array<{
    id: string;
    run: (signal: AbortSignal) => Promise<T>;
  }>,
  parentSignal?: AbortSignal
): Promise<{ winner: string; result: T } | { aborted: true }> {
  if (tasks.length === 0) {
    throw new Error("No tasks to race");
  }

  const abortController = new AbortController();
  const combinedSignal = parentSignal
    ? AbortSignal.any([parentSignal, abortController.signal])
    : abortController.signal;

  // Track if parent aborted
  if (parentSignal?.aborted) {
    return { aborted: true };
  }

  interface RaceResult {
    id: string;
    result: T;
  }

  // Track if winner was found and results
  let winnerFound = false;
  let winnerResult: RaceResult | null = null;

  const promises = tasks.map(async (task): Promise<void> => {
    try {
      const result = await task.run(combinedSignal);
      if (!winnerFound) {
        // First successful result wins
        winnerFound = true;
        abortController.abort(); // Abort remaining tasks
        winnerResult = { id: task.id, result };
      }
    } catch {
      // Task failed, continue waiting for others
    }
  });

  // Wait for all promises (they need to complete for cleanup)
  await Promise.all(promises);

  if (winnerResult !== null) {
    // TypeScript is being overly strict here, but we know winnerResult is RaceResult if not null
    const result = winnerResult as RaceResult;
    return { winner: result.id, result: result.result };
  }

  // All tasks failed
  throw new Error("All race tasks failed");
}
