export default defineAppConfig({
  ui: {
    colors: {
      primary: 'teal',
      neutral: 'mist',
    },
    modal: {
      slots: {
        overlay: 'bg-black/60',
        content: 'bg-elevated ring ring-mist-700 sm:max-w-md w-full',
      },
    },
    popover: {
      slots: {
        content: 'bg-elevated ring-mist-700',
      },
    },
    formField: {
      slots: {
        label: 'text-mist-300 text-sm font-medium',
      },
    },
    input: {
      variants: {
        variant: {
          outline: 'bg-surface text-white ring-mist-700',
        },
      },
    },
    textarea: {
      variants: {
        variant: {
          outline: 'bg-surface text-white ring-mist-700',
        },
      },
    },
    select: {
      variants: {
        variant: {
          outline: 'bg-surface text-white ring-mist-700',
        },
      },
      slots: {
        content: 'bg-elevated ring-mist-700',
        item: 'text-mist-300 data-highlighted:not-data-disabled:text-white data-highlighted:not-data-disabled:before:bg-mist-700',
        trailingIcon: 'text-mist-400',
      },
    },
    selectMenu: {
      variants: {
        variant: {
          outline: 'bg-surface text-white ring-mist-700',
        },
      },
      slots: {
        content: 'bg-elevated ring-mist-700',
        item: 'text-mist-300 data-highlighted:not-data-disabled:text-white data-highlighted:not-data-disabled:before:bg-mist-700',
        trailingIcon: 'text-mist-400',
      },
    },
    button: {
      compoundVariants: [
        {
          color: 'neutral',
          variant: 'ghost',
          class: 'text-mist-300 hover:text-white hover:bg-mist-800',
        },
      ],
    },
    navigationMenu: {
      compoundVariants: [
        {
          color: 'neutral',
          variant: 'link',
          active: true,
          class: {
            link: 'text-white',
            linkLeadingIcon: 'text-white',
          },
        },
        {
          color: 'neutral',
          variant: 'link',
          active: false,
          class: {
            link: 'hover:text-muted hover:after:bg-mist-500',
            linkLeadingIcon: 'group-hover:text-dimmed',
          },
        },
      ],
    },
    table: {
      slots: {
        root: 'relative overflow-auto w-full',
        base: 'w-full table-fixed',
        tbody: 'divide-y divide-mist-800',
        td: 'p-4 text-sm text-mist-300 whitespace-nowrap',
        th: 'px-4 py-3.5 text-sm text-mist-500 text-left font-medium',
      },
    },
  },
});
