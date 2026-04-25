import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROJECT_TAB,
  PROJECT_TABS,
  isProjectTabId,
  projectPath,
  tabFromUrlSegment,
  urlSegmentForTab,
} from '../projectTabs';

describe('projectTabs registry', () => {
  describe('PROJECT_TABS', () => {
    it('Should expose every tab with the required metadata', () => {
      for (const tab of PROJECT_TABS) {
        expect(typeof tab.id).toBe('string');
        expect(typeof tab.label).toBe('string');
        expect(tab.label.length).toBeGreaterThan(0);
        expect(tab.icon.startsWith('i-')).toBe(true);
        expect(typeof tab.urlSegment).toBe('string');
      }
    });

    it('Should map exactly one tab to the empty URL segment (default)', () => {
      const defaults = PROJECT_TABS.filter((t) => t.urlSegment === '');
      expect(defaults).toHaveLength(1);
      expect(defaults[0].id).toBe(DEFAULT_PROJECT_TAB);
    });
  });

  describe('#isProjectTabId', () => {
    it('Should accept registered tab ids', () => {
      for (const tab of PROJECT_TABS) {
        expect(isProjectTabId(tab.id)).toBe(true);
      }
    });

    it('Should reject unknown values', () => {
      expect(isProjectTabId('unknown')).toBe(false);
      expect(isProjectTabId(undefined)).toBe(false);
      expect(isProjectTabId(null)).toBe(false);
      expect(isProjectTabId(42)).toBe(false);
    });
  });

  describe('#tabFromUrlSegment', () => {
    it('Should resolve registered segments to their tab ids', () => {
      expect(tabFromUrlSegment('layout')).toBe('layout');
      expect(tabFromUrlSegment('settings')).toBe('settings');
      expect(tabFromUrlSegment('boards')).toBe('boards');
    });

    it('Should fall back to the default tab for empty/unknown input', () => {
      expect(tabFromUrlSegment('')).toBe(DEFAULT_PROJECT_TAB);
      expect(tabFromUrlSegment(null)).toBe(DEFAULT_PROJECT_TAB);
      expect(tabFromUrlSegment(undefined)).toBe(DEFAULT_PROJECT_TAB);
      expect(tabFromUrlSegment('not-a-tab')).toBe(DEFAULT_PROJECT_TAB);
    });
  });

  describe('#urlSegmentForTab', () => {
    it('Should return an empty segment for the default tab', () => {
      expect(urlSegmentForTab(DEFAULT_PROJECT_TAB)).toBe('');
    });

    it('Should return the registered segment for non-default tabs', () => {
      expect(urlSegmentForTab('layout')).toBe('layout');
      expect(urlSegmentForTab('settings')).toBe('settings');
    });

    it('Should round-trip with tabFromUrlSegment', () => {
      for (const tab of PROJECT_TABS) {
        const segment = urlSegmentForTab(tab.id);
        expect(tabFromUrlSegment(segment)).toBe(tab.id);
      }
    });
  });

  describe('#projectPath', () => {
    it('Should return the home path when no project id is provided', () => {
      expect(projectPath(null, null)).toBe('/');
      expect(projectPath(null, 'settings')).toBe('/');
    });

    it('Should drop the tab segment when the active tab is the default', () => {
      expect(projectPath('abc', DEFAULT_PROJECT_TAB)).toBe('/abc');
    });

    it('Should append the tab segment for non-default tabs', () => {
      expect(projectPath('abc', 'layout')).toBe('/abc/layout');
      expect(projectPath('abc', 'settings')).toBe('/abc/settings');
    });

    it('Should treat null tab as default', () => {
      expect(projectPath('abc', null)).toBe('/abc');
    });
  });
});
