<template>
  <div class="fixed inset-0 flex flex-col overflow-hidden">
    <div class="relative flex-1 min-h-0 overflow-hidden">
      <slot />
    </div>
    <footer
      class="shrink-0 flex items-center justify-between px-4 border-t border-subtle bg-base text-muted text-xs"
      style="height: 26px"
    >
      <span>v{{ appConfig.version }} &mdash; BETA</span>
      <div class="flex items-center gap-3">
        <NuxtLink to="/about" class="hover:text-body transition-colors"
          >About</NuxtLink
        >
        <span class="text-dim">&middot;</span>
        <NuxtLink to="/terms" class="hover:text-body transition-colors"
          >Terms of Use</NuxtLink
        >
      </div>
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
  font-family:
    'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas,
    'Liberation Mono', monospace;
  -webkit-font-smoothing: antialiased;
  background: #090b0c;
  color: #ffffff;
}

/* ── Scrollbar styling ── */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: #090b0c;
}
::-webkit-scrollbar-thumb {
  background: #394447;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #4b585b;
}
</style>
