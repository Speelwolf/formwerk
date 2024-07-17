import { InjectionKey, toValue, computed, onBeforeUnmount, reactive, provide } from 'vue';
import { useFieldValue } from '../reactivity/useFieldValue';
import { useInputValidity } from '../validation/useInputValidity';
import { useLabel } from '../a11y/useLabel';
import { useSyncModel } from '../reactivity/useModelSync';
import {
  Orientation,
  AriaLabelableProps,
  AriaDescribableProps,
  AriaValidatableProps,
  Direction,
  Reactivify,
} from '../types';
import { uniqId, createDescribedByProps, getNextCycleArrIdx, normalizeProps, isEmpty } from '../utils/common';

export interface RadioGroupContext<TValue> {
  name: string;
  disabled: boolean;
  readonly: boolean;
  required: boolean;

  readonly modelValue: TValue | undefined;
  setValidity(message: string): void;
  setValue(value: TValue): void;

  useRadioRegistration(radio: RadioItemContext): { canReceiveFocus(): boolean };
}

export interface RadioItemContext {
  isChecked(): boolean;
  isDisabled(): boolean;
  setChecked(): boolean;
}

export const RadioGroupKey: InjectionKey<RadioGroupContext<any>> = Symbol('RadioGroupKey');

export interface RadioGroupProps<TValue = string> {
  orientation?: Orientation;
  dir?: 'ltr' | 'rtl';
  label: string;
  description?: string;

  name?: string;
  modelValue?: TValue;

  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
}

interface RadioGroupDomProps extends AriaLabelableProps, AriaDescribableProps, AriaValidatableProps {
  role: 'radiogroup';
  dir: Direction;
  onKeydown(e: KeyboardEvent): void;
}

function getOrientationArrows(dir: Direction | undefined) {
  const nextKeys = ['ArrowDown'];
  const prevKeys = ['ArrowUp'];

  if (dir === 'rtl') {
    nextKeys.push('ArrowLeft');
    prevKeys.push('ArrowRight');

    return { prev: prevKeys, next: nextKeys };
  }

  nextKeys.push('ArrowRight');
  prevKeys.push('ArrowLeft');

  return { prev: prevKeys, next: nextKeys };
}

export function useRadioGroup<TValue = string>(_props: Reactivify<RadioGroupProps<TValue>>) {
  const props = normalizeProps(_props);
  const groupId = uniqId();

  const radios: RadioItemContext[] = [];
  const { labelProps, labelledByProps } = useLabel({
    for: groupId,
    label: props.label,
  });

  const { fieldValue } = useFieldValue<TValue>(props.modelValue as TValue);
  useSyncModel({
    model: fieldValue,
    onModelPropUpdated: value => {
      fieldValue.value = value;
    },
  });

  const { setValidity, errorMessage } = useInputValidity();
  const { describedBy, descriptionProps, errorMessageProps } = createDescribedByProps({
    inputId: groupId,
    errorMessage,
    description: props.description,
  });

  function handleArrowNext() {
    const currentIdx = radios.findIndex(radio => radio.isChecked());
    if (currentIdx < 0) {
      radios[0]?.setChecked();
      return;
    }

    const availableCandidates = radios.filter(radio => !radio.isDisabled());
    const nextCandidate = availableCandidates[getNextCycleArrIdx(currentIdx + 1, availableCandidates)];
    nextCandidate?.setChecked();
  }

  function handleArrowPrevious() {
    const currentIdx = radios.findIndex(radio => radio.isChecked());
    if (currentIdx === -1) {
      radios[0]?.setChecked();
      return;
    }

    const availableCandidates = radios.filter(radio => !radio.isDisabled());
    const prevCandidate = availableCandidates[getNextCycleArrIdx(currentIdx - 1, availableCandidates)];
    prevCandidate?.setChecked();
  }

  const radioGroupProps = computed<RadioGroupDomProps>(() => {
    return {
      ...labelledByProps.value,
      dir: toValue(props.dir) ?? 'ltr',
      role: 'radiogroup',
      'aria-describedby': describedBy(),
      'aria-invalid': errorMessage.value ? true : undefined,
      onKeydown(e: KeyboardEvent) {
        const { next, prev } = getOrientationArrows(toValue(props.dir));

        if (next.includes(e.key)) {
          e.preventDefault();
          handleArrowNext();
          return;
        }

        if (prev.includes(e.key)) {
          e.preventDefault();
          handleArrowPrevious();
          return;
        }
      },
    };
  });

  function setValue(value: TValue) {
    fieldValue.value = value;
  }

  function registerRadio(radio: RadioItemContext) {
    radios.push(radio);
  }

  function unregisterRadio(radio: RadioItemContext) {
    const idx = radios.indexOf(radio);
    if (idx >= 0) {
      radios.splice(idx, 1);
    }
  }

  function useRadioRegistration(radio: RadioItemContext) {
    registerRadio(radio);

    onBeforeUnmount(() => {
      unregisterRadio(radio);
    });

    return {
      canReceiveFocus() {
        return radios[0] === radio && isEmpty(fieldValue.value);
      },
    };
  }

  const context: RadioGroupContext<any> = reactive({
    name: computed(() => toValue(props.name) ?? groupId),
    disabled: computed(() => toValue(props.disabled) ?? false),
    readonly: computed(() => toValue(props.readonly) ?? false),
    required: computed(() => toValue(props.required) ?? false),
    modelValue: fieldValue,
    setValidity,
    setValue,
    useRadioRegistration,
  });

  provide(RadioGroupKey, context);

  return {
    labelProps,
    descriptionProps,
    errorMessageProps,
    fieldValue,
    radioGroupProps,
    errorMessage,
  };
}
