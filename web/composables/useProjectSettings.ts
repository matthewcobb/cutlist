import type { CutlistSettings } from '~/utils';

export default createSharedComposable(() => {
  const store = useProjectSettingsStore();
  const { activeId: projectId, activeProject, updateStock } = useProjects();

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
  const distanceUnit = defineSettingValue('distanceUnit');
  const extraSpace = defineSettingValue('extraSpace');
  const optimize = defineSettingValue('optimize');
  const showPartNumbers = defineSettingValue('showPartNumbers');

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
    distanceUnit.value = settings.value?.distanceUnit;
    extraSpace.value = settings.value?.extraSpace;
    optimize.value = settings.value?.optimize;
    showPartNumbers.value = settings.value?.showPartNumbers;
  };

  /** Reset project stock to global defaults. */
  const resetStock = () => {
    stock.value = settings.value?.stock;
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

  // Changes tracks only global settings diffs (stock is per-project now).
  const changes = computed(() => {
    const changes: Partial<CutlistSettings> = {};
    if (settings.value?.bladeWidth !== bladeWidth.value)
      changes.bladeWidth = bladeWidth.value;
    if (settings.value?.distanceUnit !== distanceUnit.value)
      changes.distanceUnit = distanceUnit.value;
    if (settings.value?.extraSpace !== extraSpace.value)
      changes.extraSpace = extraSpace.value;
    if (settings.value?.optimize !== optimize.value)
      changes.optimize = optimize.value;
    if (settings.value?.showPartNumbers !== showPartNumbers.value)
      changes.showPartNumbers = showPartNumbers.value;
    return changes;
  });

  return {
    bladeWidth,
    distanceUnit,
    extraSpace,
    optimize,
    showPartNumbers,
    stock,
    resetSettings,
    resetStock,
    isLoading,
    changes,
  };
});
