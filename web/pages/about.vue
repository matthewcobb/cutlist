<template>
  <div class="absolute inset-0 overflow-y-auto bg-base">
    <div class="max-w-2xl mx-auto px-6 py-12">
      <NuxtLink
        to="/"
        class="inline-flex items-center gap-2 text-dim hover:text-body text-xs transition-colors mb-10"
      >
        <UIcon name="i-lucide-arrow-left" class="w-3 h-3" />
        Back to app
      </NuxtLink>

      <h1 class="text-2xl font-semibold text-white mb-1">Cutlist Generator</h1>
      <p class="text-dim text-xs mb-10">
        Free browser-based cutting plan optimizer for woodworkers and makers.
      </p>

      <section class="space-y-8 text-sm text-body leading-relaxed">
        <div>
          <h2
            class="text-teal-400 text-xs font-semibold uppercase tracking-wider mb-3"
          >
            What is Cutlist Generator?
          </h2>
          <p>
            Cutlist Generator is a
            <strong class="text-white">free, open tool</strong> that turns your
            parts list into optimized cutting plans for sheet goods and boards.
            Import a 3D model (GLTF/GLB) or enter parts by hand, assign stock
            materials, and the app computes efficient board layouts that
            minimize waste. Export to PDF for the workshop or share projects as
            <code class="text-teal-300">.cutlist.gz</code> files.
          </p>
        </div>

        <div>
          <h2
            class="text-teal-400 text-xs font-semibold uppercase tracking-wider mb-3"
          >
            Who is it for?
          </h2>
          <p>
            Anyone who cuts sheet material &mdash; woodworkers, cabinet makers,
            furniture builders, CNC operators, makerspaces, and DIY enthusiasts.
            Whether you're building a single bookcase from plywood or batching
            parts for a kitchen full of cabinets, Cutlist Generator helps you
            buy less material and waste fewer offcuts.
          </p>
        </div>

        <div>
          <h2
            class="text-teal-400 text-xs font-semibold uppercase tracking-wider mb-3"
          >
            Core Features
          </h2>
          <ul class="space-y-3 mt-2">
            <li
              v-for="feature in features"
              :key="feature.title"
              class="flex gap-3"
            >
              <UIcon
                :name="feature.icon"
                class="w-4 h-4 text-teal-400 shrink-0 mt-0.5"
              />
              <div>
                <strong class="text-white">{{ feature.title }}</strong>
                <span class="text-muted">
                  &mdash; {{ feature.description }}</span
                >
              </div>
            </li>
          </ul>
        </div>

        <div>
          <h2
            class="text-teal-400 text-xs font-semibold uppercase tracking-wider mb-3"
          >
            Optimization Engine
          </h2>
          <p>
            The packing engine runs
            <strong class="text-white">multiple search passes</strong> using
            different algorithms &mdash; shelf packing, guillotine-constrained
            cuts, and tight/exact placement &mdash; then scores and ranks
            results to find the layout that uses the fewest boards with the
            least waste. Guillotine mode ensures every cut goes edge-to-edge,
            matching how panels are actually broken down with a track saw or
            panel saw.
          </p>
        </div>

        <div>
          <h2
            class="text-teal-400 text-xs font-semibold uppercase tracking-wider mb-3"
          >
            3D Model Import
          </h2>
          <p>
            Design your project in any 3D tool that exports
            <strong class="text-white">GLTF or GLB</strong> (Blender, Fusion
            360, SketchUp via plugin, FreeCAD, and others). Cutlist Generator
            parses the assembly, extracts part dimensions, and lets you preview
            the model in an interactive 3D viewer. Assign materials by color,
            lock grain direction per part, and override dimensions as needed.
          </p>
        </div>

        <div>
          <h2
            class="text-teal-400 text-xs font-semibold uppercase tracking-wider mb-3"
          >
            Privacy &amp; Data
          </h2>
          <p>
            Everything runs in your browser. Your projects, models, and settings
            are stored locally in
            <strong class="text-white">IndexedDB</strong> &mdash; nothing is
            sent to any server. No accounts, no analytics, no cookies, no
            tracking. Your data stays on your machine.
          </p>
        </div>

        <div>
          <h2
            class="text-teal-400 text-xs font-semibold uppercase tracking-wider mb-3"
          >
            Supported Stock Materials
          </h2>
          <p class="mb-3">
            Ships with common defaults for plywood, MDF, and hardwood in both
            metric and imperial units. You can add custom stock sizes,
            materials, and thicknesses to match whatever your local supplier
            carries.
          </p>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="mat in materials"
              :key="mat"
              class="px-2 py-1 text-xs rounded bg-surface text-muted border border-subtle"
            >
              {{ mat }}
            </span>
          </div>
        </div>

        <div>
          <h2
            class="text-teal-400 text-xs font-semibold uppercase tracking-wider mb-3"
          >
            How It Works
          </h2>
          <ol class="space-y-2 list-decimal list-inside">
            <li>
              <strong class="text-white">Import or enter parts</strong> &mdash;
              load a GLTF/GLB file or add parts manually with dimensions.
            </li>
            <li>
              <strong class="text-white">Assign materials</strong> &mdash; map
              colors or groups to stock (plywood, MDF, hardwood, custom).
            </li>
            <li>
              <strong class="text-white">Configure settings</strong> &mdash; set
              blade kerf width, extra spacing, and optimization mode (CNC or
              manual).
            </li>
            <li>
              <strong class="text-white">Generate layouts</strong> &mdash; the
              engine computes optimized board layouts automatically.
            </li>
            <li>
              <strong class="text-white">Export</strong> &mdash; download a PDF
              cutting diagram for the shop, or save/share the project file.
            </li>
          </ol>
        </div>

        <div>
          <h2
            class="text-teal-400 text-xs font-semibold uppercase tracking-wider mb-3"
          >
            Free &amp; Open
          </h2>
          <p>
            Cutlist Generator is free to use with no sign-up required. It is
            currently in
            <strong class="text-white">beta</strong> &mdash; features are
            actively being developed and improved. If you have feedback or
            feature requests, they are welcome.
          </p>
        </div>
      </section>

      <p class="mt-12 text-dim text-xs">
        Built by Matt &mdash; {{ new Date().getFullYear() }}
      </p>
    </div>
  </div>
