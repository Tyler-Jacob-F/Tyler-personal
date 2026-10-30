import { useParams } from 'react-router';
import { useDocument } from '@/api/documents';
import { Alert } from '@/components/Alert';
import { BriefView } from '@/routes/briefs/BriefView';

export function BriefDetail() {
  const { id = '' } = useParams();
  const brief = useDocument(id);
  if (brief.isPending) return <p className="text-sm text-muted">Loading…</p>;
  if (brief.isError) return <Alert tone="danger">{brief.error.message}</Alert>;
  return <BriefView item={brief.data} kicker="Brief" />;
}
