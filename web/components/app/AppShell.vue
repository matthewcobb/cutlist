<script lang="ts" setup>
/**
 * Top-level frame shared by every page that lives "inside" the app.
 *
 * Renders the persistent project top bar and yields the rest of the viewport
 * to the page's content via the default slot. The wrapping fixed positioning
 * is provided by the surrounding `default` Nuxt layout.
 */
</script>

<template>
  <div class="absolute inset-0 flex flex-col bg-base">
    <ProjectTopBar class="shrink-0 border-b border-subtle" />
    <slot />
  </div>
</template>
