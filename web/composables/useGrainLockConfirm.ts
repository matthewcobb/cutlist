import { reduceStockMatrix, Distance, type Stock } from 'cutlist';
import { parseStock } from '~/utils/parseStock';
import type { GrainLock } from '~/utils/grain';
import { cycleGrainLock } from '~/utils/grain';
import { canFitOnAnyBoard } from '~/utils/canFitOnAnyBoard';

/**
 * Shared composable that provides grain lock toggling with a confirmation
 * warning when the new orientation would make the part too large for any
 * available board. Shared so LayoutList and LayoutListItem use the same
 * modal state.
 */
export const useGrainLockConfirm = createSharedComposable(() => {
  const { activeId, updatePartGrainLock } = useProjects();
  const { stock, margin, distanceUnit } = useProjectSettings();

  const parsedStock = computed<Stock[]>(() => {
    if (!stock.value) return [];
    try {
      return reduceStockMatrix(parseStock(stock.value));
    } catch {
      return [];
    }
  });

  const marginM = computed(() => {
    if (margin.value == null || distanceUnit.value == null) return 0;
    return new Distance(margin.value + distanceUnit.value).m;
  });

  // Confirmation modal state
  const showConfirm = ref(false);
  const pendingPartNumber = ref<number | null>(null);
  const pendingGrainLock = ref<GrainLock>(undefined);

  function requestGrainLockChange(
    partNumber: number,
    currentGrainLock: GrainLock,
    part: {
      material: string;
      thicknessM: number;
      widthM: number;
      lengthM: number;
    },
  ) {
    if (!activeId.value) return;

    const next = cycleGrainLock(currentGrainLock);
    const fits = canFitOnAnyBoard(part, next, parsedStock.value, marginM.value);

    if (fits) {
      updatePartGrainLock(activeId.value, partNumber, next);
    } else {
      pendingPartNumber.value = partNumber;
      pendingGrainLock.value = next;
      showConfirm.value = true;
    }
  }

  function confirmChange() {
    if (activeId.value && pendingPartNumber.value != null) {
      updatePartGrainLock(
        activeId.value,
        pendingPartNumber.value,
        pendingGrainLock.value,
      );
    }
    cancelChange();
  }

  function cancelChange() {
    showConfirm.value = false;
    pendingPartNumber.value = null;
    pendingGrainLock.value = undefined;
  }

  return {
    showConfirm,
    pendingGrainLock,
    requestGrainLockChange,
    confirmChange,
    cancelChange,
  };
});
