import { describe, expect, it } from 'bun:test';
import { getPartSizeFromBoundingBox, parseOnshapeUrl } from '../onshape';

describe('parseOnshapeUrl', () => {
  it('parses workspace assembly URLs', () => {
    expect(
      parseOnshapeUrl(
        'https://cad.onshape.com/documents/doc123/w/workspace456/e/element789',
      ),
    ).toEqual({
      did: 'doc123',
      wvm: 'w',
      wvmid: 'workspace456',
      eid: 'element789',
    });
  });

  it('parses version assembly URLs', () => {
    expect(
      parseOnshapeUrl(
        'https://cad.onshape.com/documents/doc123/v/version456/e/element789',
      ),
    ).toEqual({
      did: 'doc123',
      wvm: 'v',
      wvmid: 'version456',
      eid: 'element789',
    });
  });
});

describe('getPartSizeFromBoundingBox', () => {
  it('always treats the smallest axis as thickness', () => {
    expect(
      getPartSizeFromBoundingBox({
        lowX: 0,
        lowY: 0,
        lowZ: 0,
        highX: 0.018,
        highY: 0.846,
        highZ: 0.072,
      }),
    ).toEqual({
      thickness: 0.018,
      width: 0.072,
      length: 0.846,
    });
  });

  it('handles negative mins and absolute axis ranges', () => {
    expect(
      getPartSizeFromBoundingBox({
        lowX: -0.4,
        lowY: 0,
        lowZ: -0.009,
        highX: 0.4,
        highY: 1.8,
        highZ: 0.009,
      }),
    ).toEqual({
      thickness: 0.018,
      width: 0.8,
      length: 1.8,
    });
  });
});
