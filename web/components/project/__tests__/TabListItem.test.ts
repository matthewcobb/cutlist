// @vitest-environment nuxt
import { shallowMount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import TabListItem from '../TabListItem.vue';

const ULinkStub = {
  template: '<a v-bind="$attrs"><slot /></a>',
};

describe('TabListItem', () => {
  function getComponent(
    props: Partial<InstanceType<typeof TabListItem>['$props']> = {},
  ) {
    return shallowMount(TabListItem, {
      props: {
        name: 'Project Alpha',
        ...props,
      },
      slots: {
        default: '<span data-testid="icon">Icon</span>',
      },
      global: {
        stubs: {
          UIcon: true,
          ULink: ULinkStub,
        },
      },
    });
  }

  describe('Rendering', () => {
    it('Should mark the tab as selected when active', () => {
      const component = getComponent({ active: true });
      const tab = component.get('[role="tab"]');

      expect(tab.attributes('aria-selected')).toBe('true');
      expect(tab.attributes('data-tab-active')).toBe('true');
      expect(component.text()).toContain('Project Alpha');
    });

    it('Should hide the close action when requested', () => {
      const component = getComponent({ hideClose: true });

      expect(component.find('button[title="Close"]').exists()).toBe(false);
    });
  });

  describe('On close click', () => {
    it('Should emit close', async () => {
      const component = getComponent();

      await component.get('button[title="Close"]').trigger('click');

      expect(component.emitted('close')).toHaveLength(1);
    });
  });

  describe('On rename', () => {
    it('Should emit the typed name on enter and blur', async () => {
      const component = getComponent({ editing: true });
      const input = component.get('input[aria-label="Rename project"]');

      await input.setValue('Renamed Project');
      await input.trigger('keydown.enter');
      await input.setValue('Blurred Project');
      await input.trigger('blur');

      expect(component.emitted('rename')).toEqual([
        ['Renamed Project'],
        ['Blurred Project'],
      ]);
    });

    it('Should restore the original name on escape', async () => {
      const component = getComponent({ editing: true, name: 'Original Name' });
      const input = component.get('input[aria-label="Rename project"]');

      await input.setValue('Draft Name');
      await input.trigger('keydown.escape');

      expect(component.emitted('rename')).toEqual([['Original Name']]);
    });
  });
});
