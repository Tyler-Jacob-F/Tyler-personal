-- 0006_search: full text over title, tags and body (docs/phases/03-face.md "Search").
--
-- The vector sits on `document`, not `version`, because the inputs straddle the two: the
-- title and body are the current version's, the tags are the document's, and `version`
-- rows are append-only (0001's trigger refuses an update), so a tag change could not
-- refresh a vector stored there. One trigger keeps it current: it fires on insert and
-- whenever the current version moves or the tags change, which are the only two writes a
-- document ever gets. A GIN index serves the query; the "budget" bullet of the directive
-- allows exactly a column and an index.
alter table document add column search tsvector;

create function document_search_refresh() returns trigger language plpgsql as $$
declare
  v version%rowtype;
  tag_words text;
  ingredient_words text;
begin
  select * into v from version where id = new.current_version_id;

  -- "course:soup-stew" searches as "course soup stew".
  select string_agg(replace(replace(t, ':', ' '), '-', ' '), ' ')
    into tag_words
    from jsonb_array_elements_text(new.tags) as t;

  -- Recipe ingredient lines, grouped or flat; other types have none.
  select string_agg(line, ' ')
    into ingredient_words
    from jsonb_array_elements(coalesce(v.frontmatter->'ingredients', '[]'::jsonb)) as g,
         lateral (
           select case
             when jsonb_typeof(g) = 'string' then jsonb_build_array(g)
             when jsonb_typeof(g->'items') = 'array' then g->'items'
             else '[]'::jsonb
           end as items
         ) as gi,
         jsonb_array_elements_text(gi.items) as line;

  new.search :=
    setweight(to_tsvector('english', coalesce(v.frontmatter->>'title', '')), 'A') ||
    setweight(to_tsvector('english', coalesce(tag_words, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(v.frontmatter->>'provenance', '')), 'C') ||
    setweight(to_tsvector('english', coalesce(ingredient_words, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(v.body, '')), 'D');
  return new;
end;
$$;

create trigger document_search_refresh
  before insert or update of current_version_id, tags on document
  for each row execute function document_search_refresh();

create index document_search_idx on document using gin (search);

-- Backfill every existing row through the trigger (an UPDATE OF fires when the column is
-- named, whether or not its value changes).
update document set tags = tags;
