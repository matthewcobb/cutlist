<script lang="ts" setup>
const { activeProject, addProject } = useProjects();
const { importFromFile, pickAndImport } = useImportProject();
const toast = useToast();

const showNewProject = ref(false);
const projectName = ref('');

function openNewProject() {
  projectName.value = '';
  showNewProject.value = true;
}

async function createProject() {
  const name = projectName.value.trim();
  if (!name) return;
  await addProject(name);
  showNewProject.value = false;
}

const isDragging = ref(false);

function onDragOver(e: DragEvent) {
  if (e.dataTransfer?.items.length) {
    e.preventDefault();
    isDragging.value = true;
  }
}

function onDragLeave(e: DragEvent) {
  const related = e.relatedTarget as Element | null;
  const current = e.currentTarget as Element;
  if (!related || !current.contains(related)) {
    isDragging.value = false;
  }
}

async function onDrop(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;
  const file = e.dataTransfer?.files[0];
  if (!file) return;
  try {
    await importFromFile(file);
  } catch (err) {
    toast.add({
      title: 'Import failed',
      description: err instanceof Error ? err.message : String(err),
      color: 'red',
    });
  }
}
</script>

<template>
  <div class="absolute inset-0 flex flex-col bg-black">
    <ProjectTabBar class="shrink-0 border-b border-white/10" />

    <ClientOnly>
      <ProjectSidebar
        v-if="activeProject"
        class="flex-1 min-w-0 bg-black relative z-10"
      />

      <div
        v-else
        class="flex-1 relative overflow-hidden flex items-center justify-center"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        <!-- Board layout illustration -->
        <div
          class="absolute inset-0 pointer-events-none select-none"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 1000 560"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid slice"
            class="w-full h-full"
          >
            <!-- Sheet 1: top-left -->
            <rect
              x="20"
              y="50"
              width="390"
              height="210"
              fill="rgba(20,184,166,0.03)"
              stroke="rgba(20,184,166,0.22)"
              stroke-width="1"
            />
            <rect
              x="25"
              y="55"
              width="195"
              height="100"
              fill="rgba(20,184,166,0.07)"
              stroke="rgba(20,184,166,0.30)"
              stroke-width="0.75"
            />
            <rect
              x="225"
              y="55"
              width="180"
              height="100"
              fill="rgba(20,184,166,0.07)"
              stroke="rgba(20,184,166,0.30)"
              stroke-width="0.75"
            />
            <rect
              x="25"
              y="160"
              width="110"
              height="94"
              fill="rgba(20,184,166,0.07)"
              stroke="rgba(20,184,166,0.30)"
              stroke-width="0.75"
            />
            <rect
              x="140"
              y="160"
              width="130"
              height="94"
              fill="rgba(20,184,166,0.07)"
              stroke="rgba(20,184,166,0.30)"
              stroke-width="0.75"
            />
            <rect
              x="275"
              y="160"
              width="130"
              height="94"
              fill="rgba(20,184,166,0.02)"
              stroke="rgba(20,184,166,0.11)"
              stroke-width="0.75"
              stroke-dasharray="4,3"
            />
            <line
              x1="20"
              y1="43"
              x2="410"
              y2="43"
              stroke="rgba(20,184,166,0.14)"
              stroke-width="0.5"
            />
            <line
              x1="20"
              y1="40"
              x2="20"
              y2="46"
              stroke="rgba(20,184,166,0.14)"
              stroke-width="0.5"
            />
            <line
              x1="410"
              y1="40"
              x2="410"
              y2="46"
              stroke="rgba(20,184,166,0.14)"
              stroke-width="0.5"
            />
            <text
              x="122"
              y="110"
              font-size="9"
              fill="rgba(20,184,166,0.22)"
              text-anchor="middle"
              font-family="monospace"
            >
              #1
            </text>
            <text
              x="315"
              y="110"
              font-size="9"
              fill="rgba(20,184,166,0.22)"
              text-anchor="middle"
              font-family="monospace"
            >
              #2
            </text>
            <text
              x="79"
              y="213"
              font-size="9"
              fill="rgba(20,184,166,0.22)"
              text-anchor="middle"
              font-family="monospace"
            >
              #3
            </text>
            <text
              x="204"
              y="213"
              font-size="9"
              fill="rgba(20,184,166,0.22)"
              text-anchor="middle"
              font-family="monospace"
            >
              #4
            </text>

            <!-- Sheet 2: top-right -->
            <rect
              x="430"
              y="30"
              width="550"
              height="240"
              fill="rgba(20,184,166,0.03)"
              stroke="rgba(20,184,166,0.22)"
              stroke-width="1"
            />
            <rect
              x="435"
              y="35"
              width="270"
              height="115"
              fill="rgba(20,184,166,0.07)"
              stroke="rgba(20,184,166,0.30)"
              stroke-width="0.75"
            />
            <rect
              x="710"
              y="35"
              width="265"
              height="115"
              fill="rgba(20,184,166,0.07)"
              stroke="rgba(20,184,166,0.30)"
              stroke-width="0.75"
            />
            <rect
              x="435"
              y="155"
              width="140"
              height="110"
              fill="rgba(20,184,166,0.07)"
              stroke="rgba(20,184,166,0.30)"
              stroke-width="0.75"
            />
            <rect
              x="580"
              y="155"
              width="140"
              height="110"
              fill="rgba(20,184,166,0.07)"
              stroke="rgba(20,184,166,0.30)"
              stroke-width="0.75"
            />
            <rect
              x="725"
              y="155"
              width="250"
              height="110"
              fill="rgba(20,184,166,0.02)"
              stroke="rgba(20,184,166,0.11)"
              stroke-width="0.75"
              stroke-dasharray="4,3"
            />
            <line
              x1="987"
              y1="30"
              x2="987"
              y2="270"
              stroke="rgba(20,184,166,0.14)"
              stroke-width="0.5"
            />
            <line
              x1="984"
              y1="30"
              x2="990"
              y2="30"
              stroke="rgba(20,184,166,0.14)"
              stroke-width="0.5"
            />
            <line
              x1="984"
              y1="270"
              x2="990"
              y2="270"
              stroke="rgba(20,184,166,0.14)"
              stroke-width="0.5"
            />
            <text
              x="569"
              y="97"
              font-size="9"
              fill="rgba(20,184,166,0.22)"
              text-anchor="middle"
              font-family="monospace"
            >
              #5
            </text>
            <text
              x="842"
              y="97"
              font-size="9"
              fill="rgba(20,184,166,0.22)"
              text-anchor="middle"
              font-family="monospace"
            >
              #6
            </text>
            <text
              x="504"
              y="214"
              font-size="9"
              fill="rgba(20,184,166,0.22)"
              text-anchor="middle"
              font-family="monospace"
            >
              #7
            </text>
            <text
              x="649"
              y="214"
              font-size="9"
              fill="rgba(20,184,166,0.22)"
              text-anchor="middle"
              font-family="monospace"
            >
              #8
            </text>

            <!-- Sheet 3: bottom-left -->
            <rect
              x="20"
              y="295"
              width="580"
              height="200"
              fill="rgba(20,184,166,0.03)"
              stroke="rgba(20,184,166,0.22)"
              stroke-width="1"
            />
            <rect
              x="25"
              y="300"
              width="285"
              height="92"
              fill="rgba(20,184,166,0.07)"
              stroke="rgba(20,184,166,0.30)"
              stroke-width="0.75"
            />
            <rect
              x="315"
              y="300"
              width="280"
              height="92"
              fill="rgba(20,184,166,0.07)"
              stroke="rgba(20,184,166,0.30)"
              stroke-width="0.75"
            />
            <rect
              x="25"
              y="397"
              width="145"
              height="92"
              fill="rgba(20,184,166,0.07)"
              stroke="rgba(20,184,166,0.30)"
              stroke-width="0.75"
            />
            <rect
              x="175"
              y="397"
              width="145"
              height="92"
              fill="rgba(20,184,166,0.07)"
              stroke="rgba(20,184,166,0.30)"
              stroke-width="0.75"
            />
            <rect
              x="325"
              y="397"
              width="270"
              height="92"
              fill="rgba(20,184,166,0.02)"
              stroke="rgba(20,184,166,0.11)"
              stroke-width="0.75"
              stroke-dasharray="4,3"
            />
            <line
              x1="20"
              y1="503"
              x2="600"
              y2="503"
              stroke="rgba(20,184,166,0.14)"
              stroke-width="0.5"
            />
            <line
              x1="20"
              y1="500"
              x2="20"
              y2="506"
              stroke="rgba(20,184,166,0.14)"
              stroke-width="0.5"
            />
            <line
              x1="600"
              y1="500"
              x2="600"
              y2="506"
              stroke="rgba(20,184,166,0.14)"
              stroke-width="0.5"
            />

            <!-- Sheet 4: bottom-right -->
            <rect
              x="620"
              y="305"
              width="370"
              height="190"
              fill="rgba(20,184,166,0.03)"
              stroke="rgba(20,184,166,0.22)"
              stroke-width="1"
            />
            <rect
              x="625"
              y="310"
              width="360"
              height="88"
              fill="rgba(20,184,166,0.07)"
              stroke="rgba(20,184,166,0.30)"
              stroke-width="0.75"
            />
            <rect
              x="625"
              y="403"
              width="170"
              height="87"
              fill="rgba(20,184,166,0.07)"
              stroke="rgba(20,184,166,0.30)"
              stroke-width="0.75"
            />
            <rect
              x="800"
              y="403"
              width="185"
              height="87"
              fill="rgba(20,184,166,0.02)"
              stroke="rgba(20,184,166,0.11)"
              stroke-width="0.75"
              stroke-dasharray="4,3"
            />
          </svg>
        </div>

        <!-- Gradient: dark center, boards bleed through at edges -->
        <div
          class="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(0,0,0,0.94)_0%,rgba(0,0,0,0.72)_55%,rgba(0,0,0,0.42)_100%)]"
        />

        <!-- Content -->
        <div
          class="relative z-10 flex flex-col items-center gap-6 w-full max-w-sm px-4 text-center"
        >
          <div class="text-xl font-bold tracking-tight">
            <span class="text-white">cutlist</span
            ><span class="text-teal-400">.studio</span>
          </div>

          <div
            class="w-full rounded-xl border p-6 transition-all duration-200 backdrop-blur-sm"
            :class="
              isDragging
                ? 'border-teal-400/50 bg-teal-500/5 shadow-[0_0_40px_rgba(20,184,166,0.12)]'
                : 'border-white/10 bg-black/40'
            "
          >
            <div class="flex justify-center mb-4">
              <div
                class="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200"
                :class="
                  isDragging
                    ? 'bg-teal-400/15 text-teal-400 scale-110'
                    : 'bg-white/5 text-white/25'
                "
              >
                <UIcon
                  :name="
                    isDragging
                      ? 'i-heroicons-arrow-down-tray'
                      : 'i-heroicons-squares-plus'
                  "
                  class="w-5 h-5"
                />
              </div>
            </div>

            <p class="text-sm font-semibold text-white/80 mb-1">
              {{ isDragging ? 'Drop to import project' : 'Get started' }}
            </p>
            <p
              v-if="!isDragging"
              class="text-xs text-white/30 mb-5 leading-relaxed"
            >
              Create a new project or import a saved one
            </p>

            <div v-if="!isDragging" class="flex flex-col gap-2">
              <button
                class="w-full py-2 px-4 rounded-lg bg-teal-500 hover:bg-teal-400 active:bg-teal-600 text-black font-semibold text-sm transition-colors"
                @click="openNewProject"
              >
                New Project
              </button>
              <button
                class="w-full py-2 px-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/90 text-sm transition-colors"
                @click="pickAndImport"
              >
                Import Project
              </button>
            </div>

            <p v-if="!isDragging" class="mt-4 text-xs text-white/20">
              or drop a
              <span class="font-mono text-white/30">.cutlist.json</span> file
              anywhere
            </p>
          </div>

          <p class="text-xs text-white/20 leading-relaxed">
            Projects are stored locally in your browser.
          </p>

          <!-- How it works -->
          <div class="w-full">
            <div class="flex items-center gap-3 mb-5">
              <div class="flex-1 h-px bg-white/[0.06]" />
              <span class="text-[10px] text-white/20 uppercase tracking-widest"
                >How it works</span
              >
              <div class="flex-1 h-px bg-white/[0.06]" />
            </div>

            <div class="grid grid-cols-3 gap-4 mb-6">
              <div class="flex flex-col items-center gap-2">
                <div
                  class="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center"
                >
                  <span class="text-xs font-mono text-teal-400/50">1</span>
                </div>
                <p class="text-[11px] text-white/30 leading-relaxed">
                  Import a <span class="text-white/50">GLTF model</span> to
                  extract your parts list
                </p>
              </div>
              <div class="flex flex-col items-center gap-2">
                <div
                  class="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center"
                >
                  <span class="text-xs font-mono text-teal-400/50">2</span>
                </div>
                <p class="text-[11px] text-white/30 leading-relaxed">
                  Add your available
                  <span class="text-white/50">sheet stock</span>
                </p>
              </div>
              <div class="flex flex-col items-center gap-2">
                <div
                  class="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center"
                >
                  <span class="text-xs font-mono text-teal-400/50">3</span>
                </div>
                <p class="text-[11px] text-white/30 leading-relaxed">
                  Get <span class="text-white/50">optimized layouts</span> that
                  minimize waste
                </p>
              </div>
            </div>

            <div class="flex flex-wrap justify-center gap-1.5">
              <span
                v-for="feature in [
                  'Guillotine & CNC modes',
                  'PDF export',
                  '3D model view',
                  'Bill of materials',
                  'Works offline',
                  'No account needed',
                ]"
                :key="feature"
                class="px-2.5 py-1 rounded-md text-[11px] text-white/25 border border-white/[0.07]"
                >{{ feature }}</span
              >
            </div>
          </div>
        </div>
      </div>
    </ClientOnly>

    <UModal
      v-model="showNewProject"
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
          <UButton
            color="white"
            variant="ghost"
            @click="showNewProject = false"
          >
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
