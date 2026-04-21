/**
 * Pure step-ordering helpers used by useBuildSteps.
 * Kept separate so they can be unit-tested without a DOM / IDB environment.
 */

interface Numbered {
  stepNumber: number;
}

/** Re-number a list of steps 1..n based on their current array order. */
export function renumberSteps<T extends Numbered>(steps: T[]): T[] {
  return steps.map((s, i) => ({ ...s, stepNumber: i + 1 }));
}

/** Remove a step by id and re-number the survivors. */
export function removeStep<T extends { id: string } & Numbered>(
  steps: T[],
  id: string,
): T[] {
  return renumberSteps(steps.filter((s) => s.id !== id));
}

/**
 * Swap the step with `id` one position up or down, then re-number.
 * Returns the original array unchanged if the move is out of bounds.
 */
export function moveStep<T extends { id: string } & Numbered>(
  steps: T[],
  id: string,
  direction: 'up' | 'down',
): T[] {
  const idx = steps.findIndex((s) => s.id === id);
  if (idx === -1) return steps;
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= steps.length) return steps;
  const result = [...steps];
  [result[idx], result[swapIdx]] = [result[swapIdx], result[idx]];
  return renumberSteps(result);
}

/** Return the next stepNumber to assign (max existing + 1, or 1 if empty). */
export function nextStepNumber(steps: { stepNumber: number }[]): number {
  return steps.reduce((m, s) => Math.max(m, s.stepNumber), 0) + 1;
}
