import { zodResolver } from '@hookform/resolvers/zod';
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
import { Textarea } from '@/components/ui/textarea';
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 md:grid-cols-3">
          {(
            [
              ['servings', 'Servings'],
              ['prepMinutes', 'Prep minutes'],
              ['cookMinutes', 'Cook minutes'],
            ] as const
          ).map(([name, label]) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{label}</FormLabel>
                  <FormControl>
                    <Input inputMode="numeric" placeholder="optional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>

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
                Markdown. Every save is a new version; nothing is overwritten.
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
            <FormItem className="md:max-w-xs">
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
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
