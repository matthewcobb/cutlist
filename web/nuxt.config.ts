import { resolve } from 'node:path';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@vueuse/nuxt'],
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
  },
  ssr: false,
  alias: {
    cutlist: resolve('./lib'),
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
