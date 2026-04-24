/**
 * Command-based undo/redo system.
 *
 * Maintains an in-memory undo stack per project. Each undoable action pushes
 * a command with `{ label, undo(), redo() }` callbacks. The stack is bounded
 * at MAX_STACK_SIZE entries to limit memory growth. Page refresh clears it.
 *
 * Design:
 * - Commands capture "before" state at the composable level, BEFORE the IDB
 *   write (which may be debounced). Both undo() and redo() update reactive
 *   state AND persist to IDB.
 * - Only data mutations are undoable — navigation, tab switches, etc. are not.
 * - The stack is per-project: switching projects doesn't clear other stacks,
 *   but undo/redo always operate on the active project.
 */

import { ref, computed, type Ref } from 'vue';

export interface UndoCommand {
  /** Human-readable label shown in toast, e.g. "Remove part" */
  label: string;
  /** Reverse the action. Must restore both reactive state and IDB. */
  undo: () => void | Promise<void>;
  /** Re-apply the action. Must update both reactive state and IDB. */
  redo: () => void | Promise<void>;
}

const MAX_STACK_SIZE = 50;

/** Per-project undo stacks, keyed by project ID. */
const undoStacks = new Map<string, UndoCommand[]>();
const redoStacks = new Map<string, UndoCommand[]>();

/** Currently active project ID — kept in sync by the composable. */
const currentProjectId: Ref<string | null> = ref(null);

/** Reactive trigger — incremented on every stack mutation to drive computeds. */
const stackVersion = ref(0);

function getUndoStack(projectId: string): UndoCommand[] {
  let stack = undoStacks.get(projectId);
  if (!stack) {
    stack = [];
    undoStacks.set(projectId, stack);
  }
  return stack;
}

function getRedoStack(projectId: string): UndoCommand[] {
  let stack = redoStacks.get(projectId);
  if (!stack) {
    stack = [];
    redoStacks.set(projectId, stack);
  }
  return stack;
}

/**
 * Push a command onto the undo stack for the given project.
 * Clears the redo stack (new action invalidates redo history).
 */
export function pushUndoCommand(projectId: string, command: UndoCommand): void {
  const stack = getUndoStack(projectId);
  stack.push(command);
  // Bound the stack size
  if (stack.length > MAX_STACK_SIZE) {
    stack.shift();
  }
  // New action clears redo
  const redo = redoStacks.get(projectId);
  if (redo) redo.length = 0;
  stackVersion.value++;
}

export default function useUndo() {
  const { activeId } = useProjects();

  // Keep currentProjectId in sync
  watch(
    activeId,
    (id) => {
      currentProjectId.value = id;
    },
    { immediate: true },
  );

  const canUndo = computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    stackVersion.value; // reactive dependency
    const id = activeId.value;
    if (!id) return false;
    return (undoStacks.get(id)?.length ?? 0) > 0;
  });

  const canRedo = computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    stackVersion.value; // reactive dependency
    const id = activeId.value;
    if (!id) return false;
    return (redoStacks.get(id)?.length ?? 0) > 0;
  });

  async function undo(): Promise<UndoCommand | null> {
    const id = activeId.value;
    if (!id) return null;
    const stack = undoStacks.get(id);
    if (!stack || stack.length === 0) return null;

    const command = stack.pop()!;
    await command.undo();

    // Push onto redo stack
    getRedoStack(id).push(command);
    stackVersion.value++;
    return command;
  }

  async function redo(): Promise<UndoCommand | null> {
    const id = activeId.value;
    if (!id) return null;
    const stack = redoStacks.get(id);
    if (!stack || stack.length === 0) return null;

    const command = stack.pop()!;
    await command.redo();

    // Push back onto undo stack
    getUndoStack(id).push(command);
    stackVersion.value++;
    return command;
  }

  /** Clear both stacks for a specific project (e.g. on project delete). */
  function clearStacks(projectId: string): void {
    undoStacks.delete(projectId);
    redoStacks.delete(projectId);
    stackVersion.value++;
  }

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    clearStacks,
  };
}
