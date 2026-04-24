import type { CutlistSettings } from '~/utils';

const useProjectSettingsStore = createGlobalState(() =>
  ref<Record<string, Partial<CutlistSettings>>>({}),
);

export default createSharedComposable(() => {
  const store = useProjectSettingsStore();
  const {
    activeId: projectId,
    activeProject,
    updateStock,
    updateDistanceUnit,
  } = useProjects();

  const defineSettingValue = <T extends keyof CutlistSettings>(key: T) =>
    computed({
      get() {
        return store.value[String(toValue(projectId))]?.[key];
      },
      set(value) {
        store.value[String(toValue(projectId))] ??= {};
        store.value[String(toValue(projectId))][key] = value;
      },
    });

  const bladeWidth = defineSettingValue('bladeWidth');
  const margin = defineSettingValue('margin');
  const optimize = defineSettingValue('optimize');
  const showPartNumbers = defineSettingValue('showPartNumbers');

  // distanceUnit lives per-project, not in global settings.
  const distanceUnit = computed({
    get() {
      return activeProject.value?.distanceUnit;
    },
    set(value: 'in' | 'mm' | undefined) {
      const id = toValue(projectId);
      if (id && value != null) updateDistanceUnit(id, value);
    },
  });

  // Stock lives per-project, not in global settings.
  const stock = computed({
    get() {
      return activeProject.value?.stock;
    },
    set(value: string | undefined) {
      const id = toValue(projectId);
      if (id && value != null) updateStock(id, value);
    },
  });

  const { data: settings, isLoading } = useSettingsQuery();

  const resetSettings = () => {
    bladeWidth.value = settings.value?.bladeWidth;
    margin.value = settings.value?.margin;
    optimize.value = settings.value?.optimize;
    showPartNumbers.value = settings.value?.showPartNumbers;
  };

  // Populate store from IDB settings once they're ready.
  watch(
    settings,
    (value) => {
      if (!value) return;
      resetSettings();
    },
    { immediate: true },
  );

  // Re-populate when the active project changes (handles null → real-id
  // timing race and project switching).
  watch(projectId, (id) => {
    if (!id || !settings.value) return;
    resetSettings();
  });

  // Changes tracks only global settings diffs (stock + distanceUnit are per-project).
  const changes = computed(() => {
    const changes: Partial<CutlistSettings> = {};
    if (settings.value?.bladeWidth !== bladeWidth.value)
      changes.bladeWidth = bladeWidth.value;
    if (settings.value?.margin !== margin.value) changes.margin = margin.value;
    if (settings.value?.optimize !== optimize.value)
      changes.optimize = optimize.value;
    if (settings.value?.showPartNumbers !== showPartNumbers.value)
      changes.showPartNumbers = showPartNumbers.value;
    return changes;
  });

  return {
    bladeWidth,
    distanceUnit,
    margin,
    optimize,
    showPartNumbers,
    stock,
    resetSettings,
    isLoading,
    changes,
  };
});
