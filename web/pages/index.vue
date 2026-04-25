<script lang="ts" setup>
const { activeProject } = useProjects();
const { importFromFile, pickAndImport } = useImportProject();
const toast = useToast();

const showNewProject = ref(false);

function openNewProject() {
  showNewProject.value = true;
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
  <AppShell>
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
              <!-- Board A: Cabinet sides + back + shelves (300x190) -->
              <rect x="10" y="10" width="300" height="190" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
              <rect x="15" y="15" width="52" height="178" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="41" y="108" font-size="7" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Side L</text>
              <rect x="70" y="15" width="52" height="178" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="96" y="108" font-size="7" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Side R</text>
              <rect x="125" y="15" width="178" height="95" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="214" y="66" font-size="7" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Back</text>
              <rect x="125" y="113" width="86" height="26" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="168" y="130" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Shelf</text>
              <rect x="125" y="142" width="86" height="26" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="168" y="159" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Shelf</text>
              <rect x="125" y="171" width="86" height="22" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="168" y="186" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Shelf</text>
              <rect x="214" y="113" width="89" height="80" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>
              <!-- Dimension line -->
              <line x1="10" y1="4" x2="310" y2="4" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/><line x1="10" y1="1" x2="10" y2="7" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/><line x1="310" y1="1" x2="310" y2="7" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/>

              <!-- Board B: Drawer fronts + dividers (260x170) -->
              <rect x="325" y="15" width="260" height="170" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
              <rect x="330" y="20" width="120" height="28" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="390" y="38" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Drawer front</text>
              <rect x="453" y="20" width="120" height="28" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="513" y="38" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Drawer front</text>
              <rect x="330" y="51" width="120" height="28" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="390" y="69" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Drawer front</text>
              <rect x="453" y="51" width="120" height="28" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="513" y="69" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Drawer front</text>
              <rect x="330" y="82" width="72" height="96" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="366" y="134" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Divider</text>
              <rect x="405" y="82" width="72" height="96" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="441" y="134" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Divider</text>
              <rect x="480" y="82" width="98" height="96" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>

              <!-- Board C: Long shelves stacked (190x200) -->
              <rect x="600" y="8" width="175" height="200" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
              <rect x="605" y="13" width="162" height="26" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="686" y="30" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Top rail</text>
              <rect x="605" y="42" width="162" height="26" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="686" y="59" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Bottom rail</text>
              <rect x="605" y="71" width="162" height="26" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="686" y="88" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Stretcher</text>
              <rect x="605" y="100" width="100" height="100" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="655" y="154" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Door</text>
              <rect x="708" y="100" width="59" height="100" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>
              <!-- Dimension line -->
              <line x1="781" y1="8" x2="781" y2="208" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/><line x1="778" y1="8" x2="784" y2="8" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/><line x1="778" y1="208" x2="784" y2="208" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/>

              <!-- Board D: Big panels (200x195) -->
              <rect x="800" y="12" width="190" height="195" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
              <rect x="805" y="17" width="90" height="130" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="850" y="86" font-size="7" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Panel</text>
              <rect x="898" y="17" width="85" height="85" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="940" y="63" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Top</text>
              <rect x="898" y="105" width="85" height="42" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="940" y="130" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Kick</text>
              <rect x="805" y="150" width="60" height="50" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="835" y="179" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Cleat</text>
              <rect x="868" y="150" width="115" height="50" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>

              <!-- Board E: Wide board with long parts (370x125) -->
              <rect x="10" y="220" width="370" height="125" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
              <rect x="15" y="225" width="355" height="22" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="192" y="240" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Face frame top</text>
              <rect x="15" y="250" width="355" height="22" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="192" y="265" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Face frame bottom</text>
              <rect x="15" y="275" width="170" height="62" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="100" y="310" font-size="7" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Bottom</text>
              <rect x="188" y="275" width="85" height="62" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="230" y="310" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Shelf</text>
              <rect x="276" y="275" width="97" height="62" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>
              <!-- Dimension line -->
              <line x1="10" y1="351" x2="380" y2="351" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/><line x1="10" y1="348" x2="10" y2="354" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/><line x1="380" y1="348" x2="380" y2="354" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/>

              <!-- Board F: Mixed small parts (220x165) -->
              <rect x="395" y="215" width="220" height="165" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
              <rect x="400" y="220" width="42" height="152" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="421" y="300" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace" transform="rotate(-90,421,300)">Stile</text>
              <rect x="445" y="220" width="42" height="152" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="466" y="300" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace" transform="rotate(-90,466,300)">Stile</text>
              <rect x="490" y="220" width="118" height="45" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="549" y="247" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Rail</text>
              <rect x="490" y="268" width="118" height="45" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="549" y="295" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Rail</text>
              <rect x="490" y="316" width="118" height="56" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>

              <!-- Board G: Small parts (180x155) -->
              <rect x="630" y="225" width="165" height="155" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
              <rect x="635" y="230" width="75" height="68" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="672" y="268" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Gable</text>
              <rect x="713" y="230" width="75" height="68" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="750" y="268" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Gable</text>
              <rect x="635" y="301" width="50" height="72" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="660" y="341" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">End</text>
              <rect x="688" y="301" width="50" height="72" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="713" y="341" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">End</text>
              <rect x="741" y="301" width="47" height="72" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>

              <!-- Board H: Narrow strips board (185x155) -->
              <rect x="810" y="222" width="180" height="155" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
              <rect x="815" y="227" width="168" height="20" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="899" y="241" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Trim</text>
              <rect x="815" y="250" width="168" height="20" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="899" y="264" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Trim</text>
              <rect x="815" y="273" width="168" height="20" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="899" y="287" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Edging</text>
              <rect x="815" y="296" width="168" height="20" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="899" y="310" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Edging</text>
              <rect x="815" y="319" width="90" height="51" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="860" y="348" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Nailer</text>
              <rect x="908" y="319" width="75" height="51" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>

              <!-- Row 3 partial boards -->
              <!-- Board I: Wide landscape (310x130) -->
              <rect x="10" y="370" width="310" height="130" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
              <rect x="15" y="375" width="145" height="55" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="87" y="406" font-size="7" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Lid</text>
              <rect x="163" y="375" width="150" height="55" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="238" y="406" font-size="7" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Base</text>
              <rect x="15" y="433" width="95" height="22" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="62" y="448" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Apron F</text>
              <rect x="113" y="433" width="95" height="22" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="160" y="448" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Apron B</text>
              <rect x="211" y="433" width="48" height="22" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="235" y="448" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Cleat</text>
              <rect x="15" y="458" width="298" height="35" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>
              <rect x="262" y="433" width="51" height="22" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>

              <!-- Board J (250x155) -->
              <rect x="335" y="395" width="250" height="155" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
              <rect x="340" y="400" width="115" height="90" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="397" y="449" font-size="7" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Door L</text>
              <rect x="458" y="400" width="115" height="90" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="515" y="449" font-size="7" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Door R</text>
              <rect x="340" y="493" width="75" height="22" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="377" y="508" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Filler</text>
              <rect x="418" y="493" width="75" height="22" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="455" y="508" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Filler</text>
              <rect x="340" y="518" width="237" height="25" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>
              <rect x="496" y="493" width="81" height="22" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>

              <!-- Board K (190x145) -->
              <rect x="600" y="400" width="190" height="150" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
              <rect x="605" y="405" width="178" height="65" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="694" y="441" font-size="7" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Countertop</text>
              <rect x="605" y="473" width="55" height="70" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="632" y="512" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Brace</text>
              <rect x="663" y="473" width="55" height="70" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="690" y="512" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Brace</text>
              <rect x="721" y="473" width="62" height="70" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>
              <!-- Dimension line -->
              <line x1="797" y1="400" x2="797" y2="550" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/><line x1="794" y1="400" x2="800" y2="400" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/><line x1="794" y1="550" x2="800" y2="550" stroke="rgba(20,184,166,0.13)" stroke-width="0.5"/>

              <!-- Board L (185x145) -->
              <rect x="810" y="398" width="180" height="152" fill="rgba(20,184,166,0.03)" stroke="rgba(20,184,166,0.22)" stroke-width="1"/>
              <rect x="815" y="403" width="80" height="140" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="855" y="477" font-size="7" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Tall</text>
              <rect x="898" y="403" width="85" height="65" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="940" y="440" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Shelf</text>
              <rect x="898" y="471" width="85" height="28" fill="rgba(20,184,166,0.07)" stroke="rgba(20,184,166,0.30)" stroke-width="0.75"/><text x="940" y="489" font-size="6" fill="rgba(20,184,166,0.20)" text-anchor="middle" font-family="monospace">Nailer</text>
              <rect x="898" y="502" width="85" height="41" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,3"/>
            </svg>
          </div>

          <!-- Gradient overlay -->
          <div
            class="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(9,11,12,0.94)_0%,rgba(9,11,12,0.72)_55%,rgba(9,11,12,0.42)_100%)]"
          />

          <!-- Hero content -->
          <div
            class="relative z-10 flex flex-col items-center gap-6 w-full max-w-md px-4 text-center"
          >
            <div class="text-xl font-bold tracking-tight">
              <span class="text-white">cutlist</span
              ><span class="text-teal-400">studio</span>
            </div>

            <div class="-mt-2">
              <p class="text-lg text-body leading-relaxed">
                Turn your design into a cut plan.
              </p>
              <p class="text-sm text-muted mt-1.5">
                Free, forever. No account. Works offline.
              </p>
            </div>

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
              Everything stays in your browser. Nothing to sign up for.
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
                From model to shop in minutes
              </h2>
              <p
                class="mt-4 text-lg text-muted max-w-2xl mx-auto leading-relaxed"
              >
                Drop in your parts, pick your sheet stock, and get an optimized
                cutting plan ready to print.
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
                    Add your parts
                  </h3>
                </div>
                <p class="text-muted leading-relaxed mb-4">
                  Import a 3D model and every flat panel gets extracted
                  automatically. Built for
                  <span class="text-body">Onshape</span> exports, but any GLTF
                  file works. Prefer a spreadsheet? Just type your parts in
                  manually.
                </p>
                <div class="flex flex-wrap gap-2">
                  <span
                    class="px-2.5 py-1 rounded-md text-xs text-teal-400 bg-teal-400/5 border border-teal-400/15"
                    >Onshape / GLTF import</span
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
                    Pick your stock
                  </h3>
                </div>
                <p class="text-muted leading-relaxed mb-4">
                  Add the sheets you're working with -- dimensions, material,
                  grain direction. Even accounts for the width of your saw
                  blade.
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
                    >Blade kerf</span
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
                    Get your cut plan
                  </h3>
                </div>
                <p class="text-muted leading-relaxed mb-4">
                  A bunch of arrangements get tried and the best one wins. Every
                  cut is a straight through-cut -- the kind you can actually
                  make with a table saw. Export to a scaled PDF and take it to
                  the shop.
                </p>
                <div class="flex flex-wrap gap-2">
                  <span
                    class="px-2.5 py-1 rounded-md text-xs text-teal-400 bg-teal-400/5 border border-teal-400/15"
                    >Table-saw cuts</span
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
                  <rect x="3" y="3" width="38" height="116" fill="rgba(20,184,166,0.10)" stroke="rgba(20,184,166,0.35)" stroke-width="0.75" rx="1"/><text x="22" y="64" font-size="6" fill="rgba(20,184,166,0.40)" text-anchor="middle" font-family="monospace">Side L</text>
                  <rect x="43" y="3" width="38" height="116" fill="rgba(20,184,166,0.10)" stroke="rgba(20,184,166,0.35)" stroke-width="0.75" rx="1"/><text x="62" y="64" font-size="6" fill="rgba(20,184,166,0.40)" text-anchor="middle" font-family="monospace">Side R</text>
                  <rect x="83" y="3" width="158" height="62" fill="rgba(20,184,166,0.10)" stroke="rgba(20,184,166,0.35)" stroke-width="0.75" rx="1"/><text x="162" y="38" font-size="7" fill="rgba(20,184,166,0.40)" text-anchor="middle" font-family="monospace">Back</text>
                  <rect x="83" y="67" width="76" height="18" fill="rgba(20,184,166,0.10)" stroke="rgba(20,184,166,0.35)" stroke-width="0.75" rx="1"/><text x="121" y="80" font-size="6" fill="rgba(20,184,166,0.40)" text-anchor="middle" font-family="monospace">Shelf</text>
                  <rect x="161" y="67" width="76" height="18" fill="rgba(20,184,166,0.10)" stroke="rgba(20,184,166,0.35)" stroke-width="0.75" rx="1"/><text x="199" y="80" font-size="6" fill="rgba(20,184,166,0.40)" text-anchor="middle" font-family="monospace">Shelf</text>
                  <rect x="83" y="87" width="76" height="18" fill="rgba(20,184,166,0.10)" stroke="rgba(20,184,166,0.35)" stroke-width="0.75" rx="1"/><text x="121" y="100" font-size="6" fill="rgba(20,184,166,0.40)" text-anchor="middle" font-family="monospace">Shelf</text>
                  <rect x="161" y="87" width="76" height="32" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,2" rx="1"/>
                  <rect x="83" y="107" width="76" height="12" fill="rgba(20,184,166,0.02)" stroke="rgba(20,184,166,0.10)" stroke-width="0.75" stroke-dasharray="3,2" rx="1"/>
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
                >Features</span
              >
              <h2
                class="mt-4 text-3xl sm:text-4xl font-bold text-white tracking-tight"
              >
                All of this, for free
              </h2>
            </div>

            <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div
                v-for="feature in [
                  {
                    icon: 'i-lucide-heart',
                    title: 'Completely free',
                    desc: 'No trial, no tier limits, no surprise paywall. The whole app is free, forever.',
                  },
                  {
                    icon: 'i-lucide-scissors',
                    title: 'Cuts you can actually make',
                    desc: 'Every cut goes edge-to-edge, the way a table saw or track saw works. No impossible L-shaped cuts. Got a CNC? Switch to unconstrained mode.',
                  },
                  {
                    icon: 'i-lucide-file-text',
                    title: 'Scaled PDF drawings',
                    desc: 'Export your cut plan as a PDF with each board on its own page. Labeled parts, real dimensions, ready for the shop floor.',
                  },
                  {
                    icon: 'i-lucide-box',
                    title: '3D model viewer',
                    desc: 'Imported a model? Spin it around, click parts to find them in the cut list, and double-check dimensions before you cut anything.',
                  },
                  {
                    icon: 'i-lucide-wifi-off',
                    title: 'Works offline',
                    desc: 'Everything runs in your browser. No server, no uploads, no internet needed. Take your laptop to the workshop.',
                  },
                  {
                    icon: 'i-lucide-user-x',
                    title: 'No account, no tracking',
                    desc: 'Just open the app and start working. Your projects live in your browser. Export them as files to back up or share.',
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
              Ready to build something?
            </h2>
            <p class="text-muted leading-relaxed mb-8">
              Drop in your parts, get an optimized cut plan, and start building.
              Free, private, no sign-up.
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

    <NewProjectDialog v-model:open="showNewProject" />
  </AppShell>
</template>
