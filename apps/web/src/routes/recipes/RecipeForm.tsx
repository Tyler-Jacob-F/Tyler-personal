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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-8" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input autoFocus className="font-serif text-xl" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Section title="At a glance">
          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ['activeMinutes', 'Active minutes', 'Hands-on time.'],
                ['totalMinutes', 'Total minutes', 'Start to table.'],
                ['serves', 'Serves', ''],
              ] as const
            ).map(([name, label, hint]) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        placeholder="optional"
                        className="tabular-nums"
                        {...field}
                      />
                    </FormControl>
                    {hint && <FormDescription>{hint}</FormDescription>}
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
          <FormField
            control={form.control}
            name="provenance"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Provenance</FormLabel>
                <FormControl>
                  <Input placeholder="Steve’s card, 2014" {...field} />
                </FormControl>
                <FormDescription>One line on where it came from.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="provenCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Times cooked</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      placeholder="blank means untested"
                      className="tabular-nums"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A version is proven once this one has actually been cooked.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="provenLast"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last cooked</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Section>

        <Section title="Facets">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recipeFacetNames.map((facet) => (
              <FormField
                key={facet}
                control={form.control}
                name={`facets.${facet}`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{facetLabels[facet]}</FormLabel>
                    <FormControl>
                      <Select {...field}>
                        <option value="">—</option>
                        {recipeFacets[facet].map((value) => (
                          <option key={value} value={value}>
                            {valueLabel(value)}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
          <FormField
            control={form.control}
            name="flags"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Flags</FormLabel>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Flags">
                  {recipeFlags.map((flag) => {
                    const checked = field.value.includes(flag);
                    return (
                      <label
                        key={flag}
                        className={cn(
                          'inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm select-none',
                          'has-focus-visible:ring-2 has-focus-visible:ring-border-strong',
                          checked
                            ? 'border-text-strong text-text-strong'
                            : 'border-border text-text',
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
                <FormDescription>
                  Facets and flags belong to the recipe, not to a version: changing them here does
                  not add a version.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        <FormField
          control={form.control}
          name="ingredientsText"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ingredients</FormLabel>
              <FormControl>
                <Textarea
                  rows={10}
                  placeholder={'Meats:\n2 lb ground chuck\nAromatics:\n1 onion, diced'}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                One per line, with the amount. A line ending in a colon starts a group.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Method</FormLabel>
              <FormControl>
                <Textarea rows={14} className="font-mono text-sm" {...field} />
              </FormControl>
              <FormDescription>
                Markdown. A paragraph before the first heading is the headnote. Every save is a new
                version; nothing is overwritten.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {withSummary && (
          <FormField
            control={form.control}
            name="summary"
            render={({ field }) => (
              <FormItem>
                <FormLabel>What changed</FormLabel>
                <FormControl>
                  <Input placeholder="added smoked paprika" {...field} />
                </FormControl>
                <FormDescription>One line for the history.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="authoredAt"
          render={({ field }) => (
            <FormItem className="sm:max-w-xs">
              <FormLabel>Written on</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormDescription>
                Only if this version was written earlier than today, as when importing an old file.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <Button type="submit" variant="accent" disabled={form.formState.isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
