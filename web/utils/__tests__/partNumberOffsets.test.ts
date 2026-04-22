import { describe, it, expect } from 'bun:test';
import { computePartNumberOffsets } from '../partNumberOffsets';

describe('computePartNumberOffsets', () => {
  it('returns [] for an empty models array', () => {
    expect(computePartNumberOffsets([])).toEqual([]);
  });

  it('returns [0] for a single model with no parts', () => {
    expect(computePartNumberOffsets([{ parts: [] }])).toEqual([0]);
  });

  it('returns [0] for a single model whose max partNumber is 3', () => {
    const models = [
      { parts: [{ partNumber: 1 }, { partNumber: 3 }, { partNumber: 2 }] },
    ];
    expect(computePartNumberOffsets(models)).toEqual([0]);
  });

  it('returns [0, 3] for two models with maxes 3 and 5', () => {
    const models = [
      { parts: [{ partNumber: 3 }, { partNumber: 1 }] },
      { parts: [{ partNumber: 5 }, { partNumber: 2 }] },
    ];
    expect(computePartNumberOffsets(models)).toEqual([0, 3]);
  });

  it('returns [0, 3, 8] for three models with maxes 3, 5, 2', () => {
    const models = [
      { parts: [{ partNumber: 3 }] },
      { parts: [{ partNumber: 5 }] },
      { parts: [{ partNumber: 2 }] },
    ];
    expect(computePartNumberOffsets(models)).toEqual([0, 3, 8]);
  });

  it('correctly identifies the max partNumber when parts are in descending order', () => {
    const models = [
      { parts: [{ partNumber: 7 }, { partNumber: 3 }, { partNumber: 1 }] },
      { parts: [{ partNumber: 1 }, { partNumber: 4 }] },
    ];
    // first max = 7, second offset = 7
    expect(computePartNumberOffsets(models)).toEqual([0, 7]);
  });
});
