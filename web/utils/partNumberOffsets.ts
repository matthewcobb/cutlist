/**
 * Compute the cumulative partNumber offset for each model in an ordered list.
 * Each model's parts are numbered starting from 1; when merging multiple models,
 * later models' part numbers must be shifted by the sum of preceding models'
 * max part numbers to avoid collisions.
 */
export function computePartNumberOffsets(
  models: { drafts: { partNumber: number }[] }[],
): number[] {
  const offsets: number[] = [];
  let cumulative = 0;
  for (const model of models) {
    offsets.push(cumulative);
    let max = 0;
    for (const draft of model.drafts) {
      if (draft.partNumber > max) max = draft.partNumber;
    }
    cumulative += max;
  }
  return offsets;
}
