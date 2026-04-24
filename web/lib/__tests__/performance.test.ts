import { describe, expect, it } from 'bun:test';
import { generateBoardLayouts, type PartToCut, type StockMatrix } from '..';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function createPart(
  partNumber: number,
  instanceNumber: number,
  material: string,
  widthMm: number,
  lengthMm: number,
  thicknessMm: number,
  grainLock?: 'length' | 'width',
): PartToCut {
  return {
    partNumber,
    instanceNumber,
    name: `Part ${partNumber}`,
    material,
    grainLock,
    size: {
      thickness: thicknessMm / 1000,
      width: widthMm / 1000,
      length: lengthMm / 1000,
    },
  };
}

/**
 * Generate a realistic large-project fixture. Mix of materials/thicknesses,
 * varied part sizes, some with grain lock.
 */
function generateLargeFixture(partCount: number): {
  parts: PartToCut[];
  stock: StockMatrix[];
} {
  const materials = ['Oak', 'Birch Ply', 'MDF', 'Walnut', 'Maple'];
  const thicknesses = [18, 12, 25]; // mm
  const widths = [100, 150, 200, 250, 300, 400, 500, 600];
  const lengths = [200, 300, 400, 500, 600, 800, 1000, 1200];
  const grainOptions: (undefined | 'length' | 'width')[] = [
    undefined,
    undefined,
    undefined,
    'length',
    'width',
  ];

  const parts: PartToCut[] = [];
  let partNumber = 1;
  let instanceNumber = 1;

  for (let i = 0; i < partCount; i++) {
    const material = materials[i % materials.length];
    const thickness = thicknesses[i % thicknesses.length];
    const width = widths[i % widths.length];
    const length = lengths[i % lengths.length];
    const grain = grainOptions[i % grainOptions.length];

    // Every 5 parts share a partNumber (simulating qty > 1)
    if (i % 5 === 0) {
      partNumber++;
      instanceNumber = 1;
    }

    parts.push(
      createPart(
        partNumber,
        instanceNumber++,
        material,
        width,
        length,
        thickness,
        grain,
      ),
    );
  }

  const stock: StockMatrix[] = materials.map((material) => ({
    material,
    unit: 'mm' as const,
    sizes: [
      {
        width: '600mm',
        length: '2400mm',
        thickness: ['18mm', '12mm', '25mm'],
      },
      {
        width: '1200mm',
        length: '2400mm',
        thickness: ['18mm', '12mm', '25mm'],
      },
      {
        width: '300mm',
        length: '1200mm',
        thickness: ['18mm', '12mm', '25mm'],
      },
    ],
  }));

  return { parts, stock };
}

// ─── Performance tests ─────────────────────────────────────────────────────────

describe('performance: generateBoardLayouts', () => {
  it('profiles 50 parts (baseline)', () => {
    const { parts, stock } = generateLargeFixture(50);
    const config = {
      bladeWidth: '3.175mm',
      margin: '0mm',
      optimize: 'auto' as const,
      precision: 1e-5,
    };

    const start = performance.now();
    const result = generateBoardLayouts(parts, stock, config);
    const elapsed = performance.now() - start;

    console.log(
      `[50 parts] ${elapsed.toFixed(0)}ms | ${result.layouts.length} boards | ${result.leftovers.length} leftovers`,
    );
    expect(result.layouts.length).toBeGreaterThan(0);
  });

  it('profiles 100 parts', () => {
    const { parts, stock } = generateLargeFixture(100);
    const config = {
      bladeWidth: '3.175mm',
      margin: '0mm',
      optimize: 'auto' as const,
      precision: 1e-5,
    };

    const start = performance.now();
    const result = generateBoardLayouts(parts, stock, config);
    const elapsed = performance.now() - start;

    console.log(
      `[100 parts] ${elapsed.toFixed(0)}ms | ${result.layouts.length} boards | ${result.leftovers.length} leftovers`,
    );
    expect(result.layouts.length).toBeGreaterThan(0);
  });

  it('profiles 250 parts', () => {
    const { parts, stock } = generateLargeFixture(250);
    const config = {
      bladeWidth: '3.175mm',
      margin: '0mm',
      optimize: 'auto' as const,
      precision: 1e-5,
    };

    const start = performance.now();
    const result = generateBoardLayouts(parts, stock, config);
    const elapsed = performance.now() - start;

    console.log(
      `[250 parts] ${elapsed.toFixed(0)}ms | ${result.layouts.length} boards | ${result.leftovers.length} leftovers`,
    );
    expect(result.layouts.length).toBeGreaterThan(0);
  });

  it('profiles 500 parts', () => {
    const { parts, stock } = generateLargeFixture(500);
    const config = {
      bladeWidth: '3.175mm',
      margin: '0mm',
      optimize: 'auto' as const,
      precision: 1e-5,
    };

    const start = performance.now();
    const result = generateBoardLayouts(parts, stock, config);
    const elapsed = performance.now() - start;

    console.log(
      `[500 parts] ${elapsed.toFixed(0)}ms | ${result.layouts.length} boards | ${result.leftovers.length} leftovers`,
    );
    expect(result.layouts.length).toBeGreaterThan(0);
  });

  it('profiles 1000 parts (stress test)', () => {
    const { parts, stock } = generateLargeFixture(1000);
    const config = {
      bladeWidth: '3.175mm',
      margin: '0mm',
      optimize: 'auto' as const,
      precision: 1e-5,
    };

    const start = performance.now();
    const result = generateBoardLayouts(parts, stock, config);
    const elapsed = performance.now() - start;

    console.log(
      `[1000 parts] ${elapsed.toFixed(0)}ms | ${result.layouts.length} boards | ${result.leftovers.length} leftovers`,
    );
    expect(result.layouts.length).toBeGreaterThan(0);
  });

  it('profiles cuts-only mode at 500 parts', () => {
    const { parts, stock } = generateLargeFixture(500);
    const config = {
      bladeWidth: '3.175mm',
      margin: '0mm',
      optimize: 'cuts' as const,
      precision: 1e-5,
    };

    const start = performance.now();
    const result = generateBoardLayouts(parts, stock, config);
    const elapsed = performance.now() - start;

    console.log(
      `[500 parts cuts-only] ${elapsed.toFixed(0)}ms | ${result.layouts.length} boards | ${result.leftovers.length} leftovers`,
    );
    expect(result.layouts.length).toBeGreaterThan(0);
  });

  it('profiles cnc mode at 500 parts', () => {
    const { parts, stock } = generateLargeFixture(500);
    const config = {
      bladeWidth: '3.175mm',
      margin: '0mm',
      optimize: 'cnc' as const,
      precision: 1e-5,
    };

    const start = performance.now();
    const result = generateBoardLayouts(parts, stock, config);
    const elapsed = performance.now() - start;

    console.log(
      `[500 parts cnc] ${elapsed.toFixed(0)}ms | ${result.layouts.length} boards | ${result.leftovers.length} leftovers`,
    );
    expect(result.layouts.length).toBeGreaterThan(0);
  });
});
