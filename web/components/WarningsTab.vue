<script lang="ts" setup>
const { data } = useBoardLayoutsQuery();
</script>

<template>
  <ul class="flex flex-col gap-4">
    <LeftoverListItem v-for="part of data?.leftovers" :part="part" />
    <li v-if="!data?.leftovers?.length" class="text-center text-sm text-muted">
      No warnings
    </li>
  </ul>
</template>
