export default defineAppConfig({
  ui: {
    primary: 'teal',
    gray: 'mist',
    icons: {
      dynamic: true,
    },

    // ── Form controls ──
    input: {
      color: {
        white: {
          outline:
            'shadow-none bg-black text-white ring-1 ring-inset ring-white/20 focus:ring-2 focus:ring-teal-500 placeholder-white/30',
        },
        gray: {
          outline:
            'shadow-none bg-black text-white ring-1 ring-inset ring-white/20 focus:ring-2 focus:ring-teal-500 placeholder-white/30',
        },
      },
    },
    select: {
      color: {
        white: {
          outline:
            'shadow-none bg-black text-white ring-1 ring-inset ring-white/20 focus:ring-2 focus:ring-teal-500',
        },
        gray: {
          outline:
            'shadow-none bg-black text-white ring-1 ring-inset ring-white/20 focus:ring-2 focus:ring-teal-500',
        },
      },
      placeholder: 'text-white/30',
    },
    textarea: {
      color: {
        white: {
          outline:
            'shadow-none bg-black text-white ring-1 ring-inset ring-white/20 focus:ring-2 focus:ring-teal-500 placeholder-white/30',
        },
      },
    },
    checkbox: {
      background: 'bg-black',
      border: 'border border-white/30',
      label: 'text-sm font-medium text-white',
    },
    formGroup: {
      label: {
        base: 'block font-medium text-body',
      },
      help: 'mt-2 text-muted',
      description: 'text-muted',
    },

    // ── Table ──
    table: {
      divide: 'divide-y divide-white/10',
      tbody: 'divide-y divide-white/5',
      th: {
        color: 'text-teal-400',
        font: 'font-semibold uppercase tracking-wider',
        size: 'text-xs',
        padding: 'px-4 py-3',
      },
      td: {
        color: 'text-white/80',
        size: 'text-sm',
        padding: 'px-4 py-3',
      },
      tr: {
        active: 'hover:bg-white/5 cursor-pointer',
      },
    },

    // ── Navigation ──
    horizontalNavigation: {
      before:
        'before:absolute before:inset-x-0 before:inset-y-2 before:inset-px before:rounded-md hover:before:bg-white/5',
      active: 'text-teal-400 after:bg-teal-500 after:rounded-full',
      inactive: 'text-muted hover:text-white',
      icon: {
        active: 'text-teal-400',
        inactive: 'text-dim group-hover:text-body',
      },
    },

    // ── Buttons ──
    button: {
      color: {
        gray: {
          solid:
            'shadow-none ring-1 ring-inset ring-white/20 text-white bg-black hover:bg-white/10 disabled:bg-black focus-visible:ring-2 focus-visible:ring-teal-500',
          ghost:
            'text-white/70 hover:text-white hover:bg-white/10 focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-teal-500',
          outline:
            'ring-1 ring-inset ring-white/20 text-white/70 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-teal-500',
        },
      },
    },

    // ── Skeleton / loading states ──
    skeleton: {
      background: 'bg-white/10',
    },
  },
});
