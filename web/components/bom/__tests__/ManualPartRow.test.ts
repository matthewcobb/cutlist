// @vitest-environment nuxt
import { shallowMount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { describe, expect, it } from 'vitest';

import ManualPartRow from '../ManualPartRow.vue';

const UButtonStub = {
  template: '<button type="button" v-bind="$attrs"><slot /></button>',
};

const UInputStub = defineComponent({
  props: {
    modelValue: {
      type: [String, Number],
      default: '',
    },
    modelModifiers: {
      type: Object,
      default: () => ({}),
    },
  },
  emits: ['update:modelValue', 'keydown'],
  setup(props, { attrs, emit }) {
    return () =>
      h('input', {
        ...attrs,
        value: props.modelValue ?? '',
        onInput: (event: Event) => {
          const raw = (event.target as HTMLInputElement).value;
          const value = props.modelModifiers.number ? Number(raw) : raw;
          emit('update:modelValue', value);
        },
        onKeydown: (event: KeyboardEvent) => emit('keydown', event),
      });
  },
});

describe('ManualPartRow', () => {
  function getComponent(
    props: Partial<InstanceType<typeof ManualPartRow>['$props']> = {},
  ) {
    return shallowMount(ManualPartRow, {
      props: {
        materials: ['Plywood', 'MDF'],
        ...props,
      },
      global: {
        stubs: {
          UButton: UButtonStub,
          UIcon: true,
          UInput: UInputStub,
        },
      },
    });
  }

  async function fillValidPart(component: ReturnType<typeof getComponent>) {
    await component.get('input[placeholder="Part name"]').setValue(' Shelf ');
    await component.get('#manual-part-width').setValue('100');
    await component.get('#manual-part-length').setValue('250');
    await component.get('#manual-part-thickness').setValue('18');
    await component.get('#manual-part-qty').setValue('2');
    await component.get('select[aria-label="Material"]').setValue('MDF');
  }

  function getButton(component: ReturnType<typeof getComponent>, text: string) {
    const button = component
      .findAll('button')
      .find((candidate) => candidate.text() === text);
    if (!button) throw new Error(`Missing button: ${text}`);
    return button;
  }

  describe('Rendering', () => {
    it('Should label add and edit modes', () => {
      expect(getComponent().get('[role="form"]').attributes('aria-label')).toBe(
        'Add part',
      );

      expect(
        getComponent({
          initial: {
            partNumber: 1,
            name: 'Shelf',
            widthMm: 100,
            lengthMm: 250,
            thicknessMm: 18,
            qty: 2,
            material: 'Plywood',
          },
        })
          .get('[role="form"]')
          .attributes('aria-label'),
      ).toBe('Edit part');
    });
  });

  describe('On save', () => {
    it('Should not emit save while required fields are invalid', async () => {
      const component = getComponent();

      await getButton(component, 'Add').trigger('click');

      expect(getButton(component, 'Add').attributes('disabled')).toBeDefined();
      expect(component.emitted('save')).toBeUndefined();
    });

    it('Should emit trimmed part data and reset add-mode fields', async () => {
      const component = getComponent();

      await fillValidPart(component);
      await getButton(component, 'Free').trigger('click');
      await getButton(component, 'Add').trigger('click');

      expect(component.emitted('save')).toEqual([
        [
          {
            name: 'Shelf',
            widthMm: 100,
            lengthMm: 250,
            thicknessMm: 18,
            qty: 2,
            material: 'MDF',
            grainLock: 'length',
          },
        ],
      ]);
      expect(
        (
          component.get('input[placeholder="Part name"]')
            .element as HTMLInputElement
        ).value,
      ).toBe('');
      expect(
        (component.get('#manual-part-qty').element as HTMLInputElement).value,
      ).toBe('1');
    });
  });

  describe('On cancel', () => {
    it('Should emit cancel on escape or cancel click', async () => {
      const component = getComponent({
        initial: {
          partNumber: 1,
          name: 'Shelf',
          widthMm: 100,
          lengthMm: 250,
          thicknessMm: 18,
          qty: 2,
          material: 'Plywood',
        },
      });

      await component
        .get('input[placeholder="Part name"]')
        .trigger('keydown', { key: 'Escape' });
      await getButton(component, 'Cancel').trigger('click');

      expect(component.emitted('cancel')).toHaveLength(2);
    });
  });
});
