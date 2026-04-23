import { describe, it, expect } from 'bun:test';
import { Rectangle } from '../../geometry';
import type { PartToCut, PotentialBoardLayout, Stock } from '../../types';
import { compareLayoutScores, scoreLayouts } from '../layout-score';

const stock10x10: Stock = {
  material: 'MDF',
  thickness: 0.018,
  width: 10,
  length: 10,
};

function part(id: number): PartToCut {
  return {
    instanceNumber: 1,
    partNumber: id,
    name: `Part ${id}`,
    material: 'MDF',
    size: {
      thickness: 0.018,
      width: 1,
      length: 1,
    },
  };
}

function createLayout(
  stock: Stock,
  placements: Array<{
    left: number;
    bottom: number;
    width: number;
    height: number;
  }>,
): PotentialBoardLayout {
  return {
    stock,
    placements: placements.map((placement, i) => {
      return new Rectangle(
        part(i + 1),
        placement.left,
        placement.bottom,
        placement.width,
        placement.height,
      );
    }),
  };
}

describe('layout score', () => {
  it('prefers fewer boards even when waste is higher', () => {
    const oneBoard = scoreLayouts(
      [createLayout(stock10x10, [{ left: 0, bottom: 0, width: 5, height: 5 }])],
      1e-5,
    );
    const twoBoards = scoreLayouts(
      [
        createLayout(stock10x10, [
          { left: 0, bottom: 0, width: 10, height: 10 },
        ]),
        createLayout(stock10x10, [
          { left: 0, bottom: 0, width: 10, height: 10 },
        ]),
      ],
      1e-5,
    );

    expect(compareLayoutScores(oneBoard, twoBoards, 1e-5)).toBeLessThan(0);
  });

  it('prefers lower waste when board count matches', () => {
    const higherWaste = scoreLayouts(
      [createLayout(stock10x10, [{ left: 0, bottom: 0, width: 5, height: 5 }])],
      1e-5,
    );
    const lowerWaste = scoreLayouts(
      [createLayout(stock10x10, [{ left: 0, bottom: 0, width: 8, height: 8 }])],
      1e-5,
    );

    expect(compareLayoutScores(lowerWaste, higherWaste, 1e-5)).toBeLessThan(0);
  });

  it('prefers lower cut complexity when board count and waste tie', () => {
    const lowComplexity = scoreLayouts(
      [
        createLayout(stock10x10, [
          { left: 0, bottom: 0, width: 10, height: 10 },
        ]),
      ],
      1e-5,
    );
    const highComplexity = scoreLayouts(
      [
        createLayout(stock10x10, [
          { left: 0, bottom: 0, width: 5, height: 10 },
          { left: 5, bottom: 0, width: 5, height: 10 },
        ]),
      ],
      1e-5,
    );

    expect(
      compareLayoutScores(lowComplexity, highComplexity, 1e-5),
    ).toBeLessThan(0);
  });
});
