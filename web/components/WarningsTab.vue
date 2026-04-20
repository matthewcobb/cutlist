<script lang="ts" setup>
const { data } = useBoardLayoutsQuery();
</script>

<template>
  <ul class="flex flex-col gap-4">
    <LeftoverListItem v-for="part of data?.leftovers" :part="part" />
    <li
      v-if="!data?.leftovers?.length"
      class="text-center font-sm text-white/40"
    >
      No warnings
    </li>
    <li></li>
  </ul>
</template>
