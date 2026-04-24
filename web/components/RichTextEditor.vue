<script lang="ts" setup>
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';

const props = defineProps<{
  modelValue: string;
  placeholder?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit.configure({
      // Only keep the basics — no headings, code blocks, etc.
      heading: false,
      codeBlock: false,
      blockquote: false,
      horizontalRule: false,
    }),
    Link.configure({
      openOnClick: false,
    }),
    Placeholder.configure({
      placeholder: props.placeholder ?? 'Description...',
    }),
  ],
  editorProps: {
    attributes: {
      class:
        'focus:outline-none min-h-[3rem] px-3 py-2 text-sm text-body leading-relaxed [&_a]:text-teal-400 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mt-0.5 [&_p+p]:mt-1.5',
    },
  },
  onUpdate({ editor }) {
    const html = editor.isEmpty ? '' : editor.getHTML();
    emit('update:modelValue', html);
  },
});

watch(
  () => props.modelValue,
  (val) => {
    if (!editor.value) return;
    const current = editor.value.isEmpty ? '' : editor.value.getHTML();
    if (val !== current) {
      editor.value.commands.setContent(val, { emitUpdate: false });
    }
  },
);

function addLink() {
  if (!editor.value) return;
  const prev = editor.value.getAttributes('link').href ?? '';
  const url = window.prompt('URL', prev);
  if (url === null) return;
  if (url === '') {
    editor.value.chain().focus().extendMarkRange('link').unsetLink().run();
  } else {
    editor.value
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: url })
      .run();
  }
}

onBeforeUnmount(() => {
  editor.value?.destroy();
});
</script>

<template>
  <div class="rounded-md border border-subtle bg-surface overflow-hidden">
    <!-- Toolbar -->
    <div
      class="flex items-center gap-0.5 px-2 py-1 border-b border-subtle bg-default"
    >
      <UButton
        size="xs"
        icon="i-lucide-bold"
        color="neutral"
        :variant="editor?.isActive('bold') ? 'soft' : 'ghost'"
        @click="editor?.chain().focus().toggleBold().run()"
      />
      <UButton
        size="xs"
        icon="i-lucide-italic"
        color="neutral"
        :variant="editor?.isActive('italic') ? 'soft' : 'ghost'"
        @click="editor?.chain().focus().toggleItalic().run()"
      />
      <UButton
        size="xs"
        icon="i-lucide-list"
        color="neutral"
        :variant="editor?.isActive('bulletList') ? 'soft' : 'ghost'"
        @click="editor?.chain().focus().toggleBulletList().run()"
      />
      <UButton
        size="xs"
        icon="i-lucide-list-ordered"
        color="neutral"
        :variant="editor?.isActive('orderedList') ? 'soft' : 'ghost'"
        @click="editor?.chain().focus().toggleOrderedList().run()"
      />
      <div class="w-px h-4 bg-subtle mx-0.5" />
      <UButton
        size="xs"
        icon="i-lucide-link"
        color="neutral"
        :variant="editor?.isActive('link') ? 'soft' : 'ghost'"
        @click="addLink"
      />
    </div>
    <EditorContent :editor="editor" />
  </div>
</template>

<style>
.tiptap p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
  color: var(--ui-text-dimmed);
}
</style>
