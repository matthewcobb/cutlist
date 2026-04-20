export default createGlobalState(() => {
  const hoveredPartNumber = ref<number | null>(null);
  const selectedPartNumber = ref<number | null>(null);

  return {
    hoveredPartNumber,
    selectedPartNumber,
  };
});
