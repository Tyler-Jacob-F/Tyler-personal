import { useParams } from 'react-router';
import { useDocument } from '@/api/documents';
import { Alert } from '@/components/Alert';
import { Loading, QueryError } from '@/components/QueryState';
import { briefOf } from '@/routes/briefs/brief';
import { Morning } from '@/routes/home/Morning';

/** A past brief, laid out as the morning it was. */
export function BriefDetail() {
  const { id = '' } = useParams();
  const document = useDocument(id);
  if (document.isError) return <QueryError queries={[document]} />;
  if (document.isPending) return <Loading />;
  const brief = briefOf(document.data.version.frontmatter);
  if (!brief) return <Alert tone="danger">This document is not a brief.</Alert>;
  return <Morning date={brief.date} brief={brief} version={document.data.version} />;
}
