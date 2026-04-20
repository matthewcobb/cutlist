import { getDocumentSettings } from '~/server/utils/documentSettings';

export default defineEventHandler(async () => {
  return await getDocumentSettings();
});
