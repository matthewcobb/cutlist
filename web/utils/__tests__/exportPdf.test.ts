import { describe, expect, it } from 'bun:test';
import { exportCutlistPdf, type ExportPdfOptions } from '../exportPdf';

function makeOptions(overrides?: Partial<ExportPdfOptions>): ExportPdfOptions {
  return {
    documentName: 'Test Cutlist',
    generatedAt: new Date('2025-01-15T12:00:00Z'),
    scale: 10 as const,
    layouts: [],
    leftovers: [],
    formatSize: (m: number) => `${Math.round(m * 1000)}mm`,
    distanceUnit: 'mm',
    showPartNumbers: true,
    ...overrides,
  };
}

describe('exportCutlistPdf', () => {
  it('produces a valid PDF with empty BOM', async () => {
    const result = await exportCutlistPdf(makeOptions());
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
    // Check PDF magic bytes: %PDF-
    const header = new TextDecoder().decode(result.slice(0, 5));
    expect(header).toBe('%PDF-');
  });

  it('produces a PDF with BOM rows from placements', async () => {
    const result = await exportCutlistPdf(
      makeOptions({
        layouts: [
          {
            stock: {
              material: 'Plywood',
              widthM: 1.22,
              lengthM: 2.44,
              thicknessM: 0.018,
            },
            placements: [
              {
                partNumber: 1,
                instanceNumber: 1,
                name: 'Side Panel',
                material: 'Plywood',
                widthM: 0.5,
                lengthM: 0.8,
                thicknessM: 0.018,
                leftM: 0,
                bottomM: 0,
                rotated: false,
              },
              {
                partNumber: 1,
                instanceNumber: 2,
                name: 'Side Panel',
                material: 'Plywood',
                widthM: 0.5,
                lengthM: 0.8,
                thicknessM: 0.018,
                leftM: 0.5,
                bottomM: 0,
                rotated: false,
              },
            ],
            wasteRatio: 0.3,
          },
        ] as any,
      }),
    );
    expect(result).toBeInstanceOf(Uint8Array);
    // Should be larger than an empty BOM due to board drawing
    expect(result.length).toBeGreaterThan(100);
  });

  it('produces a PDF at different scales', async () => {
    const scales = [1, 5, 10, 20, 50] as const;
    for (const scale of scales) {
      const result = await exportCutlistPdf(
        makeOptions({
          scale,
          layouts: [
            {
              stock: {
                material: 'Plywood',
                widthM: 1.22,
                lengthM: 2.44,
                thicknessM: 0.018,
              },
              placements: [],
              wasteRatio: 0,
            },
          ] as any,
        }),
      );
      expect(result).toBeInstanceOf(Uint8Array);
      const header = new TextDecoder().decode(result.slice(0, 5));
      expect(header).toBe('%PDF-');
    }
  });

  it('handles large BOM (many parts) without error', async () => {
    const placements = Array.from({ length: 50 }, (_, i) => ({
      partNumber: i + 1,
      instanceNumber: 1,
      name: `Part ${i + 1}`,
      material: 'Plywood',
      widthM: 0.1 + (i % 5) * 0.05,
      lengthM: 0.2 + (i % 3) * 0.1,
      thicknessM: 0.018,
      leftM: 0,
      bottomM: 0,
      rotated: false,
    }));

    const result = await exportCutlistPdf(
      makeOptions({
        layouts: [
          {
            stock: {
              material: 'Plywood',
              widthM: 1.22,
              lengthM: 2.44,
              thicknessM: 0.018,
            },
            placements,
            wasteRatio: 0.1,
          },
        ] as any,
      }),
    );
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('respects showPartNumbers: false', async () => {
    const result = await exportCutlistPdf(
      makeOptions({
        showPartNumbers: false,
        layouts: [
          {
            stock: {
              material: 'Plywood',
              widthM: 1.22,
              lengthM: 2.44,
              thicknessM: 0.018,
            },
            placements: [
              {
                partNumber: 1,
                instanceNumber: 1,
                name: 'Panel',
                material: 'Plywood',
                widthM: 0.5,
                lengthM: 0.8,
                thicknessM: 0.018,
                leftM: 0,
                bottomM: 0,
                rotated: false,
              },
            ],
            wasteRatio: 0.3,
          },
        ] as any,
      }),
    );
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('handles measurements on boards', async () => {
    const result = await exportCutlistPdf(
      makeOptions({
        measurements: [
          {
            boardIndex: 0,
            axis: 'x',
            anchorA: 0,
            anchorB: 0.5,
            offsetM: 0.1,
          },
          {
            boardIndex: 0,
            axis: 'y',
            anchorA: 0,
            anchorB: 0.8,
            offsetM: 0.05,
          },
        ] as any,
        layouts: [
          {
            stock: {
              material: 'Plywood',
              widthM: 1.22,
              lengthM: 2.44,
              thicknessM: 0.018,
            },
            placements: [],
            wasteRatio: 0,
          },
        ] as any,
      }),
    );
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('handles leftovers in BOM aggregation', async () => {
    const result = await exportCutlistPdf(
      makeOptions({
        leftovers: [
          {
            partNumber: 1,
            instanceNumber: 1,
            name: 'Leftover Part',
            material: 'Plywood',
            widthM: 0.3,
            lengthM: 0.4,
            thicknessM: 0.018,
          },
        ] as any,
      }),
    );
    expect(result).toBeInstanceOf(Uint8Array);
  });
});
