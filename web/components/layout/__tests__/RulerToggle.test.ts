// @vitest-environment nuxt
import { shallowMount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import useRulerStore from '~/composables/useRulerStore';

import RulerToggle from '../RulerToggle.vue';

const UButtonStub = {
  template: '<button type="button" v-bind="$attrs"><slot /></button>',
};

describe('RulerToggle', () => {
  function getComponent() {
    return shallowMount(RulerToggle, {
      global: {
        stubs: {
          UButton: UButtonStub,
        },
      },
    });
  }

  beforeEach(() => {
    const store = useRulerStore();
    store.isRulerActive.value = false;
    store.pendingClick.value = null;
    store.measurements.value = [];
  });

  describe('Rendering', () => {
    it('Should render the inactive ruler action', () => {
      const component = getComponent();

      expect(component.find('button[title="Measure distance"]').exists()).toBe(
        true,
      );
      expect(component.text()).not.toContain('Pan locked');
    });

    it('Should render the locked-pan hint when the ruler is active', async () => {
      const store = useRulerStore();
      store.isRulerActive.value = true;

      const component = getComponent();
      await nextTick();

      expect(
        component.find('button[title="Disable ruler (Esc)"]').exists(),
      ).toBe(true);
      expect(component.text()).toContain('Pan locked');
      expect(component.text()).toContain('Esc');
    });
  });

  describe('On button click', () => {
    it('Should toggle the ruler store', async () => {
      const store = useRulerStore();
      const component = getComponent();

      await component.get('button').trigger('click');

      expect(store.isRulerActive.value).toBe(true);
    });
  });
});
