import { describe, expect, it } from 'vitest';
import { shouldSeedDemoProject } from '../demoSeed';

describe('shouldSeedDemoProject', () => {
  it('Should return true for a fresh workspace that has never been seeded', () => {
    expect(
      shouldSeedDemoProject({
        projects: 0,
        archived: 0,
        demoSeeded: false,
      }),
    ).toBe(true);
  });

  it('Should return false after initial seed to avoid duplicate demo projects', () => {
    expect(
      shouldSeedDemoProject({
        projects: 0,
        archived: 0,
        demoSeeded: true,
      }),
    ).toBe(false);
  });

  it('Should return false when projects already exist', () => {
    expect(
      shouldSeedDemoProject({
        projects: 1,
        archived: 0,
        demoSeeded: false,
      }),
    ).toBe(false);
  });

  it('Should return false when archived history exists', () => {
    expect(
      shouldSeedDemoProject({
        projects: 0,
        archived: 1,
        demoSeeded: false,
      }),
    ).toBe(false);
  });
});
