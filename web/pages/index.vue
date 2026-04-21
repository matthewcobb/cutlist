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
        <!-- prettier-ignore -->
        <div class="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
          <svg viewBox="0 0 1000 560" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" class="w-full h-full">
            <!-- Sheet A: portrait, 3 rows of parts -->
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

            <!-- Sheet B: wide landscape, 4+2 parts -->
            <rect x="222" y="8" width="305" height="145" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
            <rect x="227" y="13" width="72" height="65" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="263" y="49" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#1</text>
            <rect x="301" y="13" width="72" height="65" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="337" y="49" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#2</text>
            <rect x="375" y="13" width="72" height="65" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="411" y="49" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#3</text>
            <rect x="449" y="13" width="73" height="65" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="485" y="49" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#4</text>
            <rect x="227" y="81" width="145" height="67" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="299" y="118" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#5</text>
            <rect x="374" y="81" width="90" height="67" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="419" y="118" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#6</text>
            <rect x="466" y="81" width="56" height="67" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>

            <!-- Sheet C: square, 2 rows -->
            <rect x="542" y="18" width="196" height="180" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
            <rect x="547" y="23" width="92" height="86" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="593" y="70" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#1</text>
            <rect x="641" y="23" width="92" height="86" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="687" y="70" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#2</text>
            <rect x="547" y="112" width="57" height="81" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="575" y="156" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#3</text>
            <rect x="606" y="112" width="57" height="81" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="634" y="156" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#4</text>
            <rect x="665" y="112" width="68" height="81" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>

            <!-- Sheet D: tall, 3 rows -->
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

            <!-- Sheet E: small 2×2 -->
            <rect x="10" y="248" width="140" height="160" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
            <rect x="15" y="253" width="62" height="73" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="46" y="293" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#1</text>
            <rect x="79" y="253" width="66" height="73" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="112" y="293" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#2</text>
            <rect x="15" y="329" width="62" height="74" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="46" y="369" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#3</text>
            <rect x="79" y="329" width="66" height="74" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="112" y="369" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#4</text>

            <!-- Sheet F: large, varied 2 rows -->
            <rect x="162" y="240" width="365" height="185" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
            <rect x="167" y="245" width="145" height="88" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="239" y="293" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#1</text>
            <rect x="314" y="245" width="108" height="88" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="368" y="293" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#2</text>
            <rect x="424" y="245" width="98" height="88" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="473" y="293" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#3</text>
            <rect x="167" y="336" width="100" height="84" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="217" y="382" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#4</text>
            <rect x="269" y="336" width="100" height="84" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="319" y="382" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#5</text>
            <rect x="371" y="336" width="100" height="84" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="421" y="382" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#6</text>
            <rect x="473" y="336" width="49" height="84" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>
            <line x1="162" y1="431" x2="527" y2="431" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/><line x1="162" y1="428" x2="162" y2="434" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/><line x1="527" y1="428" x2="527" y2="434" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/>

            <!-- Sheet G: medium, 2+3 rows -->
            <rect x="540" y="245" width="258" height="170" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
            <rect x="545" y="250" width="122" height="80" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="606" y="294" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#1</text>
            <rect x="669" y="250" width="124" height="80" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="731" y="294" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#2</text>
            <rect x="545" y="333" width="75" height="77" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="582" y="375" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#3</text>
            <rect x="622" y="333" width="75" height="77" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="659" y="375" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#4</text>
            <rect x="699" y="333" width="75" height="77" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="736" y="375" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#5</text>
            <rect x="776" y="333" width="17" height="77" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>

            <!-- Sheet H: small, 2 rows -->
            <rect x="812" y="248" width="178" height="168" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
            <rect x="817" y="253" width="80" height="80" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="857" y="297" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#1</text>
            <rect x="899" y="253" width="84" height="80" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="941" y="297" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#2</text>
            <rect x="817" y="336" width="120" height="75" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="877" y="377" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#3</text>
            <rect x="939" y="336" width="44" height="75" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>

            <!-- Sheet I: wide flat, 4 tall parts -->
            <rect x="10" y="432" width="290" height="118" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
            <rect x="15" y="437" width="66" height="103" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="48" y="492" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#1</text>
            <rect x="83" y="437" width="66" height="103" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="116" y="492" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#2</text>
            <rect x="151" y="437" width="66" height="103" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="184" y="492" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#3</text>
            <rect x="219" y="437" width="76" height="103" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="257" y="492" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#4</text>

            <!-- Sheet J: medium flat, 3 parts -->
            <rect x="314" y="442" width="212" height="108" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
            <rect x="319" y="447" width="67" height="98" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="352" y="500" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#1</text>
            <rect x="388" y="447" width="67" height="98" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="421" y="500" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#2</text>
            <rect x="457" y="447" width="64" height="98" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="489" y="500" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#3</text>

            <!-- Sheet K: 2 parts + leftover -->
            <rect x="540" y="436" width="185" height="114" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
            <rect x="545" y="441" width="82" height="104" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="586" y="497" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#1</text>
            <rect x="629" y="441" width="78" height="104" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="668" y="497" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#2</text>
            <rect x="709" y="441" width="11" height="104" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>

            <!-- Sheet L: wide flat, 3 parts -->
            <rect x="740" y="430" width="250" height="120" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
            <rect x="745" y="435" width="79" height="110" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="784" y="494" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#1</text>
            <rect x="826" y="435" width="79" height="110" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="865" y="494" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#2</text>
            <rect x="907" y="435" width="78" height="110" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="946" y="494" font-size="8" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">#3</text>
            <line x1="740" y1="423" x2="990" y2="423" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/><line x1="740" y1="420" x2="740" y2="426" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/><line x1="990" y1="420" x2="990" y2="426" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/>
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
            ><span class="text-teal-400">studio</span>
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
                class="w-full py-2 px-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-muted hover:text-body text-sm transition-colors"
                @click="pickAndImport"
              >
                Import Project
              </button>
            </div>

            <p v-if="!isDragging" class="mt-4 text-xs text-muted">
              or drop a
              <span class="font-mono text-dim">.cutlist.gz</span> file anywhere
            </p>
          </div>

          <p class="text-xs text-muted leading-relaxed">
            Projects are stored locally in your browser.
          </p>

          <!-- How it works -->
          <div class="w-full">
            <div class="flex items-center gap-3 mb-5">
              <div class="flex-1 h-px bg-white/[0.06]" />
              <span class="text-xs text-dim uppercase tracking-widest"
                >How it works</span
              >
              <div class="flex-1 h-px bg-white/[0.06]" />
            </div>

            <div class="grid grid-cols-3 gap-4 mb-6">
              <div class="flex flex-col items-center gap-2">
                <div
                  class="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center"
                >
                  <span class="text-xs font-mono text-teal-400">1</span>
                </div>
                <p class="text-xs text-muted leading-relaxed">
                  Import a <span class="text-body">GLTF model</span> to extract
                  your parts list
                </p>
              </div>
              <div class="flex flex-col items-center gap-2">
                <div
                  class="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center"
                >
                  <span class="text-xs font-mono text-teal-400">2</span>
                </div>
                <p class="text-xs text-muted leading-relaxed">
                  Add your available
                  <span class="text-body">sheet stock</span>
                </p>
              </div>
              <div class="flex flex-col items-center gap-2">
                <div
                  class="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center"
                >
                  <span class="text-xs font-mono text-teal-400">3</span>
                </div>
                <p class="text-xs text-muted leading-relaxed">
                  Get <span class="text-body">optimized layouts</span> that
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
                class="px-2.5 py-1 rounded-md text-xs text-muted border border-white/[0.07]"
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
