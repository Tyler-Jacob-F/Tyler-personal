import type { ReactNode } from 'react';
import type { Control, ControllerRenderProps, FieldPath, FieldValues } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

export interface FormRowProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
  TTransformed = TFieldValues,
> {
  // A form's control carries its context type; a row cares nothing about it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<TFieldValues, any, TTransformed>;
  name: TName;
  label: string;
  /** The hint under the control. */
  hint?: ReactNode;
  className?: string;
  /** The control, given the field. Wrapped in FormControl unless `bare`, for a group of inputs. */
  children: (field: ControllerRenderProps<TFieldValues, TName>) => ReactNode;
  bare?: boolean;
}

/**
 * The brief's form row (docs/DESIGN.md "Frontend conventions"): Label, control, hint,
 * error, on the shadcn Form. The stanza it replaces was written thirty-four times.
 */
export function FormRow<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
  TTransformed = TFieldValues,
>({
  control,
  name,
  label,
  hint,
  className,
  children,
  bare = false,
}: FormRowProps<TFieldValues, TName, TTransformed>) {
  return (
    <FormField<TFieldValues, TName, TTransformed>
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          {bare ? children(field) : <FormControl>{children(field)}</FormControl>}
          {hint && <FormDescription>{hint}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** The one-line "what changed" every version carries. */
export function SummaryField<TFieldValues extends FieldValues, TTransformed = TFieldValues>({
  control,
  name,
  placeholder = 'one line for the history',
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<TFieldValues, any, TTransformed>;
  name: FieldPath<TFieldValues>;
  placeholder?: string;
}) {
  return (
    <FormRow<TFieldValues, FieldPath<TFieldValues>, TTransformed>
      control={control}
      name={name}
      label="What changed"
      hint="One line for the history."
    >
      {(field) => <Input placeholder={placeholder} {...field} />}
    </FormRow>
  );
}

/** Save as the form's one accented control, with whatever quiet action sits opposite it. */
export function SaveBar({
  label = 'Save',
  pending = false,
  children,
}: {
  label?: string;
  pending?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Button type="submit" variant="accent" disabled={pending}>
        {label}
      </Button>
      {children}
    </div>
  );
}
