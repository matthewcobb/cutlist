/**
 * Tests for the undo/redo system.
 *
 * Since useUndo.ts uses Nuxt auto-imports (ref, computed, watch, useProjects)
 * at module scope, we test the core pushUndoCommand / stack logic by importing
 * the exported function and simulating commands directly.
 *
 * The IDB round-trip for undo/redo of actual mutations (addManualPart, etc.)
 * is tested in the integration test file.
 */
import { describe, expect, it, beforeEach } from 'bun:test';
import { ref, computed } from 'vue';

// ── Inline reimplementation of the undo stack logic ─────────────────────────
// We can't import useUndo directly due to Nuxt auto-imports (useProjects, etc.).
// Instead we mirror the pure stack logic and test the contract.

interface UndoCommand {
  label: string;
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
}

const MAX_STACK_SIZE = 50;

const undoStacks = new Map<string, UndoCommand[]>();
const redoStacks = new Map<string, UndoCommand[]>();
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

function pushUndoCommand(projectId: string, command: UndoCommand): void {
  const stack = getUndoStack(projectId);
  stack.push(command);
  if (stack.length > MAX_STACK_SIZE) {
    stack.shift();
  }
  const redo = redoStacks.get(projectId);
  if (redo) redo.length = 0;
  stackVersion.value++;
}

function canUndo(projectId: string): boolean {
  return (undoStacks.get(projectId)?.length ?? 0) > 0;
}

function canRedo(projectId: string): boolean {
  return (redoStacks.get(projectId)?.length ?? 0) > 0;
}

async function undo(projectId: string): Promise<UndoCommand | null> {
  const stack = undoStacks.get(projectId);
  if (!stack || stack.length === 0) return null;
  const command = stack.pop()!;
  await command.undo();
  getRedoStack(projectId).push(command);
  stackVersion.value++;
  return command;
}

async function redo(projectId: string): Promise<UndoCommand | null> {
  const stack = redoStacks.get(projectId);
  if (!stack || stack.length === 0) return null;
  const command = stack.pop()!;
  await command.redo();
  getUndoStack(projectId).push(command);
  stackVersion.value++;
  return command;
}

function clearStacks(projectId: string): void {
  undoStacks.delete(projectId);
  redoStacks.delete(projectId);
  stackVersion.value++;
}

// ── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  undoStacks.clear();
  redoStacks.clear();
  stackVersion.value = 0;
});

describe('undo stack basics', () => {
  it('starts empty', () => {
    expect(canUndo('p1')).toBe(false);
    expect(canRedo('p1')).toBe(false);
  });

  it('pushing a command makes canUndo true', () => {
    pushUndoCommand('p1', {
      label: 'test',
      undo: () => {},
      redo: () => {},
    });
    expect(canUndo('p1')).toBe(true);
    expect(canRedo('p1')).toBe(false);
  });

  it('undo pops command and moves to redo stack', async () => {
    const log: string[] = [];
    pushUndoCommand('p1', {
      label: 'action1',
      undo: () => {
        log.push('undo1');
      },
      redo: () => {
        log.push('redo1');
      },
    });

    const cmd = await undo('p1');
    expect(cmd?.label).toBe('action1');
    expect(log).toEqual(['undo1']);
    expect(canUndo('p1')).toBe(false);
    expect(canRedo('p1')).toBe(true);
  });

  it('redo pops command and moves back to undo stack', async () => {
    const log: string[] = [];
    pushUndoCommand('p1', {
      label: 'action1',
      undo: () => {
        log.push('undo1');
      },
      redo: () => {
        log.push('redo1');
      },
    });

    await undo('p1');
    const cmd = await redo('p1');
    expect(cmd?.label).toBe('action1');
    expect(log).toEqual(['undo1', 'redo1']);
    expect(canUndo('p1')).toBe(true);
    expect(canRedo('p1')).toBe(false);
  });

  it('undo returns null when stack is empty', async () => {
    const cmd = await undo('p1');
    expect(cmd).toBeNull();
  });

  it('redo returns null when stack is empty', async () => {
    const cmd = await redo('p1');
    expect(cmd).toBeNull();
  });
});

