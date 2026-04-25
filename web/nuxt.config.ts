import { resolve } from 'node:path';
import pkg from '../package.json';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  appConfig: {
    version: pkg.version,
  },
  modules: ['@nuxt/ui', '@vueuse/nuxt', '@sentry/nuxt/module'],
  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],
  css: ['~/assets/css/main.css'],
  ssr: false,
  colorMode: {
    preference: 'dark',
  },
  alias: {
    cutlist: resolve(__dirname, 'lib'),
  },
  runtimeConfig: {},
  sentry: {
    org: 'cutlist',
    project: 'cutlist',
  },
  sourcemap: {
    client: 'hidden',
  },
  app: {
    head: {
      title: 'Cutlist Generator',
      htmlAttrs: {
        lang: 'en',
      },
      link: [{ rel: 'icon', href: 'favicon.svg' }],
      meta: [
        {
          name: 'description',
          content:
            'Import GLTF assemblies and generate optimised cutlists for boards and panels.',
        },
      ],
    },
  },
});
