<script lang="ts" setup>
useUrlSync();
useAppErrors();
usePageGuard();
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
