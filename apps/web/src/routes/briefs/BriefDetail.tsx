import { useParams } from 'react-router';
import { useDocument } from '@/api/documents';
import { Alert } from '@/components/Alert';
import { briefOf } from '@/routes/briefs/brief';
import { Morning } from '@/routes/home/Morning';

/** A past brief, laid out as the morning it was. */
export function BriefDetail() {
  const { id = '' } = useParams();
  const document = useDocument(id);
  if (document.isPending) return <p className="text-sm text-muted">Loading…</p>;
  if (document.isError) return <Alert tone="danger">{document.error.message}</Alert>;
  const brief = briefOf(document.data.version.frontmatter);
  if (!brief) return <Alert tone="danger">This document is not a brief.</Alert>;
  return <Morning date={brief.date} brief={brief} version={document.data.version} />;
}
