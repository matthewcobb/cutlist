import type { BoardLayout } from 'cutlist';

export interface SnapEdge {
  axis: 'x' | 'y';
  positionM: number;
  boardIndex: number;
}

export interface RulerMeasurement {
  id: string;
  boardIndex: number;
  axis: 'x' | 'y';
  anchorA: number;
  anchorB: number;
  offsetM: number;
}

interface PendingMeasurement {
  edge: SnapEdge;
  boardIndex: number;
}

export default createGlobalState(() => {
  const isRulerActive = ref(false);
  const measurements = ref<RulerMeasurement[]>([]);
  const pendingClick = ref<PendingMeasurement | null>(null);

  function toggleRuler() {
    isRulerActive.value = !isRulerActive.value;
    if (!isRulerActive.value) {
      pendingClick.value = null;
    }
  }

  function startMeasurement(edge: SnapEdge) {
    pendingClick.value = { edge, boardIndex: edge.boardIndex };
  }

  function completeMeasurement(secondEdge: SnapEdge, defaultOffsetM: number) {
    if (!pendingClick.value) return;
    const first = pendingClick.value.edge;

    if (first.boardIndex !== secondEdge.boardIndex) {
      pendingClick.value = null;
      return;
    }
    if (first.axis !== secondEdge.axis) {
      pendingClick.value = null;
      return;
    }
    if (first.positionM === secondEdge.positionM) {
      pendingClick.value = null;
      return;
    }

    measurements.value.push({
      id: crypto.randomUUID(),
      boardIndex: first.boardIndex,
      axis: first.axis,
      anchorA: first.positionM,
      anchorB: secondEdge.positionM,
      offsetM: defaultOffsetM,
    });
    pendingClick.value = null;
  }

  function removeMeasurement(id: string) {
    measurements.value = measurements.value.filter((m) => m.id !== id);
  }

  function updateMeasurementOffset(id: string, newOffsetM: number) {
    const m = measurements.value.find((m) => m.id === id);
    if (m) m.offsetM = newOffsetM;
  }

  function getMeasurementsForBoard(boardIndex: number) {
    return computed(() =>
      measurements.value.filter((m) => m.boardIndex === boardIndex),
    );
  }

  useEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isRulerActive.value) {
      if (pendingClick.value) {
        pendingClick.value = null;
      } else {
        isRulerActive.value = false;
      }
    }
  });

  return {
    isRulerActive,
    measurements,
    pendingClick,
    toggleRuler,
    startMeasurement,
    completeMeasurement,
    removeMeasurement,
    updateMeasurementOffset,
    getMeasurementsForBoard,
  };
});