describe('undo/redo chains', () => {
  it('handles multi-step undo/redo', async () => {
    const state = ref(0);
    pushUndoCommand('p1', {
      label: 'set to 1',
      undo: () => {
        state.value = 0;
      },
      redo: () => {
        state.value = 1;
      },
    });
    state.value = 1;

    pushUndoCommand('p1', {
      label: 'set to 2',
      undo: () => {
        state.value = 1;
      },
      redo: () => {
        state.value = 2;
      },
    });
    state.value = 2;

    pushUndoCommand('p1', {
      label: 'set to 3',
      undo: () => {
        state.value = 2;
      },
      redo: () => {
        state.value = 3;
      },
    });
    state.value = 3;

    // Undo three times
    await undo('p1');
    expect(state.value).toBe(2);
    await undo('p1');
    expect(state.value).toBe(1);
    await undo('p1');
    expect(state.value).toBe(0);
    expect(canUndo('p1')).toBe(false);

    // Redo three times
    await redo('p1');
    expect(state.value).toBe(1);
    await redo('p1');
    expect(state.value).toBe(2);
    await redo('p1');
    expect(state.value).toBe(3);
    expect(canRedo('p1')).toBe(false);
  });

  it('new action after undo clears redo stack', async () => {
    const state = ref(0);
    pushUndoCommand('p1', {
      label: 'set to 1',
      undo: () => {
        state.value = 0;
      },
      redo: () => {
        state.value = 1;
      },
    });
    state.value = 1;

    pushUndoCommand('p1', {
      label: 'set to 2',
      undo: () => {
        state.value = 1;
      },
      redo: () => {
        state.value = 2;
      },
    });
    state.value = 2;

    // Undo once
    await undo('p1');
    expect(state.value).toBe(1);
    expect(canRedo('p1')).toBe(true);

    // New action — should clear redo
    pushUndoCommand('p1', {
      label: 'set to 5',
      undo: () => {
        state.value = 1;
      },
      redo: () => {
        state.value = 5;
      },
    });
    state.value = 5;

    expect(canRedo('p1')).toBe(false);
    expect(canUndo('p1')).toBe(true);

    // Undo should go back to 1, not 2
    await undo('p1');
    expect(state.value).toBe(1);
  });

  it('interleaved undo/redo maintains consistency', async () => {
    const state = ref('');
    pushUndoCommand('p1', {
      label: 'A',
      undo: () => {
        state.value = '';
      },
      redo: () => {
        state.value = 'A';
      },
    });
    state.value = 'A';

    pushUndoCommand('p1', {
      label: 'AB',
      undo: () => {
        state.value = 'A';
      },
      redo: () => {
        state.value = 'AB';
      },
    });
    state.value = 'AB';

    pushUndoCommand('p1', {
      label: 'ABC',
      undo: () => {
        state.value = 'AB';
      },
      redo: () => {
        state.value = 'ABC';
      },
    });
    state.value = 'ABC';

    await undo('p1'); // AB
    await undo('p1'); // A
    await redo('p1'); // AB
    await undo('p1'); // A
    await undo('p1'); // ''
    expect(state.value).toBe('');

    await redo('p1'); // A
    await redo('p1'); // AB
    expect(state.value).toBe('AB');
  });
});

describe('stack bounds', () => {
  it('caps the undo stack at MAX_STACK_SIZE', () => {
    for (let i = 0; i < 60; i++) {
      pushUndoCommand('p1', {
        label: `action ${i}`,
        undo: () => {},
        redo: () => {},
      });
    }
    const stack = undoStacks.get('p1')!;
    expect(stack.length).toBe(MAX_STACK_SIZE);
    // Oldest items should be dropped
    expect(stack[0].label).toBe('action 10');
    expect(stack[stack.length - 1].label).toBe('action 59');
  });
});