</template>

<script lang="ts" setup>
const features = [
  {
    icon: 'i-lucide-box',
    title: 'GLTF/GLB Import',
    description:
      'Parse 3D assemblies from Blender, Fusion 360, SketchUp, and other tools. Parts are extracted automatically.',
  },
  {
    icon: 'i-lucide-pencil',
    title: 'Manual Parts Entry',
    description:
      'Enter parts by hand with name, dimensions, quantity, and material for projects without a 3D model.',
  },
  {
    icon: 'i-lucide-layout-grid',
    title: 'Optimized Board Layouts',
    description:
      'Multiple packing algorithms compete to find the layout with the fewest boards and least waste.',
  },
  {
    icon: 'i-lucide-scissors',
    title: 'Guillotine-Constrained Cuts',
    description:
      'Layouts where every cut goes edge-to-edge, matching real panel-saw and track-saw workflows.',
  },
  {
    icon: 'i-lucide-rotate-3d',
    title: 'Grain Direction Lock',
    description:
      'Lock grain direction per part to prevent rotation during optimization.',
  },
  {
    icon: 'i-lucide-file-down',
    title: 'PDF Export',
    description:
      'Download cutting diagrams as a PDF to take to the workshop or send to a cut service.',
  },
  {
    icon: 'i-lucide-eye',
    title: '3D Model Viewer',
    description:
      'Interactive Three.js viewer for inspecting imported assemblies with orbit, zoom, and part selection.',
  },
  {
    icon: 'i-lucide-hard-drive',
    title: 'Offline & Private',
    description:
      'Runs entirely in your browser. No server, no accounts, no tracking. Your data never leaves your machine.',
  },
];

const materials = [
  'Plywood (metric)',
  'Plywood (imperial)',
  'MDF',
  'Hardwood',
  'Custom materials',
];

useHead({
  title: 'About — Cutlist Generator | Free Cutting Plan Optimizer',
  meta: [
    {
      name: 'description',
      content:
        'Cutlist Generator is a free browser-based tool for optimizing wood cutting plans. Import GLTF 3D models or enter parts manually, assign stock materials, and generate efficient board layouts with PDF export. No sign-up, no server — runs entirely in your browser.',
    },
    {
      name: 'keywords',
      content:
        'cutlist generator, cutting plan optimizer, wood cutting layout, panel optimization, sheet goods calculator, plywood cutting plan, board layout tool, CNC nesting, guillotine cut optimizer, woodworking software, free cutlist tool, GLTF import woodworking',
    },
    {
      property: 'og:title',
      content: 'Cutlist Generator — Free Cutting Plan Optimizer',
    },
    {
      property: 'og:description',
      content:
        'Turn your parts list into optimized cutting plans. Import 3D models or enter parts by hand, assign stock materials, and generate efficient board layouts. Free, private, browser-based.',
    },
    {
      property: 'og:type',
      content: 'website',
    },
  ],
});
</script>
