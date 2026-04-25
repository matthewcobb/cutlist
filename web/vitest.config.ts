import { defineVitestConfig } from '@nuxt/test-utils/config';

export default defineVitestConfig({
  test: {
    globals: false,
    environment: 'happy-dom',
    setupFiles: ['./test-setup.ts'],
    include: ['**/__tests__/**/*.test.ts'],
  },
});
