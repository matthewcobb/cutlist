import { readBody } from 'h3';
import { saveDocumentSettings } from '~/server/utils/documentSettings';
import type { CutlistSettings } from '~/utils';

export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => ({}))) as {
    changes?: Partial<CutlistSettings>;
  };
  return await saveDocumentSettings(body.changes ?? {});
});
