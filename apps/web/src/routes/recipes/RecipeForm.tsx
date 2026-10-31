import { zodResolver } from '@hookform/resolvers/zod';
import {
  facetLabels,
  recipeFacetNames,
  recipeFacets,
  recipeFlags,
  valueLabel,
} from '@the-keep/shared';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { FormRow, SummaryField } from '@/components/ui/form-row';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { focusRing } from '@/components/ui/styles';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  type RecipeFormInput,
  type RecipeFormOutput,
  recipeFormSchema,
} from '@/routes/recipes/recipe-form';

export interface RecipeFormProps {
  defaultValues: RecipeFormInput;
  /** "Save recipe" for a new document; "Save version" for an edit. */
  submitLabel: string;
  /** Shown on edit: the one-line "what changed". */
  withSummary?: boolean;
  error?: string | null;
  onSubmit(values: RecipeFormOutput): Promise<void>;
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <fieldset className="grid gap-4">
    <legend className="eyebrow mb-3">{title}</legend>
    {children}
  </fieldset>
);

const glance = [
  ['activeMinutes', 'Active minutes', 'Hands-on time.'],
  ['totalMinutes', 'Total minutes', 'Start to table.'],
  ['serves', 'Serves', undefined],
] as const;

export function RecipeForm({
  defaultValues,
  submitLabel,
  withSummary = false,
  error,
  onSubmit,
}: RecipeFormProps) {
  const form = useForm<RecipeFormInput, unknown, RecipeFormOutput>({
    resolver: zodResolver(recipeFormSchema),
    defaultValues,
  });
  const { control } = form;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-8" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}

        <FormRow control={control} name="title" label="Title">
          {(field) => <Input autoFocus className="font-serif text-xl" {...field} />}
        </FormRow>

        <Section title="At a glance">
          <div className="grid gap-4 sm:grid-cols-3">
            {glance.map(([name, label, hint]) => (
              <FormRow key={name} control={control} name={name} label={label} hint={hint}>
                {(field) => (
                  <Input
                    inputMode="numeric"
                    placeholder="optional"
                    className="tabular-nums"
                    {...field}
                  />
                )}
              </FormRow>
            ))}
          </div>
          <FormRow
            control={control}
            name="provenance"
            label="Provenance"
            hint="One line on where it came from."
          >
            {(field) => <Input placeholder="Steve’s card, 2014" {...field} />}
          </FormRow>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow
              control={control}
              name="provenCount"
              label="Times cooked"
              hint="A version is proven once this one has actually been cooked."
            >
              {(field) => (
                <Input
                  inputMode="numeric"
                  placeholder="blank means untested"
                  className="tabular-nums"
                  {...field}
                />
              )}
            </FormRow>
            <FormRow control={control} name="provenLast" label="Last cooked">
              {(field) => <Input type="date" {...field} />}
            </FormRow>
          </div>
        </Section>

        <Section title="Facets">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recipeFacetNames.map((facet) => (
              <FormRow
                key={facet}
                control={control}
                name={`facets.${facet}`}
                label={facetLabels[facet]}
              >
                {(field) => (
                  <Select {...field}>
                    <option value="">—</option>
                    {recipeFacets[facet].map((value) => (
                      <option key={value} value={value}>
                        {valueLabel(value)}
                      </option>
                    ))}
                  </Select>
                )}
              </FormRow>
            ))}
          </div>
          <FormRow
            control={control}
            name="flags"
            label="Flags"
            bare
            hint="Facets and flags belong to the recipe, not to a version: changing them here does not add a version."
          >
            {(field) => (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Flags">
                {recipeFlags.map((flag) => {
                  const checked = field.value.includes(flag);
                  return (
                    <label
                      key={flag}
                      className={cn(
                        'inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm select-none',
                        'has-focus-visible:ring-2 has-focus-visible:ring-border-strong',
                        checked ? 'border-text-strong text-text-strong' : 'border-border text-text',
                      )}
                    >
                      <input
                        type="checkbox"
                        className={cn('size-4 accent-accent', focusRing)}
                        name={field.name}
                        value={flag}
                        checked={checked}
                        onBlur={field.onBlur}
                        onChange={(e) =>
                          field.onChange(
                            e.target.checked
                              ? recipeFlags.filter((f) => f === flag || field.value.includes(f))
                              : field.value.filter((f) => f !== flag),
                          )
                        }
                      />
                      {valueLabel(flag)}
                    </label>
                  );
                })}
              </div>
            )}
          </FormRow>
        </Section>

        <FormRow
          control={control}
          name="ingredientsText"
          label="Ingredients"
          hint="One per line, with the amount. A line ending in a colon starts a group."
        >
          {(field) => (
            <Textarea
              rows={10}
              placeholder={'Meats:\n2 lb ground chuck\nAromatics:\n1 onion, diced'}
              {...field}
            />
          )}
        </FormRow>

        <FormRow
          control={control}
          name="body"
          label="Method"
          hint="Markdown. A paragraph before the first heading is the headnote. Every save is a new version; nothing is overwritten."
        >
          {(field) => <Textarea rows={14} className="font-mono text-sm" {...field} />}
        </FormRow>

        {withSummary && (
          <SummaryField control={control} name="summary" placeholder="added smoked paprika" />
        )}

        <FormRow
          control={control}
          name="authoredAt"
          label="Written on"
          className="sm:max-w-xs"
          hint="Only if this version was written earlier than today, as when importing an old file."
        >
          {(field) => <Input type="date" {...field} />}
        </FormRow>

        <div>
          <Button type="submit" variant="accent" disabled={form.formState.isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
