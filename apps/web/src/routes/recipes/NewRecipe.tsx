import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useCreateDocument } from '@/api/documents';
import { RecipeForm } from '@/routes/recipes/RecipeForm';
import { emptyRecipe, toFrontmatter, toTags } from '@/routes/recipes/recipe-form';

export function NewRecipe() {
  const navigate = useNavigate();
  const create = useCreateDocument();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid gap-6">
      <h1 className="page-title">New recipe</h1>
      <RecipeForm
        defaultValues={emptyRecipe}
        submitLabel="Save recipe"
        error={error}
        onSubmit={async (values) => {
          setError(null);
          try {
            const created = await create.mutateAsync({
              type: 'recipe',
              frontmatter: toFrontmatter(values),
              body: values.body,
              summary: values.summary,
              tags: toTags(values),
              authoredAt: values.authoredAt,
            });
            navigate(`/recipes/${created.document.id}`);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not save.');
          }
        }}
      />
    </div>
  );
}
