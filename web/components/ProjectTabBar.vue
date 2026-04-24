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
const pendingCloseId = ref<string | null>(null);
const pendingCloseName = ref('');

function goHome() {
  navigateTo('/');
}

function requestClose(id: string) {
  const project = projects.value.get(id);
  pendingCloseName.value = project?.name ?? 'this project';
  pendingCloseId.value = id;
}

function confirmClose() {
  if (pendingCloseId.value) {
    closeProject(pendingCloseId.value);
    pendingCloseId.value = null;
  }
}

function cancelClose() {
  pendingCloseId.value = null;
}

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
  <div
    class="flex items-stretch bg-base min-h-10"
    role="toolbar"
    aria-label="Project toolbar"
  >
    <div
      class="shrink-0 flex items-center px-3 border-r border-subtle select-none"
    >
      <span class="text-sm font-semibold tracking-tight text-white"
        >cutlist</span
      ><span class="text-sm font-semibold tracking-tight text-teal-400"
        >studio</span
      >
    </div>
    <button
      class="shrink-0 h-10 px-3 flex items-center justify-center border-r border-subtle transition-colors"
      :class="
        !activeId
          ? 'text-teal-400 bg-surface'
          : 'text-muted hover:text-teal-400 hover:bg-surface'
      "
      title="Home"
      aria-label="Home"
      @click="goHome"
    >
      <UIcon name="i-lucide-house" class="block shrink-0 w-4 h-4" />
    </button>
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
        @close="requestClose(id)"
        @dblclick="startEdit(id, project.name)"
        @rename="(name) => finishEdit(id, name)"
        @dragstart="(e: DragEvent) => onDragStart(id, e)"
        @dragover="(e: DragEvent) => onDragOver(id, e)"
        @drop="onDrop(id)"
        @dragend="onDragEnd"
      />
    </TabList>

    <div class="shrink-0 flex items-center px-2 border-l border-subtle">
      <button
        class="flex items-center gap-1 px-2 py-1 rounded border border-teal-400/40 text-teal-400 hover:bg-teal-400/10 hover:border-teal-400/70 transition-colors text-xs font-medium"
        title="New project"
        aria-label="New project"
        @click="openNewProject"
      >
        <UIcon name="i-lucide-plus" class="block shrink-0 w-3.5 h-3.5" />
        New
      </button>
    </div>

    <button
      v-if="activeId"
      class="shrink-0 px-3 flex items-center gap-1.5 border-l border-subtle text-muted hover:text-teal-400 transition-colors"
      title="Export project"
      aria-label="Export project"
      @click="exportProject"
    >
      <UIcon name="i-lucide-download" class="block shrink-0 w-4 h-4" />
      <span class="text-xs">Export</span>
    </button>

    <button
      class="shrink-0 px-3 flex items-center gap-1.5 border-l border-subtle text-muted hover:text-teal-400 transition-colors"
      title="Import project"
      aria-label="Import project"
      @click="pickAndImport"
    >
      <UIcon name="i-lucide-upload" class="block shrink-0 w-4 h-4" />
      <span class="text-xs">Import</span>
    </button>

    <div class="relative shrink-0">
      <button
        class="px-3 flex items-center gap-1.5 h-full border-l border-subtle transition-colors"
        :class="
          showHistory ? 'text-teal-400' : 'text-muted hover:text-teal-400'
        "
        title="Project history"
        aria-label="Project history"
        :aria-expanded="showHistory"
        aria-haspopup="true"
        @click="showHistory ? closeHistory() : (showHistory = true)"
      >
        <UIcon name="i-lucide-clock" class="block shrink-0 w-4 h-4" />
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
          class="absolute top-full right-0 mt-1 w-72 bg-elevated border border-default rounded-lg shadow-2xl z-50 origin-top-right"
        >
          <div class="px-3 py-2 border-b border-subtle">
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
              class="flex items-center gap-2 px-3 py-2 border-b border-subtle last:border-0 hover:bg-surface group"
            >
              <div class="flex-1 min-w-0">
                <div class="text-sm text-body truncate">{{ p.name }}</div>
                <div class="text-xs text-muted">
                  {{ formatArchivedDate(p.archivedAt) }}
                </div>
              </div>
              <template v-if="pendingDeleteId === p.id">
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  label="Cancel"
                  @click="cancelDelete"
                />
                <UButton
                  size="xs"
                  color="error"
                  variant="solid"
                  label="Delete"
                  @click="handleDelete(p.id)"
                />
              </template>
              <template v-else>
                <UButton
                  size="xs"
                  icon="i-lucide-undo-2"
                  color="neutral"
                  variant="ghost"
                  title="Reopen"
                  @click="handleRestore(p.id)"
                />
                <UButton
                  size="xs"
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  title="Delete permanently"
                  @click="handleDelete(p.id)"
                />
              </template>
            </li>
          </ul>
          <div
            v-if="archivedList.length > 0"
            class="px-3 py-2 border-t border-subtle flex justify-end items-center gap-2"
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
        aria-hidden="true"
        @click="closeHistory"
      />
    </div>

    <UModal
      :open="!!pendingCloseId"
      title="Close Project"
      description="Confirm closing project"
      @update:open="
        (v: boolean) => {
          if (!v) cancelClose();
        }
      "
    >
      <template #content>
        <div class="p-6 space-y-4 bg-elevated border border-default rounded-lg">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-medium text-white">Close project?</h3>
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              class="rounded-full"
              @click="cancelClose"
            />
          </div>
          <p class="text-sm text-muted">
            <span class="text-body font-medium">{{ pendingCloseName }}</span>
            will be moved to History where you can restore it later.
          </p>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="cancelClose">
              Cancel
            </UButton>
            <UButton color="primary" @click="confirmClose">
              Close project
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="showModal"
      title="New Project"
      description="Create a new project"
    >
      <template #content>
        <div class="p-6 space-y-4 bg-elevated border border-default rounded-lg">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-medium text-white">New Project</h3>
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              class="rounded-full"
              @click="showModal = false"
            />
          </div>
          <UInput
            v-model="projectName"
            placeholder="Project name"
            class="w-full"
            autofocus
            @keydown.enter="createProject"
          />
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showModal = false">
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
      </template>
    </UModal>
  </div>
</template>
