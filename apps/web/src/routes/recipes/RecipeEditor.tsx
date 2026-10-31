import { useNavigate, useParams } from 'react-router';
import { useDocumentEditor } from '@/api/editor';
import { useSetTags } from '@/api/documents';
import { Loading, QueryError } from '@/components/QueryState';
import { titleOf } from '@/lib/frontmatter';
import { RecipeForm } from '@/routes/recipes/RecipeForm';
import {
  emptyRecipe,
  fromVersion,
  sameTags,
  toFrontmatter,
  toTags,
} from '@/routes/recipes/recipe-form';

/**
 * New at `/recipes/new`, edit at `/recipes/:id/edit`: one screen, since editing never
 * overwrites and the form's values become the next version either way.
 */
export function RecipeEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editor = useDocumentEditor('recipe', id);
  const setTags = useSetTags(id ?? '');
  if (editor.existing.isError) return <QueryError queries={[editor.existing]} />;
  if (id && editor.existing.isPending) return <Loading />;
  const existing = editor.existing.data;
  const version = existing?.version;
  const error = editor.error ?? setTags.error;

  return (
    <div className="grid gap-6">
      {version ? (
        <div>
          <p className="eyebrow">Editing v{version.number}</p>
          <h1 className="mt-1 page-title">{titleOf(version.frontmatter)}</h1>
        </div>
      ) : (
        <h1 className="page-title">New recipe</h1>
      )}
      <RecipeForm
        defaultValues={
          existing
            ? fromVersion(
                existing.version.frontmatter,
                existing.version.body,
                existing.document.tags,
              )
            : emptyRecipe
        }
        submitLabel={version ? `Save as v${version.number + 1}` : 'Save recipe'}
        withSummary={Boolean(version)}
        error={error?.message ?? null}
        onSubmit={async (values) => {
          const saved = await editor.save({
            frontmatter: toFrontmatter(values),
            body: values.body,
            summary: values.summary,
            tags: toTags(values),
            authoredAt: values.authoredAt,
          });
          // Tags are the document's, not the version's: a separate write on edit, only if changed.
          if (existing) {
            const tags = toTags(values, existing.document.tags);
            if (!sameTags(tags, existing.document.tags)) await setTags.mutateAsync(tags);
          }
          navigate(`/recipes/${saved}`);
        }}
      />
    </div>
  );
}
