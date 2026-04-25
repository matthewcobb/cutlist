// @vitest-environment nuxt
import { shallowMount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ScaleController from '../ScaleController.vue';

const UButtonStub = {
  template: '<button type="button" v-bind="$attrs"><slot /></button>',
};

describe('ScaleController', () => {
  function getComponent(
    props: Partial<InstanceType<typeof ScaleController>['$props']> = {},
  ) {
    return shallowMount(ScaleController, {
      props: {
        scale: 1,
        ...props,
      },
      global: {
        stubs: {
          UButton: UButtonStub,
        },
      },
    });
  }

  describe('Rendering', () => {
    it('Should render the current scale as a percentage', () => {
      const component = getComponent({ scale: 1.25 });

      expect(component.text()).toContain('125%');
      expect(
        component
          .find('button[title="125% - Click to reset to 100%"]')
          .exists(),
      ).toBe(true);
    });
  });

  describe('On button click', () => {
    it('Should emit zoom actions', async () => {
      const component = getComponent();
      const buttons = component.findAll('button');

      await buttons[0].trigger('click');
      await buttons[1].trigger('click');
      await buttons[2].trigger('click');

      expect(component.emitted('zoomOut')).toHaveLength(1);
      expect(component.emitted('resetZoom')).toHaveLength(1);
      expect(component.emitted('zoomIn')).toHaveLength(1);
    });
  });
});
