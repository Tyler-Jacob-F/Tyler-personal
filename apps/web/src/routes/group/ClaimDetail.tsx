import { zodResolver } from '@hookform/resolvers/zod';
import { allergens, allergenSchema, type SignupClaim, type SlotKind } from '@the-keep/shared';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useUpdateClaim } from '@/api/group';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Form } from '@/components/ui/form';
import { FormRow } from '@/components/ui/form-row';
import { Input } from '@/components/ui/input';
import { allergenLabel } from '@/group/format';

const detailForm = z.object({
  note: z.string().trim().max(80, 'Eighty characters at most.'),
  contains: z.array(allergenSchema),
  /** "None of these", said: different from leaving every chip alone. */
  none: z.boolean(),
});

/**
 * What a claim brings, said after the slot is taken: the one form for someone who has just
 * tapped "Take this", someone who took their slot before the sheet could ask, and a co-lead
 * writing down what a text said. Everything is optional; "not sure yet" is saving it empty.
 * A food slot also asks what the dish contains, from the group's own allergies: leaving
 * every chip alone is "not said", which the sheet shows as nothing rather than as safe.
 */
export function ClaimDetailForm({
  documentId,
  claim,
  kind,
  own,
  onDone,
}: {
  documentId: string;
  claim: SignupClaim;
  kind: SlotKind;
  /** The viewer's own claim, or one a co-lead is filling in for someone. */
  own: boolean;
  onDone(): void;
}) {
  const update = useUpdateClaim(documentId);
  const form = useForm({
    resolver: zodResolver(detailForm),
    defaultValues: {
      note: claim.note ?? '',
      contains: claim.contains ?? [],
      none: claim.contains?.length === 0,
    },
  });
  const food = kind === 'food';
  const contains = useWatch({ control: form.control, name: 'contains' });
  const none = useWatch({ control: form.control, name: 'none' });

  const onSubmit = form.handleSubmit(async (values) => {
    await update.mutateAsync({
      claimId: claim.id,
      note: values.note || null,
      ...(food
        ? { contains: values.none ? [] : values.contains.length ? values.contains : null }
        : {}),
    });
    onDone();
  });

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        noValidate
        aria-label={own ? 'What you’re bringing' : `What ${claim.memberName} is bringing`}
        className="mt-4 grid gap-4 border-t border-border pt-4 text-left"
      >
        {update.error && <Alert tone="danger">{update.error.message}</Alert>}
        <FormRow
          control={form.control}
          name="note"
          label={own ? 'What are you bringing?' : `What is ${claim.memberName} bringing?`}
          hint={own ? 'Not sure yet? Leave it and come back.' : undefined}
        >
          {(field) => <Input maxLength={80} autoComplete="off" {...field} />}
        </FormRow>
        {food && (
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium text-text-strong">
              Does it contain any of these?
            </legend>
            <div className="mt-2 flex flex-wrap gap-x-2 gap-y-4">
              {allergens.map((allergen) => (
                <Chip
                  key={allergen}
                  selected={contains.includes(allergen)}
                  onClick={() => {
                    form.setValue(
                      'contains',
                      contains.includes(allergen)
                        ? contains.filter((a) => a !== allergen)
                        : [...contains, allergen],
                    );
                    form.setValue('none', false);
                  }}
                >
                  {allergenLabel(allergen)}
                </Chip>
              ))}
              <Chip
                selected={none}
                onClick={() => {
                  form.setValue('none', !none);
                  form.setValue('contains', []);
                }}
              >
                None of these
              </Chip>
            </div>
            <p className="text-xs text-muted">
              Butter, flour and chicken stock count. Leave them all alone if you don’t know.
            </p>
          </fieldset>
        )}
        <div className="flex items-center gap-3">
          <Button type="submit" variant="accent" size="sm" disabled={update.isPending}>
            Save
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            {own && !claim.note && claim.contains === null ? 'Not now' : 'Cancel'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
