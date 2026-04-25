// @vitest-environment nuxt
import { shallowMount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import GrainLockConfirmModal from '../GrainLockConfirmModal.vue';

const UButtonStub = {
  template: '<button type="button" v-bind="$attrs"><slot /></button>',
};

const UModalStub = {
  props: {
    open: {
      type: Boolean,
      required: true,
    },
  },
  emits: ['update:open'],
  template: `
    <section :data-open="String(open)">
      <button
        type="button"
        aria-label="Dismiss modal"
        @click="$emit('update:open', false)"
      >
        Dismiss
      </button>
      <slot name="content" />
    </section>
  `,
};

describe('GrainLockConfirmModal', () => {
  function getComponent(
    props: Partial<InstanceType<typeof GrainLockConfirmModal>['$props']> = {},
  ) {
    return shallowMount(GrainLockConfirmModal, {
      props: {
        open: true,
        grainLock: 'length',
        ...props,
      },
      global: {
        stubs: {
          UButton: UButtonStub,
          UModal: UModalStub,
        },
      },
    });
  }

  describe('Rendering', () => {
    it('Should explain the selected grain lock', () => {
      const component = getComponent({ grainLock: 'width' });

      expect(component.text()).toContain("Part won't fit");
      expect(component.text()).toContain('Locking grain to');
      expect(component.text()).toContain('Width');
    });

    it('Should explain free rotation when no grain lock is selected', () => {
      const component = getComponent({ grainLock: undefined });

      expect(component.text()).toContain('Free rotation');
    });
  });

  describe('On user action', () => {
    it('Should emit confirm when locking anyway', async () => {
      const component = getComponent();
      const lockAnyway = component
        .findAll('button')
        .find((button) => button.text() === 'Lock anyway');

      await lockAnyway!.trigger('click');

      expect(component.emitted('confirm')).toHaveLength(1);
    });

    it('Should emit cancel when dismissed or cancelled', async () => {
      const component = getComponent();
      const cancel = component
        .findAll('button')
        .find((button) => button.text() === 'Cancel');

      await component
        .get('button[aria-label="Dismiss modal"]')
        .trigger('click');
      await cancel!.trigger('click');

      expect(component.emitted('cancel')).toHaveLength(2);
    });
  });
});
