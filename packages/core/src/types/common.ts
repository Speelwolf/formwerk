export type AriaLabelProps = {
  id: string;
  for: string;
};

export type AriaDescriptionProps = {
  id: string;
};

export type AriaLabelableProps = {
  'aria-label'?: string;
  'aria-labelledby'?: string;
};

export type AriaDescribableProps = {
  'aria-describedby'?: string;
};

export type AriaValidatableProps = {
  'aria-invalid'?: boolean;
};

export type InputEvents = {
  onInput?: (event: Event) => void;
  onChange?: (event: Event) => void;
  onBlur?: (event: Event) => void;
  onBeforeInput?: (event: Event) => void;
  onInvalid?: (event: Event) => void;
  onKeydown?: (event: KeyboardEvent) => void;
};

export type InputBaseAttributes = {
  required?: boolean;
  readonly?: boolean;
  disabled?: boolean;
};

export interface TextInputBaseAttributes extends InputBaseAttributes {
  name?: string;
  value?: string;
  maxlength?: number;
  minlength?: number;
  pattern?: string;
  placeholder?: string;
}
