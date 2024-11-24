import { computed, InjectionKey, MaybeRefOrGetter, onMounted, provide, reactive, readonly, Ref, ref } from 'vue';
import type { v1 } from '@standard-schema/spec';
import { cloneDeep, isEqual, useUniqId } from '../utils/common';
import {
  FormObject,
  MaybeAsync,
  MaybeGetter,
  TouchedSchema,
  DisabledSchema,
  ErrorsSchema,
  Path,
  ValidationResult,
  FormValidationResult,
  GroupValidationResult,
  GenericFormSchema,
  StandardSchema,
} from '../types';
import { createFormContext, BaseFormContext } from './formContext';
import { FormTransactionManager, useFormTransactions } from './useFormTransactions';
import { useFormActions } from './useFormActions';
import { useFormSnapshots } from './formSnapshot';
import { findLeaf } from '../utils/path';
import { getConfig } from '../config';
import { FieldTypePrefixes } from '../constants';
import { appendToFormData, clearFormData } from '../utils/formData';
import { PartialDeep } from 'type-fest';
import { createDisabledContext } from '../helpers/createDisabledContext';

export interface FormOptions<TSchema extends GenericFormSchema, TInput extends FormObject = v1.InferInput<TSchema>> {
  /**
   * The form's unique identifier.
   */
  id?: string;

  /**
   * The initial values for the form fields.
   */
  initialValues?: MaybeGetter<MaybeAsync<TInput>>;

  /**
   * The initial touched state for form fields.
   */
  initialTouched?: TouchedSchema<TInput>;

  /**
   * The validation schema for the form.
   */
  schema?: TSchema;

  /**
   * Whether HTML5 validation should be disabled for this form.
   */
  disableHtmlValidation?: boolean;

  /**
   * Whether the form is disabled.
   */
  disabled?: MaybeRefOrGetter<boolean | undefined>;
}

export interface FormContext<TInput extends FormObject = FormObject, TOutput extends FormObject = TInput>
  extends BaseFormContext<TInput>,
    FormTransactionManager<TInput> {
  requestValidation(): Promise<FormValidationResult<TOutput>>;
  onSubmitAttempt(cb: () => void): void;
  onValidationDone(cb: () => void): void;
  isHtmlValidationDisabled(): boolean;
  onValidationDispatch(
    cb: (enqueue: (promise: Promise<ValidationResult | GroupValidationResult>) => void) => void,
  ): void;
}

export interface FormDomProps {
  id: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FormKey: InjectionKey<FormContext<any>> = Symbol('Formwerk FormKey');

export function useForm<
  TSchema extends GenericFormSchema,
  TInput extends FormObject = v1.InferInput<TSchema>,
  TOutput extends FormObject = v1.InferOutput<TSchema>,
>(opts?: Partial<FormOptions<TSchema, TInput>>) {
  const touchedSnapshot = useFormSnapshots(opts?.initialTouched);
  const valuesSnapshot = useFormSnapshots<TInput, TOutput>(opts?.initialValues, {
    onAsyncInit,
    schema: opts?.schema as StandardSchema<TInput, TOutput>,
  });

  const id = opts?.id || useUniqId(FieldTypePrefixes.Form);
  const isDisabled = createDisabledContext(opts?.disabled);
  const isHtmlValidationDisabled = () => opts?.disableHtmlValidation ?? getConfig().disableHtmlValidation;
  const values = reactive(cloneDeep(valuesSnapshot.originals.value)) as PartialDeep<TInput>;
  const touched = reactive(cloneDeep(touchedSnapshot.originals.value)) as TouchedSchema<TInput>;
  const disabled = {} as DisabledSchema<TInput>;
  const errors = ref({}) as Ref<ErrorsSchema<TInput>>;

  const ctx = createFormContext<TInput, TOutput>({
    id,
    values: values as TInput,
    touched,
    disabled,
    schema: opts?.schema as StandardSchema<TInput, TOutput>,
    errors,
    snapshots: {
      values: valuesSnapshot,
      touched: touchedSnapshot,
    },
  });

  const isTouched = computed(() => {
    return !!findLeaf(touched, l => l === true);
  });

  const isDirty = computed(() => {
    return !isEqual(values, valuesSnapshot.originals.value);
  });

  const isValid = computed(() => {
    return !ctx.hasErrors();
  });

  function onAsyncInit(v: TInput) {
    ctx.setValues(v, { behavior: 'merge' });
  }

  const transactionsManager = useFormTransactions(ctx);
  const { actions, isSubmitting, ...privateActions } = useFormActions<TInput, TOutput>(ctx, {
    disabled,
    schema: opts?.schema as StandardSchema<TInput, TOutput>,
  });

  function getErrors() {
    return ctx.getErrors();
  }

  function getError<TPath extends Path<TInput>>(path: TPath): string | undefined {
    return ctx.getFieldErrors(path)[0];
  }

  function displayError(path: Path<TInput>) {
    return ctx.isFieldTouched(path) ? getError(path) : undefined;
  }

  provide(FormKey, {
    ...ctx,
    ...transactionsManager,
    ...privateActions,
    isHtmlValidationDisabled,
  } as FormContext<TInput, TOutput>);

  if (ctx.getValidationMode() === 'schema') {
    onMounted(privateActions.requestValidation);
  }

  function onFormdata(e: FormDataEvent) {
    const form = e.target as HTMLFormElement;
    clearFormData(e.formData);
    appendToFormData(form.__formOut || values, e.formData);
  }

  const onSubmit = actions.handleSubmit((output, { form }) => {
    if (form) {
      form.__formOut = output.toObject();
      form.submit();
    }
  });

  const formProps = {
    id,
    novalidate: true,
    onSubmit,
    onFormdata,
  };

  return {
    /**
     * The current values of the form.
     */
    values: readonly(values),
    context: ctx,
    /**
     * Whether the form is submitting.
     */
    isSubmitting,
    /**
     * Whether the form is touched.
     */
    isTouched,
    /**
     * Whether the form is dirty.
     */
    isDirty,
    /**
     * Whether the form is valid.
     */
    isValid,
    /**
     * Whether the form is disabled.
     */
    isDisabled,
    /**
     * Whether the specified field is dirty.
     */
    isFieldDirty: ctx.isFieldDirty,
    /**
     * Sets the value of a field.
     */
    setFieldValue: ctx.setFieldValue,
    /**
     * Gets the value of a field.
     */
    getFieldValue: ctx.getFieldValue,
    /**
     * Whether the specified field is touched.
     */
    isFieldTouched: ctx.isFieldTouched,
    /**
     * Sets the touched state of a field.
     */
    setFieldTouched: ctx.setFieldTouched,
    /**
     * Sets the errors for a field.
     */
    setFieldErrors: ctx.setFieldErrors,
    /**
     * Sets the values of the form.
     */
    setValues: ctx.setValues,
    /**
     * Gets the errors for a field.
     */
    getError,
    /**
     * Displays an error for a field.
     */
    displayError,
    /**
     * Gets all the errors for the form.
     */
    getErrors,
    /**
     * Props for the form element.
     */
    formProps,
    ...actions,
  };
}