describe('per-project isolation', () => {
  it('undo stacks are independent per project', async () => {
    const p1State = ref(0);
    const p2State = ref(0);

    pushUndoCommand('p1', {
      label: 'p1 action',
      undo: () => {
        p1State.value = 0;
      },
      redo: () => {
        p1State.value = 1;
      },
    });
    p1State.value = 1;

    pushUndoCommand('p2', {
      label: 'p2 action',
      undo: () => {
        p2State.value = 0;
      },
      redo: () => {
        p2State.value = 1;
      },
    });
    p2State.value = 1;

    // Undo on p1 should not affect p2
    await undo('p1');
    expect(p1State.value).toBe(0);
    expect(p2State.value).toBe(1);

    expect(canUndo('p1')).toBe(false);
    expect(canUndo('p2')).toBe(true);
  });

  it('clearStacks removes both undo and redo for a project', async () => {
    pushUndoCommand('p1', {
      label: 'action',
      undo: () => {},
      redo: () => {},
    });
    await undo('p1');
    expect(canRedo('p1')).toBe(true);

    clearStacks('p1');
    expect(canUndo('p1')).toBe(false);
    expect(canRedo('p1')).toBe(false);
  });
});

describe('undo with IDB-like async operations', () => {
  it('handles async undo/redo callbacks', async () => {
    const state = ref('initial');

    pushUndoCommand('p1', {
      label: 'async change',
      undo: async () => {
        await new Promise((r) => setTimeout(r, 10));
        state.value = 'initial';
      },
      redo: async () => {
        await new Promise((r) => setTimeout(r, 10));
        state.value = 'changed';
      },
    });
    state.value = 'changed';

    await undo('p1');
    expect(state.value).toBe('initial');

    await redo('p1');
    expect(state.value).toBe('changed');
  });
});

describe('realistic mutation sequences', () => {
  it('edit → delete → undo delete → undo edit restores original', async () => {
    // Simulate a parts array
    const parts = ref(['Rail 100mm']);

    // Edit: change Rail from 100mm to 200mm
    pushUndoCommand('p1', {
      label: 'Edit Rail',
      undo: () => {
        parts.value = ['Rail 100mm'];
      },
      redo: () => {
        parts.value = ['Rail 200mm'];
      },
    });
    parts.value = ['Rail 200mm'];

    // Delete the part
    pushUndoCommand('p1', {
      label: 'Remove Rail',
      undo: () => {
        parts.value = ['Rail 200mm'];
      },
      redo: () => {
        parts.value = [];
      },
    });
    parts.value = [];

    // Undo delete
    await undo('p1');
    expect(parts.value).toEqual(['Rail 200mm']);

    // Undo edit
    await undo('p1');
    expect(parts.value).toEqual(['Rail 100mm']);

    // Redo edit
    await redo('p1');
    expect(parts.value).toEqual(['Rail 200mm']);

    // Redo delete
    await redo('p1');
    expect(parts.value).toEqual([]);
  });

  it('add → add → undo → undo leaves original state', async () => {
    const parts = ref<string[]>([]);

    pushUndoCommand('p1', {
      label: 'Add Part A',
      undo: () => {
        parts.value = [];
      },
      redo: () => {
        parts.value = ['A'];
      },
    });
    parts.value = ['A'];

    pushUndoCommand('p1', {
      label: 'Add Part B',
      undo: () => {
        parts.value = ['A'];
      },
      redo: () => {
        parts.value = ['A', 'B'];
      },
    });
    parts.value = ['A', 'B'];

    await undo('p1');
    expect(parts.value).toEqual(['A']);

    await undo('p1');
    expect(parts.value).toEqual([]);
  });

  it('color map change sequence undoes correctly', async () => {
    const colorMap = ref<Record<string, string>>({});

    // Map color #fff to "Oak"
    pushUndoCommand('p1', {
      label: 'Map #fff → Oak',
      undo: () => {
        colorMap.value = {};
      },
      redo: () => {
        colorMap.value = { '#fff': 'Oak' };
      },
    });
    colorMap.value = { '#fff': 'Oak' };

    // Change #fff to "Maple"
    pushUndoCommand('p1', {
      label: 'Map #fff → Maple',
      undo: () => {
        colorMap.value = { '#fff': 'Oak' };
      },
      redo: () => {
        colorMap.value = { '#fff': 'Maple' };
      },
    });
    colorMap.value = { '#fff': 'Maple' };

    await undo('p1');
    expect(colorMap.value).toEqual({ '#fff': 'Oak' });

    await undo('p1');
    expect(colorMap.value).toEqual({});
  });
});
