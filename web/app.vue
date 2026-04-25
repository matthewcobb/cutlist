<script lang="ts" setup>
import { startProjects } from '~/composables/useProjects';

startProjects();
useUrlSync();
useAppErrors();
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
