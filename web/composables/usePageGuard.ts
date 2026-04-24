/**
 * Browser-level guard: warns before closing / refreshing the tab while a
 * layout computation is running. In-app navigation is handled by the
 * computation-guard middleware.
 */
export default function usePageGuard() {
  const { isComputing } = useBoardLayoutsQuery();

  const handler = (e: BeforeUnloadEvent) => {
    e.preventDefault();
  };

  watch(isComputing, (busy) => {
    if (busy) {
      window.addEventListener('beforeunload', handler);
    } else {
      window.removeEventListener('beforeunload', handler);
    }
  });
}
