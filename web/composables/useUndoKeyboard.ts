/**
 * Global Cmd+Z / Cmd+Shift+Z keyboard handler for undo/redo.
 *
 * Call once at the app level (app.vue). Listens for keyboard shortcuts and
 * shows undo toasts for destructive actions.
 *
 * Shortcuts are suppressed when focus is inside an input, textarea, or
 * contenteditable element — those have their own browser-native undo.
 */

export default function useUndoKeyboard() {
  if (!import.meta.client) return;

  const { undo, redo, canUndo, canRedo } = useUndo();
  const toast = useToast();

  function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
    if (target.isContentEditable) return true;
    return false;
  }

  function onKeydown(e: KeyboardEvent) {
    // Only handle Cmd+Z (Mac) or Ctrl+Z (other platforms)
    if (!e.metaKey && !e.ctrlKey) return;
    if (e.key !== 'z' && e.key !== 'Z') return;
    // Don't intercept when focus is in an editable field
    if (isEditableTarget(e.target)) return;

    e.preventDefault();

    if (e.shiftKey) {
      // Redo
      if (!canRedo.value) return;
      redo().then((cmd) => {
        if (cmd) {
          toast.add({
            title: 'Redo',
            description: cmd.label,
            duration: 2000,
          });
        }
      });
    } else {
      // Undo
      if (!canUndo.value) return;
      undo().then((cmd) => {
        if (cmd) {
          toast.add({
            title: 'Undo',
            description: cmd.label,
            duration: 2000,
          });
        }
      });
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeydown);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown);
  });
}
