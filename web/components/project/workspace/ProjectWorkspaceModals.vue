<script lang="ts" setup>
const { showConfirm, pendingGrainLock, confirmChange, cancelChange } =
  useGrainLockConfirm();
</script>

<template>
  <GrainLockConfirmModal
    :open="showConfirm"
    :grain-lock="pendingGrainLock"
    @confirm="confirmChange"
    @cancel="cancelChange"
  />
</template>
