<script lang="ts" setup>
import { reduceStockMatrix } from 'cutlist';

const value = defineModel<string>({ required: true });

const internalValue = ref(value.value);
watch(
  value,
  (nextValue) => {
    if (nextValue !== internalValue.value) internalValue.value = nextValue;
  },
  { flush: 'sync' },
);

const parseStock = useParseStock();
const err = ref<unknown>();

function commit(nextValue: string = internalValue.value) {
  try {
    reduceStockMatrix(parseStock(nextValue));
    value.value = nextValue;
    err.value = undefined;
    return true;
  } catch (error) {
    err.value = error;
    console.error(error);
    return false;
  }
}

watchThrottled(
  internalValue,
  (nextValue) => {
    commit(nextValue);
  },
  {
    throttle: 500,
    leading: false,
    trailing: true,
  },
);

defineExpose({
  commit,
});
</script>

<template>
  <textarea
    v-model="internalValue"
    class="font-mono flex-1 resize-none bg-gray-950 border border-white/10 text-teal-300 p-4 outline-none rounded-lg whitespace-pre focus:border-teal-700 focus:ring-1 focus:ring-teal-800 transition-colors"
  />
  <div
    v-if="err"
    class="bg-red-900 shrink-0 p-4 rounded-lg border border-red-700"
  >
    <p class="text-white whitespace-pre-wrap">
      {{ err }}
    </p>
  </div>
</template>
