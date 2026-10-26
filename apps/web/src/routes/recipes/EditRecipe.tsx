import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useCreateVersion, useDocument } from '@/api/documents';
import { Alert } from '@/components/Alert';
import { RecipeForm } from '@/routes/recipes/RecipeForm';
import { titleOf } from '@/routes/recipes/format';
import { fromVersion, toFrontmatter } from '@/routes/recipes/recipe-form';

/** Editing never overwrites: the form's values become the next version. */
export function EditRecipe() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const recipe = useDocument(id);
  const save = useCreateVersion(id);
  const [error, setError] = useState<string | null>(null);

  if (recipe.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (recipe.isError) return <Alert tone="danger">{recipe.error.message}</Alert>;

  const { version } = recipe.data;

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Editing v{version.number}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {titleOf(version.frontmatter)}
        </h1>
      </div>
      <RecipeForm
        defaultValues={fromVersion(version.frontmatter, version.body)}
        submitLabel={`Save as v${version.number + 1}`}
        withSummary
        error={error}
        onSubmit={async (values) => {
          setError(null);
          try {
            await save.mutateAsync({
              frontmatter: toFrontmatter(values),
              body: values.body,
              summary: values.summary,
            });
            navigate(`/recipes/${id}`);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not save.');
          }
        }}
      />
    </div>
  );
}
