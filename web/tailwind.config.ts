import type { Config } from 'tailwindcss';

/** Tailwind v4 “mist” ramp — cool blue-gray (see tailwindcss.com/docs/colors) */
const mist = {
  50: '#f9fbfb',
  100: '#f1f3f3',
  200: '#e3e7e8',
  300: '#d0d6d8',
  400: '#9ca8ab',
  500: '#67787c',
  600: '#4b585b',
  700: '#394447',
  800: '#22292b',
  900: '#161b1d',
  950: '#090b0c',
} as const;

export default {
  theme: {
    extend: {
      colors: {
        mist,
      },
    },
  },
} satisfies Config;
