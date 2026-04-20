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

async function handleRestore(id: string) {
  showHistory.value = false;
  await restoreProject(id);
}

async function handleDelete(id: string) {
  await permanentlyDeleteProject(id);
}

async function handleClearHistory() {
  showHistory.value = false;
  await clearHistory();
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
        >.studio</span
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

    <button
      v-if="activeId"
      class="shrink-0 px-3 flex items-center border-l border-white/10 text-white/40 hover:text-teal-400 transition-colors"
      title="Save project"
      @click="exportProject"
    >
      <UIcon name="i-heroicons-arrow-down-tray" class="w-5 h-5" />
    </button>

    <button
      class="shrink-0 px-3 flex items-center border-l border-white/10 text-white/40 hover:text-teal-400 transition-colors"
      title="Import project"
      @click="pickAndImport"
    >
      <UIcon name="i-heroicons-arrow-up-tray" class="w-5 h-5" />
    </button>

    <div class="relative shrink-0">
      <button
        class="px-3 flex items-center h-full border-l border-white/10 transition-colors"
        :class="
          showHistory ? 'text-teal-400' : 'text-white/40 hover:text-teal-400'
        "
        title="Project history"
        @click="showHistory = !showHistory"
      >
        <UIcon name="i-heroicons-clock" class="w-5 h-5" />
        <span
          v-if="archivedList.length > 0"
          class="ml-1 text-xs tabular-nums text-white/30"
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
              class="text-xs font-semibold text-white/40 uppercase tracking-wider"
              >Closed projects</span
            >
          </div>
          <div
            v-if="archivedList.length === 0"
            class="px-4 py-6 text-sm text-white/30 text-center"
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
                <div class="text-sm text-white/80 truncate">{{ p.name }}</div>
                <div class="text-xs text-white/30">
                  {{ formatArchivedDate(p.archivedAt) }}
                </div>
              </div>
              <UButton
                size="2xs"
                icon="i-heroicons-arrow-uturn-left"
                color="white"
                variant="ghost"
                title="Reopen"
                @click="handleRestore(p.id)"
              />
              <UButton
                size="2xs"
                icon="i-heroicons-trash"
                color="red"
                variant="ghost"
                title="Delete permanently"
                @click="handleDelete(p.id)"
              />
            </li>
          </ul>
          <div
            v-if="archivedList.length > 0"
            class="px-3 py-2 border-t border-white/10 flex justify-end"
          >
            <button
              class="text-xs text-white/30 hover:text-red-400 transition-colors"
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
        @click="showHistory = false"
      />
    </div>

    <button
      class="shrink-0 px-3 flex items-center border-l border-white/10 text-white/40 hover:text-teal-400 transition-colors"
      title="New project"
      @click="openNewProject"
    >
      <UIcon name="i-heroicons-plus" class="w-5 h-5" />
    </button>

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
