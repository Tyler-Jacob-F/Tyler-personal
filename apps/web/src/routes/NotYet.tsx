/** A place the nav names before its phase builds it (docs/phases/03-face.md "Out of scope"). */
export function NotYet({ place, phase }: { place: string; phase: string }) {
  return (
    <div className="grid gap-2">
      <h1 className="page-title">{place}</h1>
      <p className="reading text-muted italic">Not yet. {phase}.</p>
    </div>
  );
}
