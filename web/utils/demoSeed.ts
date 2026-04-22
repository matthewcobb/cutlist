export const DEMO_PROJECT_FILENAME = 'demo.cutlist.gz';

export function shouldSeedDemoProject(params: {
  projects: number;
  archived: number;
  demoSeeded: boolean;
}): boolean {
  return params.projects === 0 && params.archived === 0 && !params.demoSeeded;
}
