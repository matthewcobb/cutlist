// @vitest-environment nuxt
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { shallowMount } from '@vue/test-utils';
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { PROJECT_TABS } from '~/utils/projectTabs';
import ProjectWorkspaceNav from '../ProjectWorkspaceNav.vue';

const tabRef = ref<string>('bom');
const isComputing = ref(false);

mockNuxtImport('useProjectTab', () => () => tabRef);
mockNuxtImport('useBoardLayoutsQuery', () => () => ({ isComputing }));

interface NavItem {
  label: string;
  icon: string;
  active: boolean;
  onSelect: () => void;
}

const UNavigationMenuStub = {
  props: {
    items: {
      type: Array,
      default: () => [],
    },
  },
  template: `
    <ul role="tablist">
      <li
        v-for="(item, index) in items"
        :key="index"
        role="tab"
        :aria-selected="item.active"
        :data-icon="item.icon"
      >
        <button type="button" @click="item.onSelect()">{{ item.label }}</button>
      </li>
    </ul>
  `,
};

describe('ProjectWorkspaceNav', () => {
  function getComponent() {
    tabRef.value = 'bom';
    isComputing.value = false;
    return shallowMount(ProjectWorkspaceNav, {
      global: {
        stubs: {
          UNavigationMenu: UNavigationMenuStub,
          UIcon: true,
          ExportPdfButton: true,
          Transition: false,
        },
      },
    });
  }

  describe('Rendering', () => {
    it('Should render every registry tab in order', () => {
      const component = getComponent();
      const items = component.findAll('[role="tab"]');

      expect(items).toHaveLength(PROJECT_TABS.length);
      for (let i = 0; i < PROJECT_TABS.length; i += 1) {
        expect(items[i].text()).toBe(PROJECT_TABS[i].label);
        expect(items[i].attributes('data-icon')).toBe(PROJECT_TABS[i].icon);
      }
    });

    it('Should mark the active tab according to useProjectTab', async () => {
      const component = getComponent();

      tabRef.value = 'settings';
      await component.vm.$nextTick();

      const tabs = component.findAll('[role="tab"]');
      const settingsIndex = PROJECT_TABS.findIndex((t) => t.id === 'settings');
      const bomIndex = PROJECT_TABS.findIndex((t) => t.id === 'bom');

      expect(tabs[settingsIndex].attributes('aria-selected')).toBe('true');
      expect(tabs[bomIndex].attributes('aria-selected')).toBe('false');
    });
  });

  describe('On tab click', () => {
    it('Should update the active tab via useProjectTab', async () => {
      const component = getComponent();
      const tabs = component.findAll('[role="tab"]');
      const layoutIndex = PROJECT_TABS.findIndex((t) => t.id === 'layout');

      await tabs[layoutIndex].get('button').trigger('click');

      expect(tabRef.value).toBe('layout');
    });
  });
});
