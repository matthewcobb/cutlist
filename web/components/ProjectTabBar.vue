<script lang="ts" setup>
const {
  projects,
  activeId,
  archivedList,
  addProject,
  closeProject,
  restoreProject,
  permanentlyDeleteProject,
  clearHistory,
  setActive,
  renameProject,
  reorderProjects,
} = useProjects();
const { exportProject } = useExportProject();
const { pickAndImport } = useImportProject();

const showModal = ref(false);
const projectName = ref('');
const showHistory = ref(false);
const pendingDeleteId = ref<string | null>(null);
const showClearConfirm = ref(false);

function formatArchivedDate(iso: string) {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function closeHistory() {
  showHistory.value = false;
  pendingDeleteId.value = null;
  showClearConfirm.value = false;
}

async function handleRestore(id: string) {
  closeHistory();
  await restoreProject(id);
}

async function handleDelete(id: string) {
  if (pendingDeleteId.value === id) {
    pendingDeleteId.value = null;
    await permanentlyDeleteProject(id);
  } else {
    pendingDeleteId.value = id;
  }
}

function cancelDelete() {
  pendingDeleteId.value = null;
}

async function handleClearHistory() {
  if (showClearConfirm.value) {
    showClearConfirm.value = false;
    showHistory.value = false;
    await clearHistory();
  } else {
    showClearConfirm.value = true;
  }
}

// ─── Rename ───────────────────────────────────────────────────────────────────

const editingId = ref<string | null>(null);
const editingOrigName = ref('');

function startEdit(id: string, currentName: string) {
  editingId.value = id;
  editingOrigName.value = currentName;
}

async function finishEdit(id: string, newName: string) {
  editingId.value = null;
  const trimmed = newName.trim();
  if (trimmed && trimmed !== editingOrigName.value) {
    await renameProject(id, trimmed);
  }
}

// ─── Drag to reorder ──────────────────────────────────────────────────────────

const dragId = ref<string | null>(null);
const dragOverId = ref<string | null>(null);

function onDragStart(id: string, e: DragEvent) {
  dragId.value = id;
  e.dataTransfer!.effectAllowed = 'move';
}

function onDragOver(id: string, e: DragEvent) {
  if (dragId.value && dragId.value !== id) {
    e.preventDefault();
    dragOverId.value = id;
  }
}

function onDrop(id: string) {
  if (!dragId.value || dragId.value === id) return;
  const ids = [...projects.value.keys()];
  const fromIdx = ids.indexOf(dragId.value);
  const toIdx = ids.indexOf(id);
  ids.splice(fromIdx, 1);
  ids.splice(toIdx, 0, dragId.value);
  reorderProjects(ids);
  dragId.value = null;
  dragOverId.value = null;
}

function onDragEnd() {
  dragId.value = null;
  dragOverId.value = null;
}

// ─── New project ──────────────────────────────────────────────────────────────

function openNewProject() {
  projectName.value = '';
  showModal.value = true;
}

function createProject() {
  const name = projectName.value.trim();
  if (!name) return;
  addProject(name);
  showModal.value = false;
}
</script>

<template>
  <div class="flex items-stretch bg-black min-h-10">
    <div
      class="shrink-0 flex items-center px-3 border-r border-white/10 select-none"
    >
      <span class="text-sm font-semibold tracking-tight text-white"
        >cutlist</span
      ><span class="text-sm font-semibold tracking-tight text-teal-400"
        >studio</span
      >
    </div>
    <TabList class="flex-1 min-w-0">
      <TabListItem
        v-for="[id, project] in projects"
        :key="id"
        :name="project.name"
        :active="id === activeId"
        :editing="editingId === id"
        :draggable="editingId !== id"
        :class="dragOverId === id ? 'border-l-2 border-teal-400' : ''"
        @click="setActive(id)"
        @close="closeProject(id)"
        @dblclick="startEdit(id, project.name)"
        @rename="(name) => finishEdit(id, name)"
        @dragstart="(e: DragEvent) => onDragStart(id, e)"
        @dragover="(e: DragEvent) => onDragOver(id, e)"
        @drop="onDrop(id)"
        @dragend="onDragEnd"
      />
    </TabList>

    <div class="shrink-0 flex items-center px-2 border-l border-white/10">
      <button
        class="flex items-center gap-1 px-2 py-1 rounded border border-teal-400/40 text-teal-400 hover:bg-teal-400/10 hover:border-teal-400/70 transition-colors text-xs font-medium"
        title="New project"
        @click="openNewProject"
      >
        <UIcon name="i-lucide-plus" class="w-3.5 h-3.5" />
        New
      </button>
    </div>

    <button
      v-if="activeId"
      class="shrink-0 px-3 flex items-center gap-1.5 border-l border-white/10 text-muted hover:text-teal-400 transition-colors"
      title="Export project"
      @click="exportProject"
    >
      <UIcon name="i-lucide-download" class="w-4 h-4" />
      <span class="text-xs">Export</span>
    </button>

    <button
      class="shrink-0 px-3 flex items-center gap-1.5 border-l border-white/10 text-muted hover:text-teal-400 transition-colors"
      title="Import project"
      @click="pickAndImport"
    >
      <UIcon name="i-lucide-upload" class="w-4 h-4" />
      <span class="text-xs">Import</span>
    </button>

    <div class="relative shrink-0">
      <button
        class="px-3 flex items-center gap-1.5 h-full border-l border-white/10 transition-colors"
        :class="
          showHistory ? 'text-teal-400' : 'text-muted hover:text-teal-400'
        "
        title="Project history"
        @click="showHistory ? closeHistory() : (showHistory = true)"
      >
        <UIcon name="i-lucide-clock" class="w-4 h-4" />
        <span class="text-xs">History</span>
        <span
          v-if="archivedList.length > 0"
          class="ml-0.5 text-xs tabular-nums text-muted"
          >{{ archivedList.length }}</span
        >
      </button>

      <Transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="showHistory"
          class="absolute top-full right-0 mt-1 w-72 bg-zinc-950 border border-white/15 rounded-lg shadow-2xl z-50 origin-top-right"
        >
          <div class="px-3 py-2 border-b border-white/10">
            <span
              class="text-xs font-semibold text-muted uppercase tracking-wider"
              >Closed projects</span
            >
          </div>
          <div
            v-if="archivedList.length === 0"
            class="px-4 py-6 text-sm text-muted text-center"
          >
            No closed projects
          </div>
          <ul v-else class="max-h-72 overflow-y-auto">
            <li
              v-for="p in archivedList"
              :key="p.id"
              class="flex items-center gap-2 px-3 py-2 border-b border-white/5 last:border-0 hover:bg-white/5 group"
            >
              <div class="flex-1 min-w-0">
                <div class="text-sm text-body truncate">{{ p.name }}</div>
                <div class="text-xs text-muted">
                  {{ formatArchivedDate(p.archivedAt) }}
                </div>
              </div>
              <template v-if="pendingDeleteId === p.id">
                <UButton
                  size="2xs"
                  color="gray"
                  variant="ghost"
                  label="Cancel"
                  @click="cancelDelete"
                />
                <UButton
                  size="2xs"
                  color="red"
                  variant="solid"
                  label="Delete"
                  @click="handleDelete(p.id)"
                />
              </template>
              <template v-else>
                <UButton
                  size="2xs"
                  icon="i-lucide-undo-2"
                  color="white"
                  variant="ghost"
                  title="Reopen"
                  @click="handleRestore(p.id)"
                />
                <UButton
                  size="2xs"
                  icon="i-lucide-trash-2"
                  color="red"
                  variant="ghost"
                  title="Delete permanently"
                  @click="handleDelete(p.id)"
                />
              </template>
            </li>
          </ul>
          <div
            v-if="archivedList.length > 0"
            class="px-3 py-2 border-t border-white/10 flex justify-end items-center gap-2"
          >
            <template v-if="showClearConfirm">
              <span class="text-xs text-muted">Delete all?</span>
              <button
                class="text-xs text-muted hover:text-white transition-colors"
                @click="showClearConfirm = false"
              >
                Cancel
              </button>
              <button
                class="text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
                @click="handleClearHistory"
              >
                Confirm
              </button>
            </template>
            <button
              v-else
              class="text-xs text-muted hover:text-red-400 transition-colors"
              @click="handleClearHistory"
            >
              Clear history
            </button>
          </div>
        </div>
      </Transition>

      <div
        v-if="showHistory"
        class="fixed inset-0 z-40"
        @click="closeHistory"
      />
    </div>

    <UModal
      v-model="showModal"
      :ui="{ overlay: { background: 'bg-black/75' }, background: 'bg-black' }"
    >
      <div class="p-6 space-y-4 bg-black border border-white/15 rounded-lg">
        <h3 class="text-lg font-medium text-white">New Project</h3>
        <UInput
          v-model="projectName"
          placeholder="Project name"
          autofocus
          @keydown.enter="createProject"
        />
        <div class="flex justify-end gap-2">
          <UButton color="white" variant="ghost" @click="showModal = false">
            Cancel
          </UButton>
          <UButton
            color="primary"
            :disabled="!projectName.trim()"
            @click="createProject"
          >
            Create
          </UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>
