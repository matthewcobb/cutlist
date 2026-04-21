<template>
  <div class="fixed inset-0 flex flex-col overflow-hidden">
    <div class="relative flex-1 min-h-0 overflow-hidden">
      <slot />
    </div>
    <footer
      class="shrink-0 flex items-center justify-between px-4 border-t border-white/10 bg-black text-white/30 text-xs"
      style="height: 26px"
    >
      <span>v{{ appConfig.version }} &mdash; beta</span>
      <NuxtLink to="/terms" class="hover:text-white/60 transition-colors"
        >Terms of Use</NuxtLink
      >
      <span>Built by Matt</span>
    </footer>
  </div>
</template>

<script lang="ts" setup>
const appConfig = useAppConfig();
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');

* {
  min-width: 0;
}

/* ── Terminal base ── */
html {
  color-scheme: dark;
}

body {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo,
    Consolas, 'Liberation Mono', monospace;
  -webkit-font-smoothing: antialiased;
  background: #000000;
  color: #ffffff;
}

/* Force Nuxt UI select dropdown to match dark theme */
[role='listbox'] {
  background: #000000 !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
}
[role='listbox'] [role='option'] {
  color: #ffffff !important;
}
[role='listbox'] [role='option']:hover,
[role='listbox'] [role='option'][aria-selected='true'] {
  background: rgba(255, 255, 255, 0.08) !important;
  color: #6ee7b7 !important;
}

/* ── Scrollbar styling ── */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: #000000;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.35);
}
</style>
