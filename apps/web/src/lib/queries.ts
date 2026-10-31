/** What a screen asks of its TanStack queries before it renders. */
export interface QueryLike {
  isError: boolean;
  isPending: boolean;
  error: Error | null;
}

/** True while any query is still on its first fetch. */
export const anyPending = (queries: QueryLike[]) => queries.some((q) => q.isPending);
export const anyError = (queries: QueryLike[]) => queries.some((q) => q.isError);
