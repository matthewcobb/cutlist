export default function () {
  const { activeId } = useProjects();
  return computed(() => activeId.value);
}
