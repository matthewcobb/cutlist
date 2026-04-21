import { describe, it, expect } from 'bun:test';
import {
  isNearlyEqual,
  isNearlyGreaterThan,
  isNearlyLessThan,
  isNearlyGreaterThanOrEqual,
  isNearlyLessThanOrEqual,
} from '../floating-point-utils';

const EPS = 1e-5;

describe('floating-point-utils', () => {
  describe('isNearlyEqual', () => {
    it('returns true when values are exactly equal', () => {
      expect(isNearlyEqual(1.5, 1.5, EPS)).toBe(true);
    });

    it('returns false when values are clearly different', () => {
      expect(isNearlyEqual(1.0, 2.0, EPS)).toBe(false);
    });

    it('returns true when both values are near zero and differ by less than epsilon * MIN_VALUE', () => {
      // Both near zero: the near-zero branch uses diff < epsilon * Number.MIN_VALUE
      expect(isNearlyEqual(0, 0, EPS)).toBe(true);
    });

    it('returns false when one value is zero and the other is not near zero', () => {
      expect(isNearlyEqual(0, 1e-4, EPS)).toBe(false);
    });

    it('returns true when values differ by less than epsilon (relative)', () => {
      const a = 1.0;
      const b = 1.0 + EPS * 0.5; // difference is half of epsilon, relative to ~2
      expect(isNearlyEqual(a, b, EPS)).toBe(true);
    });

    it('returns false when values differ by more than epsilon (relative)', () => {
      const a = 1.0;
      const b = 1.0 + EPS * 10; // difference is 10x epsilon, relative to ~2
      expect(isNearlyEqual(a, b, EPS)).toBe(false);
    });

    it('handles negative values that are exactly equal', () => {
      expect(isNearlyEqual(-3.14, -3.14, EPS)).toBe(true);
    });

    it('handles large values that are nearly equal', () => {
      const a = 1e10;
      const b = 1e10 + 1; // diff/sum is tiny relative to magnitude
      expect(isNearlyEqual(a, b, EPS)).toBe(true);
    });
  });

  describe('isNearlyGreaterThan', () => {
    it('returns true when a is clearly greater than b', () => {
      expect(isNearlyGreaterThan(5.0, 3.0, EPS)).toBe(true);
    });

    it('returns true when a is slightly greater than b by more than epsilon', () => {
      expect(isNearlyGreaterThan(1.0 + EPS * 2, 1.0, EPS)).toBe(true);
    });

    it('returns true when a equals b (a + epsilon > b)', () => {
      expect(isNearlyGreaterThan(1.0, 1.0, EPS)).toBe(true);
    });

    it('returns true when a is slightly less than b but within epsilon', () => {
      // a + epsilon > b when a = b - epsilon/2
      expect(isNearlyGreaterThan(1.0 - EPS * 0.5, 1.0, EPS)).toBe(true);
    });

    it('returns false when a is clearly less than b', () => {
      expect(isNearlyGreaterThan(1.0, 5.0, EPS)).toBe(false);
    });

    it('returns false when a is less than b by more than epsilon', () => {
      expect(isNearlyGreaterThan(1.0 - EPS * 2, 1.0, EPS)).toBe(false);
    });
  });

  describe('isNearlyLessThan', () => {
    it('returns true when a is clearly less than b', () => {
      expect(isNearlyLessThan(1.0, 5.0, EPS)).toBe(true);
    });

    it('returns true when a is slightly less than b by more than epsilon', () => {
      expect(isNearlyLessThan(1.0 - EPS * 2, 1.0, EPS)).toBe(true);
    });

    it('returns true when a equals b (a - epsilon < b)', () => {
      expect(isNearlyLessThan(1.0, 1.0, EPS)).toBe(true);
    });

    it('returns true when a is slightly greater than b but within epsilon', () => {
      // a - epsilon < b when a = b + epsilon/2
      expect(isNearlyLessThan(1.0 + EPS * 0.5, 1.0, EPS)).toBe(true);
    });

    it('returns false when a is clearly greater than b', () => {
      expect(isNearlyLessThan(5.0, 1.0, EPS)).toBe(false);
    });

    it('returns false when a is greater than b by more than epsilon', () => {
      expect(isNearlyLessThan(1.0 + EPS * 2, 1.0, EPS)).toBe(false);
    });
  });

  describe('isNearlyGreaterThanOrEqual', () => {
    it('returns true when a equals b', () => {
      expect(isNearlyGreaterThanOrEqual(1.0, 1.0, EPS)).toBe(true);
    });

    it('returns true when a is clearly greater than b', () => {
      expect(isNearlyGreaterThanOrEqual(2.0, 1.0, EPS)).toBe(true);
    });

    it('returns true when a is nearly equal to b (within epsilon)', () => {
      expect(isNearlyGreaterThanOrEqual(1.0 - EPS * 0.1, 1.0, EPS)).toBe(true);
    });

    it('returns false when a is clearly less than b', () => {
      expect(isNearlyGreaterThanOrEqual(0.5, 1.0, EPS)).toBe(false);
    });

    it('returns false when a is less than b by more than epsilon', () => {
      expect(isNearlyGreaterThanOrEqual(1.0 - EPS * 10, 1.0, EPS)).toBe(false);
    });
  });

  describe('isNearlyLessThanOrEqual', () => {
    it('returns true when a equals b', () => {
      expect(isNearlyLessThanOrEqual(1.0, 1.0, EPS)).toBe(true);
    });

    it('returns true when a is clearly less than b', () => {
      expect(isNearlyLessThanOrEqual(0.5, 1.0, EPS)).toBe(true);
    });

    it('returns true when a is nearly equal to b (within epsilon)', () => {
      expect(isNearlyLessThanOrEqual(1.0 + EPS * 0.1, 1.0, EPS)).toBe(true);
    });

    it('returns false when a is clearly greater than b', () => {
      expect(isNearlyLessThanOrEqual(2.0, 1.0, EPS)).toBe(false);
    });

    it('returns false when a is greater than b by more than epsilon', () => {
      expect(isNearlyLessThanOrEqual(1.0 + EPS * 10, 1.0, EPS)).toBe(false);
    });
  });
});
