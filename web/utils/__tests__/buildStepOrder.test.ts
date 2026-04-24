import { describe, it, expect } from 'vitest';
import {
  renumberSteps,
  removeStep,
  moveStep,
  nextStepNumber,
} from '../buildStepOrder';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function step(id: string, stepNumber: number) {
  return { id, stepNumber };
}

// ─── renumberSteps ────────────────────────────────────────────────────────────

describe('renumberSteps', () => {
  it('returns empty array unchanged', () => {
    expect(renumberSteps([])).toEqual([]);
  });

  it('assigns stepNumber 1 to a single step', () => {
    expect(renumberSteps([step('a', 99)])).toEqual([step('a', 1)]);
  });

  it('renumbers steps from 1..n regardless of original values', () => {
    const input = [step('a', 5), step('b', 3), step('c', 10)];
    expect(renumberSteps(input)).toEqual([
      step('a', 1),
      step('b', 2),
      step('c', 3),
    ]);
  });

  it('preserves array order', () => {
    const input = [step('c', 1), step('a', 2), step('b', 3)];
    const result = renumberSteps(input);
    expect(result.map((s) => s.id)).toEqual(['c', 'a', 'b']);
  });

  it('does not mutate the original array', () => {
    const input = [step('a', 1), step('b', 2)];
    const result = renumberSteps(input);
    expect(result).not.toBe(input);
    expect(input[0].stepNumber).toBe(1); // unchanged
  });
});

// ─── removeStep ───────────────────────────────────────────────────────────────

describe('removeStep', () => {
  it('returns empty array when removing the only step', () => {
    expect(removeStep([step('a', 1)], 'a')).toEqual([]);
  });

  it('returns original array when id is not found', () => {
    const input = [step('a', 1), step('b', 2)];
    const result = removeStep(input, 'z');
    expect(result.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('removes first step and renumbers', () => {
    const input = [step('a', 1), step('b', 2), step('c', 3)];
    const result = removeStep(input, 'a');
    expect(result).toEqual([step('b', 1), step('c', 2)]);
  });

  it('removes middle step and renumbers', () => {
    const input = [step('a', 1), step('b', 2), step('c', 3)];
    const result = removeStep(input, 'b');
    expect(result).toEqual([step('a', 1), step('c', 2)]);
  });

  it('removes last step without affecting earlier numbers', () => {
    const input = [step('a', 1), step('b', 2), step('c', 3)];
    const result = removeStep(input, 'c');
    expect(result).toEqual([step('a', 1), step('b', 2)]);
  });
});

// ─── moveStep ─────────────────────────────────────────────────────────────────

describe('moveStep', () => {
  it('returns the same reference when id is not found', () => {
    const input = [step('a', 1), step('b', 2)];
    expect(moveStep(input, 'z', 'up')).toBe(input);
  });

  it('returns the same reference when moving first step up', () => {
    const input = [step('a', 1), step('b', 2)];
    expect(moveStep(input, 'a', 'up')).toBe(input);
  });

  it('returns the same reference when moving last step down', () => {
    const input = [step('a', 1), step('b', 2)];
    expect(moveStep(input, 'b', 'down')).toBe(input);
  });

  it('moves a step up and renumbers', () => {
    const input = [step('a', 1), step('b', 2), step('c', 3)];
    const result = moveStep(input, 'b', 'up');
    expect(result.map((s) => s.id)).toEqual(['b', 'a', 'c']);
    expect(result.map((s) => s.stepNumber)).toEqual([1, 2, 3]);
  });

  it('moves a step down and renumbers', () => {
    const input = [step('a', 1), step('b', 2), step('c', 3)];
    const result = moveStep(input, 'b', 'down');
    expect(result.map((s) => s.id)).toEqual(['a', 'c', 'b']);
    expect(result.map((s) => s.stepNumber)).toEqual([1, 2, 3]);
  });

  it('moves first step down correctly', () => {
    const input = [step('a', 1), step('b', 2)];
    const result = moveStep(input, 'a', 'down');
    expect(result.map((s) => s.id)).toEqual(['b', 'a']);
    expect(result.map((s) => s.stepNumber)).toEqual([1, 2]);
  });

  it('moves last step up correctly', () => {
    const input = [step('a', 1), step('b', 2)];
    const result = moveStep(input, 'b', 'up');
    expect(result.map((s) => s.id)).toEqual(['b', 'a']);
    expect(result.map((s) => s.stepNumber)).toEqual([1, 2]);
  });

  it('does not mutate the original array', () => {
    const input = [step('a', 1), step('b', 2)];
    const result = moveStep(input, 'b', 'up');
    expect(result).not.toBe(input);
    expect(input[0].id).toBe('a');
  });
});

// ─── nextStepNumber ───────────────────────────────────────────────────────────

describe('nextStepNumber', () => {
  it('returns 1 for an empty list', () => {
    expect(nextStepNumber([])).toBe(1);
  });

  it('returns max + 1', () => {
    expect(
      nextStepNumber([{ stepNumber: 3 }, { stepNumber: 1 }, { stepNumber: 2 }]),
    ).toBe(4);
  });

  it('handles a list with a single step', () => {
    expect(nextStepNumber([{ stepNumber: 7 }])).toBe(8);
  });

  it('handles gaps in step numbers', () => {
    // Shouldn't happen in practice, but the function should handle it gracefully
    expect(nextStepNumber([{ stepNumber: 1 }, { stepNumber: 5 }])).toBe(6);
  });
});
