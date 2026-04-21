import { describe, it, expect } from 'bun:test';
import { Distance } from '../units';

describe('Distance', () => {
  describe('constructor', () => {
    it('accepts a raw number and stores it as meters', () => {
      const d = new Distance(1.5);
      expect(d.m).toBe(1.5);
    });

    it("parses 'ft' string and converts to meters (1ft = 0.3048m)", () => {
      const d = new Distance('1ft');
      expect(d.m).toBeCloseTo(0.3048, 10);
    });

    it("parses 'in' string and converts to meters (1in = 0.0254m)", () => {
      const d = new Distance('1in');
      expect(d.m).toBeCloseTo(0.0254, 10);
    });

    it("parses '\"' string (alternate inch notation) same as 'in'", () => {
      const d = new Distance('1"');
      expect(d.m).toBeCloseTo(0.0254, 10);
    });

    it("parses 'mm' string and converts to meters (1mm = 0.001m)", () => {
      const d = new Distance('1mm');
      expect(d.m).toBeCloseTo(0.001, 10);
    });

    it("parses 'm' string (explicit meter suffix)", () => {
      const d = new Distance('2.5m');
      expect(d.m).toBeCloseTo(2.5, 10);
    });

    it('throws an error when given an invalid string', () => {
      expect(() => new Distance('abc')).toThrow(
        'Could not convert to meters: abc',
      );
    });
  });

  describe('getters', () => {
    it('.mm returns value in millimeters (1m = 1000mm)', () => {
      const d = new Distance(1);
      expect(d.mm).toBe(1000);
    });

    it('.in returns value in inches (1m ≈ 39.37008in)', () => {
      const d = new Distance(1);
      expect(d.in).toBeCloseTo(39.37008, 5);
    });

    it('.ft returns value in feet (1m ≈ 3.28084ft)', () => {
      const d = new Distance(1);
      expect(d.ft).toBeCloseTo(3.28084, 5);
    });

    it('round-trip: new Distance("1in").in ≈ 1', () => {
      const d = new Distance('1in');
      expect(d.in).toBeCloseTo(1, 5);
    });
  });
});
