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
      color: 'error',
    });
  }
}

function scrollToContent() {
  document
    .getElementById('how-it-works')
    ?.scrollIntoView({ behavior: 'smooth' });
}
</script>

<template>
  <div class="absolute inset-0 flex flex-col bg-base">
    <ProjectTabBar class="shrink-0 border-b border-subtle" />

    <ClientOnly>
      <div
        v-if="!activeProject"
        class="flex-1 overflow-y-auto"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        <!-- ════════════════════════════════════════════════════════════════ -->
        <!-- HERO                                                            -->
        <!-- ════════════════════════════════════════════════════════════════ -->
        <section
          class="relative min-h-[calc(100vh-2.5rem)] flex items-center justify-center overflow-hidden"
        >
          <!-- Board layout SVG background -->
          <!-- prettier-ignore -->
          <div class="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
            <svg viewBox="0 0 1000 560" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" class="w-full h-full">
              <rect x="10" y="15" width="200" height="190" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
              <rect x="15" y="20" width="60" height="55" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="45" y="51" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#1</text>
              <rect x="77" y="20" width="65" height="55" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="109" y="51" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#2</text>
              <rect x="144" y="20" width="61" height="55" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="174" y="51" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#3</text>
              <rect x="15" y="78" width="88" height="62" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="59" y="113" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#4</text>
              <rect x="105" y="78" width="83" height="62" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="146" y="113" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#5</text>
              <rect x="190" y="78" width="15" height="62" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>
              <rect x="15" y="143" width="72" height="57" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="51" y="175" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#6</text>
              <rect x="89" y="143" width="72" height="57" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="125" y="175" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#7</text>
              <rect x="163" y="143" width="42" height="57" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>
              <line x1="10" y1="8" x2="210" y2="8" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/><line x1="10" y1="5" x2="10" y2="11" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/><line x1="210" y1="5" x2="210" y2="11" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/>
              <rect x="222" y="8" width="305" height="145" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
              <rect x="227" y="13" width="72" height="65" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="263" y="49" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#1</text>
              <rect x="301" y="13" width="72" height="65" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="337" y="49" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#2</text>
              <rect x="375" y="13" width="72" height="65" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="411" y="49" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#3</text>
              <rect x="449" y="13" width="73" height="65" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="485" y="49" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#4</text>
              <rect x="227" y="81" width="145" height="67" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="299" y="118" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#5</text>
              <rect x="374" y="81" width="90" height="67" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="419" y="118" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#6</text>
              <rect x="466" y="81" width="56" height="67" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>
              <rect x="542" y="18" width="196" height="180" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
              <rect x="547" y="23" width="92" height="86" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="593" y="70" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#1</text>
              <rect x="641" y="23" width="92" height="86" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="687" y="70" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#2</text>
              <rect x="547" y="112" width="57" height="81" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="575" y="156" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#3</text>
              <rect x="606" y="112" width="57" height="81" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="634" y="156" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#4</text>
              <rect x="665" y="112" width="68" height="81" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>
              <rect x="756" y="10" width="232" height="222" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
              <rect x="761" y="15" width="110" height="72" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="816" y="55" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#1</text>
              <rect x="873" y="15" width="110" height="72" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="928" y="55" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#2</text>
              <rect x="761" y="90" width="72" height="65" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="797" y="126" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#3</text>
              <rect x="835" y="90" width="72" height="65" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="871" y="126" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#4</text>
              <rect x="909" y="90" width="74" height="65" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="946" y="126" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#5</text>
              <rect x="761" y="158" width="100" height="69" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="811" y="196" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#6</text>
              <rect x="863" y="158" width="80" height="69" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="903" y="196" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#7</text>
              <rect x="945" y="158" width="38" height="69" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>
              <line x1="994" y1="10" x2="994" y2="232" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/><line x1="991" y1="10" x2="997" y2="10" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/><line x1="991" y1="232" x2="997" y2="232" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/>
              <rect x="10" y="248" width="140" height="160" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
              <rect x="15" y="253" width="62" height="73" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="46" y="293" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#1</text>
              <rect x="79" y="253" width="66" height="73" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="112" y="293" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#2</text>
              <rect x="15" y="329" width="62" height="74" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="46" y="369" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#3</text>
              <rect x="79" y="329" width="66" height="74" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="112" y="369" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#4</text>
              <rect x="162" y="240" width="365" height="185" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
              <rect x="167" y="245" width="145" height="88" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="239" y="293" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#1</text>
              <rect x="314" y="245" width="108" height="88" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="368" y="293" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#2</text>
              <rect x="424" y="245" width="98" height="88" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="473" y="293" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#3</text>
              <rect x="167" y="336" width="100" height="84" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="217" y="382" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#4</text>
              <rect x="269" y="336" width="100" height="84" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="319" y="382" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#5</text>
              <rect x="371" y="336" width="100" height="84" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="421" y="382" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#6</text>
              <rect x="473" y="336" width="49" height="84" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>
              <line x1="162" y1="431" x2="527" y2="431" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/><line x1="162" y1="428" x2="162" y2="434" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/><line x1="527" y1="428" x2="527" y2="434" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/>
              <rect x="540" y="245" width="258" height="170" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
              <rect x="545" y="250" width="122" height="80" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="606" y="294" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#1</text>
              <rect x="669" y="250" width="124" height="80" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="731" y="294" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#2</text>
              <rect x="545" y="333" width="75" height="77" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="582" y="375" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#3</text>
              <rect x="622" y="333" width="75" height="77" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="659" y="375" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#4</text>
              <rect x="699" y="333" width="75" height="77" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="736" y="375" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#5</text>
              <rect x="776" y="333" width="17" height="77" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>
              <rect x="812" y="248" width="178" height="168" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
              <rect x="817" y="253" width="80" height="80" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="857" y="297" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#1</text>
              <rect x="899" y="253" width="84" height="80" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="941" y="297" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#2</text>
              <rect x="817" y="336" width="120" height="75" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="877" y="377" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#3</text>
              <rect x="939" y="336" width="44" height="75" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>
              <rect x="10" y="432" width="290" height="118" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
              <rect x="15" y="437" width="66" height="103" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="48" y="492" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#1</text>
              <rect x="83" y="437" width="66" height="103" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="116" y="492" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#2</text>
              <rect x="151" y="437" width="66" height="103" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="184" y="492" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#3</text>
              <rect x="219" y="437" width="76" height="103" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="257" y="492" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#4</text>
              <rect x="314" y="442" width="212" height="108" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
              <rect x="319" y="447" width="67" height="98" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="352" y="500" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#1</text>
              <rect x="388" y="447" width="67" height="98" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="421" y="500" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#2</text>
              <rect x="457" y="447" width="64" height="98" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="489" y="500" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#3</text>
              <rect x="540" y="436" width="185" height="114" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
              <rect x="545" y="441" width="82" height="104" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="586" y="497" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#1</text>
              <rect x="629" y="441" width="78" height="104" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="668" y="497" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#2</text>
              <rect x="709" y="441" width="11" height="104" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>
              <rect x="740" y="430" width="250" height="120" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
              <rect x="745" y="435" width="79" height="110" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="784" y="494" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#1</text>
              <rect x="826" y="435" width="79" height="110" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="865" y="494" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#2</text>
              <rect x="907" y="435" width="78" height="110" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="946" y="494" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#3</text>
              <line x1="740" y1="423" x2="990" y2="423" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/><line x1="740" y1="420" x2="740" y2="426" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/><line x1="990" y1="420" x2="990" y2="426" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/>
            </svg>
          </div>

          <!-- Gradient overlay -->
          <div
            class="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(9,11,12,0.94)_0%,rgba(9,11,12,0.72)_55%,rgba(9,11,12,0.42)_100%)]"
          />

          <!-- Hero content -->
          <div
            class="relative z-10 flex flex-col items-center gap-6 w-full max-w-sm px-4 text-center"
          >
            <div class="text-xl font-bold tracking-tight">
              <span class="text-white">cutlist</span
              ><span class="text-teal-400">studio</span>
            </div>

            <p class="text-lg text-muted leading-relaxed -mt-2">
              Optimized cutting plans for sheet stock
            </p>

            <div
              class="w-full rounded-xl border p-6 transition-all duration-200 backdrop-blur-sm"
              :class="
                isDragging
                  ? 'border-teal-400/50 bg-teal-500/5 shadow-[0_0_40px_rgba(20,184,166,0.12)]'
                  : 'border-subtle bg-mist-950/40'
              "
            >
              <div class="flex justify-center mb-4">
                <div
                  class="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200"
                  :class="
                    isDragging
                      ? 'bg-teal-400/15 text-teal-400 scale-110'
                      : 'bg-surface text-dim'
                  "
                >
                  <UIcon
                    :name="
                      isDragging ? 'i-lucide-download' : 'i-lucide-layout-grid'
                    "
                    class="w-5 h-5"
                  />
                </div>
              </div>

              <p class="text-sm font-semibold text-body mb-1">
                {{ isDragging ? 'Drop to import project' : 'Get started' }}
              </p>
              <p
                v-if="!isDragging"
                class="text-sm text-muted mb-5 leading-relaxed"
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
                  class="w-full py-2 px-4 rounded-lg border border-subtle bg-surface hover:bg-mist-800 text-muted hover:text-body text-sm transition-colors"
                  @click="pickAndImport"
                >
                  Import Project
                </button>
              </div>

              <p v-if="!isDragging" class="mt-4 text-xs text-muted">
                or drop a
                <span class="font-mono text-dim">.cutlist.gz</span> file
                anywhere
              </p>
            </div>

            <p class="text-xs text-muted leading-relaxed">
              Projects are stored locally in your browser. No account needed.
            </p>
          </div>

          <!-- Scroll indicator -->
          <button
            class="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-dim hover:text-muted transition-colors"
            @click="scrollToContent"
          >
            <span class="text-xs uppercase tracking-widest">Learn more</span>
            <UIcon
              name="i-lucide-chevron-down"
              class="w-5 h-5 animate-bounce"
            />
          </button>
        </section>

        <!-- ════════════════════════════════════════════════════════════════ -->
        <!-- HOW IT WORKS                                                    -->
        <!-- ════════════════════════════════════════════════════════════════ -->
        <section id="how-it-works" class="relative border-t border-subtle">
          <!-- Faint grid background -->
          <div class="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div
              class="w-full h-full opacity-[0.03]"
              style="
                background-image:
                  linear-gradient(rgba(20, 184, 166, 1) 1px, transparent 1px),
                  linear-gradient(
                    90deg,
                    rgba(20, 184, 166, 1) 1px,
                    transparent 1px
                  );
                background-size: 60px 60px;
              "
            />
          </div>

          <div class="relative max-w-5xl mx-auto px-6 py-24 sm:py-32">
            <div class="text-center mb-20">
              <span
                class="text-xs font-mono text-teal-400 uppercase tracking-widest"
                >How it works</span
              >
              <h2
                class="mt-4 text-3xl sm:text-4xl font-bold text-white tracking-tight"
              >
                From parts list to cut plan
              </h2>
              <p
                class="mt-4 text-lg text-muted max-w-2xl mx-auto leading-relaxed"
              >
                Define what you need to cut, tell the app what stock you have,
                and get layouts that minimize material waste.
              </p>
            </div>

            <!-- Step 1 -->
            <div
              class="grid md:grid-cols-2 gap-12 md:gap-16 items-center mb-24"
            >
              <div>
                <div class="flex items-center gap-3 mb-4">
                  <div
                    class="w-10 h-10 rounded-xl bg-teal-400/10 border border-teal-400/20 flex items-center justify-center"
                  >
                    <span class="text-sm font-mono font-bold text-teal-400"
                      >1</span
                    >
                  </div>
                  <h3 class="text-xl font-semibold text-white">
                    Define your parts
                  </h3>
                </div>
                <p class="text-muted leading-relaxed mb-4">
                  Import a GLTF 3D model and the app automatically extracts
                  every flat panel as a part with accurate dimensions. Or enter
                  parts manually if you prefer to work from a sketch or
                  spreadsheet.
                </p>
                <div class="flex flex-wrap gap-2">
                  <span
                    class="px-2.5 py-1 rounded-md text-xs text-teal-400 bg-teal-400/5 border border-teal-400/15"
                    >GLTF import</span
                  >
                  <span
                    class="px-2.5 py-1 rounded-md text-xs text-teal-400 bg-teal-400/5 border border-teal-400/15"
                    >Manual entry</span
                  >
                  <span
                    class="px-2.5 py-1 rounded-md text-xs text-teal-400 bg-teal-400/5 border border-teal-400/15"
                    >3D preview</span
                  >
                </div>
              </div>
              <!-- Illustration placeholder: parts table -->
              <div class="rounded-xl border border-subtle bg-surface p-5">
                <div
                  class="flex items-center gap-2 mb-4 pb-3 border-b border-subtle"
                >
                  <UIcon name="i-lucide-table-2" class="w-4 h-4 text-dim" />
                  <span
                    class="text-xs font-mono text-dim uppercase tracking-wider"
                    >Bill of materials</span
                  >
                </div>
                <div class="space-y-2">
                  <div
                    v-for="(part, i) in [
                      { name: 'Side panel', w: '800', h: '600', qty: 2 },
                      { name: 'Top shelf', w: '760', h: '300', qty: 3 },
                      { name: 'Back panel', w: '800', h: '400', qty: 1 },
                      { name: 'Divider', w: '280', h: '580', qty: 4 },
                      { name: 'Drawer front', w: '360', h: '180', qty: 6 },
                    ]"
                    :key="i"
                    class="flex items-center gap-3 py-2 px-3 rounded-lg"
                    :class="
                      i === 0
                        ? 'bg-teal-400/5 border border-teal-400/15'
                        : 'hover:bg-mist-800/50'
                    "
                  >
                    <span class="w-5 text-xs font-mono text-dim text-right">{{
                      i + 1
                    }}</span>
                    <span class="flex-1 text-sm text-body truncate">{{
                      part.name
                    }}</span>
                    <span class="text-xs font-mono text-muted tabular-nums"
                      >{{ part.w }} x {{ part.h }}</span
                    >
                    <span class="text-xs text-dim">x{{ part.qty }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 2 -->
            <div
              class="grid md:grid-cols-2 gap-12 md:gap-16 items-center mb-24"
            >
              <div class="md:order-2">
                <div class="flex items-center gap-3 mb-4">
                  <div
                    class="w-10 h-10 rounded-xl bg-teal-400/10 border border-teal-400/20 flex items-center justify-center"
                  >
                    <span class="text-sm font-mono font-bold text-teal-400"
                      >2</span
                    >
                  </div>
                  <h3 class="text-xl font-semibold text-white">
                    Set your stock
                  </h3>
                </div>
                <p class="text-muted leading-relaxed mb-4">
                  Add the sheet materials you have on hand or plan to buy. Set
                  real dimensions, material types, and grain direction. The
                  optimizer accounts for blade kerf width too.
                </p>
                <div class="flex flex-wrap gap-2">
                  <span
                    class="px-2.5 py-1 rounded-md text-xs text-teal-400 bg-teal-400/5 border border-teal-400/15"
                    >Custom sizes</span
                  >
                  <span
                    class="px-2.5 py-1 rounded-md text-xs text-teal-400 bg-teal-400/5 border border-teal-400/15"
                    >Grain direction</span
                  >
                  <span
                    class="px-2.5 py-1 rounded-md text-xs text-teal-400 bg-teal-400/5 border border-teal-400/15"
                    >Kerf width</span
                  >
                </div>
              </div>
              <!-- Illustration: stock cards -->
              <div
                class="md:order-1 rounded-xl border border-subtle bg-surface p-5"
              >
                <div
                  class="flex items-center gap-2 mb-4 pb-3 border-b border-subtle"
                >
                  <UIcon name="i-lucide-layers" class="w-4 h-4 text-dim" />
                  <span
                    class="text-xs font-mono text-dim uppercase tracking-wider"
                    >Sheet stock</span
                  >
                </div>
                <div class="space-y-3">
                  <div
                    v-for="(stock, i) in [
                      {
                        name: '18mm Birch Plywood',
                        size: '2440 x 1220',
                        color: 'bg-amber-400/20 border-amber-400/30',
                      },
                      {
                        name: '12mm MDF',
                        size: '2440 x 1220',
                        color: 'bg-stone-400/20 border-stone-400/30',
                      },
                      {
                        name: '6mm Hardboard',
                        size: '2440 x 1220',
                        color: 'bg-orange-400/20 border-orange-400/30',
                      },
                    ]"
                    :key="i"
                    class="flex items-center gap-3 p-3 rounded-lg border border-subtle hover:border-mist-600 transition-colors"
                  >
                    <div
                      class="w-10 h-10 rounded-lg border shrink-0"
                      :class="stock.color"
                    />
                    <div class="flex-1 min-w-0">
                      <div class="text-sm text-body truncate">
                        {{ stock.name }}
                      </div>
                      <div class="text-xs font-mono text-muted">
                        {{ stock.size }} mm
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 3 -->
            <div class="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
              <div>
                <div class="flex items-center gap-3 mb-4">
                  <div
                    class="w-10 h-10 rounded-xl bg-teal-400/10 border border-teal-400/20 flex items-center justify-center"
                  >
                    <span class="text-sm font-mono font-bold text-teal-400"
                      >3</span
                    >
                  </div>
                  <h3 class="text-xl font-semibold text-white">
                    Get optimized layouts
                  </h3>
                </div>
                <p class="text-muted leading-relaxed mb-4">
                  The packing engine runs multiple algorithms in parallel,
                  scores the results, and shows you the layout that wastes the
                  least material. Every cut is a straight, through-cut you can
                  make with a table saw or track saw.
                </p>
                <div class="flex flex-wrap gap-2">
                  <span
                    class="px-2.5 py-1 rounded-md text-xs text-teal-400 bg-teal-400/5 border border-teal-400/15"
                    >Guillotine cuts</span
                  >
                  <span
                    class="px-2.5 py-1 rounded-md text-xs text-teal-400 bg-teal-400/5 border border-teal-400/15"
                    >CNC mode</span
                  >
                  <span
                    class="px-2.5 py-1 rounded-md text-xs text-teal-400 bg-teal-400/5 border border-teal-400/15"
                    >PDF export</span
                  >
                </div>
              </div>
              <!-- Illustration: mini board layout -->
              <div class="rounded-xl border border-subtle bg-surface p-5">
                <div
                  class="flex items-center justify-between mb-4 pb-3 border-b border-subtle"
                >
                  <div class="flex items-center gap-2">
                    <UIcon
                      name="i-lucide-layout-grid"
                      class="w-4 h-4 text-dim"
                    />
                    <span
                      class="text-xs font-mono text-dim uppercase tracking-wider"
                      >Board 1 of 3</span
                    >
                  </div>
                  <span class="text-xs font-mono text-teal-400">94% used</span>
                </div>
                <!-- prettier-ignore -->
                <svg viewBox="0 0 244 122" xmlns="http://www.w3.org/2000/svg" class="w-full rounded-lg">
                  <rect width="244" height="122" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1" rx="2"/>
                  <rect x="3" y="3" width="78" height="56" fill="rgba(20,184,166,0.10)" stroke="rgba(20,184,166,0.35)" stroke-width="0.75" rx="1"/><text x="42" y="35" font-size="7" fill="rgba(20,184,166,0.40)" text-anchor="middle" font-family="monospace">Side L</text>
                  <rect x="83" y="3" width="78" height="56" fill="rgba(20,184,166,0.10)" stroke="rgba(20,184,166,0.35)" stroke-width="0.75" rx="1"/><text x="122" y="35" font-size="7" fill="rgba(20,184,166,0.40)" text-anchor="middle" font-family="monospace">Side R</text>
                  <rect x="163" y="3" width="78" height="56" fill="rgba(20,184,166,0.10)" stroke="rgba(20,184,166,0.35)" stroke-width="0.75" rx="1"/><text x="202" y="35" font-size="7" fill="rgba(20,184,166,0.40)" text-anchor="middle" font-family="monospace">Back</text>
                  <rect x="3" y="61" width="58" height="58" fill="rgba(20,184,166,0.10)" stroke="rgba(20,184,166,0.35)" stroke-width="0.75" rx="1"/><text x="32" y="94" font-size="7" fill="rgba(20,184,166,0.40)" text-anchor="middle" font-family="monospace">Shelf</text>
                  <rect x="63" y="61" width="58" height="58" fill="rgba(20,184,166,0.10)" stroke="rgba(20,184,166,0.35)" stroke-width="0.75" rx="1"/><text x="92" y="94" font-size="7" fill="rgba(20,184,166,0.40)" text-anchor="middle" font-family="monospace">Shelf</text>
                  <rect x="123" y="61" width="58" height="58" fill="rgba(20,184,166,0.10)" stroke="rgba(20,184,166,0.35)" stroke-width="0.75" rx="1"/><text x="152" y="94" font-size="7" fill="rgba(20,184,166,0.40)" text-anchor="middle" font-family="monospace">Shelf</text>
                  <rect x="183" y="61" width="58" height="58" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,2" rx="1"/>
                </svg>
                <div
                  class="flex items-center justify-between mt-3 text-xs text-muted"
                >
                  <span>18mm Birch Plywood</span>
                  <span class="font-mono">2440 x 1220 mm</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ════════════════════════════════════════════════════════════════ -->
        <!-- FEATURES                                                        -->
        <!-- ════════════════════════════════════════════════════════════════ -->
        <section class="border-t border-subtle bg-mist-900/30">
          <div class="max-w-5xl mx-auto px-6 py-24 sm:py-32">
            <div class="text-center mb-16">
              <span
                class="text-xs font-mono text-teal-400 uppercase tracking-widest"
                >Built for the workshop</span
              >
              <h2
                class="mt-4 text-3xl sm:text-4xl font-bold text-white tracking-tight"
              >
                Real cuts, not theory
              </h2>
              <p
                class="mt-4 text-lg text-muted max-w-2xl mx-auto leading-relaxed"
              >
                Most nesting software ignores how you actually cut material.
                Cutlist Studio is built around the constraints of real tools.
              </p>
            </div>

            <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div
                v-for="feature in [
                  {
                    icon: 'i-lucide-scissors',
                    title: 'Guillotine cuts',
                    desc: 'Every cut goes edge-to-edge, the way a table saw or track saw actually works. No impossible L-shaped cuts.',
                  },
                  {
                    icon: 'i-lucide-cpu',
                    title: 'CNC mode',
                    desc: 'Working with a CNC router? Switch to unconstrained nesting for tighter packing when cuts don\'t need to be straight-through.',
                  },
                  {
                    icon: 'i-lucide-file-text',
                    title: 'PDF export',
                    desc: 'Print your cutting diagrams and take them to the shop. Each board gets its own page with labeled parts and dimensions.',
                  },
                  {
                    icon: 'i-lucide-box',
                    title: '3D model viewer',
                    desc: 'Imported a GLTF model? View it in 3D, click parts to identify them in the cut list, and verify dimensions before cutting.',
                  },
                  {
                    icon: 'i-lucide-wifi-off',
                    title: 'Works offline',
                    desc: 'Everything runs in your browser. No server, no uploads, no internet required. Your projects stay on your machine.',
                  },
                  {
                    icon: 'i-lucide-lock-open',
                    title: 'No account needed',
                    desc: 'Just open the app and start working. Projects are stored in your browser\'s local storage. Export them as files to back up or share.',
                  },
                ]"
                :key="feature.title"
                class="group rounded-xl border border-subtle bg-surface p-6 hover:border-mist-600 transition-colors"
              >
                <div
                  class="w-10 h-10 rounded-xl bg-teal-400/5 border border-teal-400/15 flex items-center justify-center mb-4 group-hover:bg-teal-400/10 transition-colors"
                >
                  <UIcon :name="feature.icon" class="w-5 h-5 text-teal-400" />
                </div>
                <h3 class="text-sm font-semibold text-white mb-2">
                  {{ feature.title }}
                </h3>
                <p class="text-sm text-muted leading-relaxed">
                  {{ feature.desc }}
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- ════════════════════════════════════════════════════════════════ -->
        <!-- BOTTOM CTA                                                      -->
        <!-- ════════════════════════════════════════════════════════════════ -->
        <section class="border-t border-subtle">
          <div class="max-w-2xl mx-auto px-6 py-24 sm:py-32 text-center">
            <h2
              class="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-4"
            >
              Ready to optimize your cuts?
            </h2>
            <p class="text-muted leading-relaxed mb-8">
              Start a new project and see your first cutting plan in minutes.
              It's free, private, and runs entirely in your browser.
            </p>
            <div
              class="flex flex-col sm:flex-row items-center justify-center gap-3"
            >
              <button
                class="w-full sm:w-auto px-8 py-3 rounded-lg bg-teal-500 hover:bg-teal-400 active:bg-teal-600 text-black font-semibold text-sm transition-colors"
                @click="openNewProject"
              >
                New Project
              </button>
              <button
                class="w-full sm:w-auto px-8 py-3 rounded-lg border border-subtle bg-surface hover:bg-mist-800 text-muted hover:text-body text-sm transition-colors"
                @click="pickAndImport"
              >
                Import Project
              </button>
            </div>
          </div>
        </section>

        <!-- Footer -->
        <footer class="border-t border-subtle">
          <div
            class="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div class="text-sm font-semibold tracking-tight">
              <span class="text-white">cutlist</span
              ><span class="text-teal-400">studio</span>
            </div>
            <div class="flex items-center gap-6">
              <NuxtLink
                to="/about"
                class="text-xs text-muted hover:text-body transition-colors"
                >About</NuxtLink
              >
              <NuxtLink
                to="/terms"
                class="text-xs text-muted hover:text-body transition-colors"
                >Terms</NuxtLink
              >
            </div>
          </div>
        </footer>
      </div>
    </ClientOnly>

    <UModal
      v-model:open="showNewProject"
      title="New Project"
      description="Create a new project"
    >
      <template #content>
        <div class="p-6 space-y-4 bg-elevated border border-default rounded-lg">
          <h3 class="text-lg font-medium text-white">New Project</h3>
          <UInput
            v-model="projectName"
            placeholder="Project name"
            class="w-full"
            autofocus
            @keydown.enter="createProject"
          />
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
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
      </template>
    </UModal>
  </div>
</template>
