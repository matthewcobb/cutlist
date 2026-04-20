import { resetDocumentSettings } from '~/server/utils/documentSettings';

export default defineEventHandler(async () => {
  return await resetDocumentSettings();
});
