import { describe, it, expect } from 'vitest';
import { createTightPacker } from '../TightPacker';
import type { PackOptions } from '../Packer';
import { Rectangle } from '../../geometry';

describe('Tight Bin Packer', () => {
  it('should pack rectangles as closely as possible', () => {
    const packer = createTightPacker<string>();
    const bin = new Rectangle(null, 0, 0, 10, 10);
    const rects = [
      new Rectangle('1', 0, 0, 5, 5),
      new Rectangle('2', 0, 0, 4, 4),
      new Rectangle('3', 0, 0, 3, 3),
      new Rectangle('4', 0, 0, 5, 5),
      new Rectangle('5', 0, 0, 5, 5),
    ];
    const options: PackOptions = {
      allowRotations: false,
      gap: 0,
      precision: 0,
    };

    expect(packer.pack(bin, rects, options)).toEqual({
      placements: [
        expect.objectContaining({
          data: '1',
          left: 0,
          bottom: 0,
        }),
        expect.objectContaining({
          data: '2',
          left: 5,
          bottom: 0,
        }),
        expect.objectContaining({
          data: '3',
          left: 5,
          bottom: 4,
        }),
        expect.objectContaining({
          data: '4',
          left: 0,
          bottom: 5,
        }),
      ],
      leftovers: ['5'],
    });
  });

  it('should not pack rectangles of the same size ontop of one another', () => {
    const packer = createTightPacker<string>();
    const bin = new Rectangle(null, 0, 0, 10, 5);
    const rects = [
      new Rectangle('1', 0, 0, 5, 5),
      new Rectangle('2', 0, 0, 5, 5),
      new Rectangle('3', 0, 0, 5, 5),
    ];
    const options: PackOptions = {
      allowRotations: false,
      gap: 0,
      precision: 0,
    };

    expect(packer.pack(bin, rects, options)).toEqual({
      placements: [
        expect.objectContaining({
          data: '1',
          left: 0,
          bottom: 0,
        }),
        expect.objectContaining({
          data: '2',
          left: 5,
          bottom: 0,
        }),
      ],
      leftovers: ['3'],
    });
  });

  it('should enforce blade kerf gap between placements', () => {
    const packer = createTightPacker<string>();
    // 10-wide bin, two 4-wide parts with gap=2 → 4+2+4=10 fits exactly
    const bin = new Rectangle(null, 0, 0, 10, 5);
    const rects = [
      new Rectangle('1', 0, 0, 4, 5),
      new Rectangle('2', 0, 0, 4, 5),
      new Rectangle('3', 0, 0, 4, 5),
    ];
    const options: PackOptions = {
      allowRotations: false,
      gap: 2,
      precision: 0.001,
    };

    const result = packer.pack(bin, rects, options);
    // Two parts fit with gap: 4 + 2 + 4 = 10
    expect(result.placements).toHaveLength(2);
    expect(result.placements[0]).toEqual(
      expect.objectContaining({ data: '1', left: 0 }),
    );
    expect(result.placements[1]).toEqual(
      expect.objectContaining({ data: '2', left: 6 }),
    );
    // Third part doesn't fit (would need 4+2=6 more, only 0 left)
    expect(result.leftovers).toEqual(['3']);
  });

  it('should allow rotating rectangles to fit in either orientation', () => {
    const packer = createTightPacker<string>();
    const bin = new Rectangle(null, 0, 0, 1, 3);
    const rects = [
      new Rectangle('1', 0, 0, 1, 1),
      new Rectangle('2', 0, 0, 2, 1),
    ];
    const options: PackOptions = {
      allowRotations: true,
      gap: 0,
      precision: 0,
    };

    expect(packer.pack(bin, rects, options)).toEqual({
      placements: [
        expect.objectContaining({
          data: '1',
          left: 0,
          bottom: 0,
        }),
        expect.objectContaining({
          data: '2',
          left: 0,
          bottom: 1,
          height: 2,
          width: 1,
        }),
      ],
      leftovers: [],
    });
  });
});
