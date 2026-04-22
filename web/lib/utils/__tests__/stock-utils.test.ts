import { describe, it, expect } from 'bun:test';
import { isValidStock } from '../stock-utils';
import type { Stock, BoardLayoutStock, PartToCut } from '../../types';

const EPSILON = 1e-5;

// Helpers to build minimal fixture objects

function makeStock(material: string, thickness: number): Stock {
  return { material, thickness, width: 0.6, length: 2.4, hasGrain: false };
}

function makeBoardLayoutStock(
  material: string,
  thicknessM: number,
): BoardLayoutStock {
  return { material, widthM: 0.6, lengthM: 2.4, thicknessM };
}

function makePart(material: string, thickness: number): PartToCut {
  return {
    partNumber: 1,
    instanceNumber: 1,
    name: 'Test Part',
    material,
    size: { width: 0.3, length: 0.6, thickness },
  };
}

describe('isValidStock', () => {
  describe('Stock vs PartToCut', () => {
    it('returns true when thickness and material both match', () => {
      const stock = makeStock('Plywood', 0.018);
      const part = makePart('Plywood', 0.018);
      expect(isValidStock(stock, part, EPSILON)).toBe(true);
    });

    it('returns false when material does not match', () => {
      const stock = makeStock('MDF', 0.018);
      const part = makePart('Plywood', 0.018);
      expect(isValidStock(stock, part, EPSILON)).toBe(false);
    });

    it('returns false when thickness does not match', () => {
      const stock = makeStock('Plywood', 0.018);
      const part = makePart('Plywood', 0.012);
      expect(isValidStock(stock, part, EPSILON)).toBe(false);
    });
  });

  describe('Stock vs Stock', () => {
    it('returns true when both thickness and material match', () => {
      const stockA = makeStock('Plywood', 0.018);
      const stockB = makeStock('Plywood', 0.018);
      expect(isValidStock(stockA, stockB, EPSILON)).toBe(true);
    });

    it('returns false when material differs', () => {
      const stockA = makeStock('Plywood', 0.018);
      const stockB = makeStock('MDF', 0.018);
      expect(isValidStock(stockA, stockB, EPSILON)).toBe(false);
    });
  });

  describe('BoardLayoutStock vs PartToCut', () => {
    it('uses thicknessM on test and size.thickness on target — returns true when matching', () => {
      const bls = makeBoardLayoutStock('Plywood', 0.018);
      const part = makePart('Plywood', 0.018);
      expect(isValidStock(bls, part, EPSILON)).toBe(true);
    });

    it('returns false when thicknessM and size.thickness differ', () => {
      const bls = makeBoardLayoutStock('Plywood', 0.018);
      const part = makePart('Plywood', 0.012);
      expect(isValidStock(bls, part, EPSILON)).toBe(false);
    });
  });

  describe('near-equal thickness (epsilon tolerance)', () => {
    it('returns true when thickness difference is within epsilon', () => {
      // Use a relative difference smaller than epsilon
      const base = 0.018;
      const slightlyOff = base + base * (EPSILON / 2);
      const stock = makeStock('Plywood', base);
      const part = makePart('Plywood', slightlyOff);
      expect(isValidStock(stock, part, EPSILON)).toBe(true);
    });

    it('returns false when thickness difference exceeds epsilon', () => {
      // Use a relative difference larger than epsilon
      const base = 0.018;
      const tooFarOff = base + base * EPSILON * 10;
      const stock = makeStock('Plywood', base);
      const part = makePart('Plywood', tooFarOff);
      expect(isValidStock(stock, part, EPSILON)).toBe(false);
    });
  });
});
