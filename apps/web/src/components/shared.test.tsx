import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ConfirmButton, ConfirmDialog } from '@/components/ConfirmDialog';
import { Loading, QueryError } from '@/components/QueryState';
import { Form } from '@/components/ui/form';
import { FormRow, SaveBar, SummaryField } from '@/components/ui/form-row';
import { Input } from '@/components/ui/input';
import { render, screen, userEvent, within } from '@/test/render';

describe('QueryError and Loading', () => {
  it('shows the first failure as the one alert, and nothing when none failed', () => {
    const ok = { isError: false, isPending: false, error: null };
    const { rerender } = render(
      <QueryError queries={[ok, { ...ok, isError: true, error: new Error('the API is away') }]} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('the API is away');
    rerender(<QueryError queries={[ok]} />);
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<Loading />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  it('asks once, in a dialog, and the quiet button answers through it', async () => {
    const user = userEvent.setup();
    const confirmed = vi.fn();
    render(
      <ConfirmButton
        label="Delete"
        title="Delete this recipe?"
        confirmLabel="Yes, delete"
        onConfirm={confirmed}
      >
        Its versions stay.
      </ConfirmButton>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete this recipe?' });
    expect(dialog).toHaveTextContent('Its versions stay.');
    await user.click(within(dialog).getByRole('button', { name: 'Back' }));
    expect(confirmed).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Yes, delete' }),
    );
    expect(confirmed).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('accents the answer when it is not a loss', () => {
    render(
      <ConfirmDialog
        title="You are Taylor?"
        confirmLabel="Yes, it is me"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Yes, it is me' })).toHaveClass('bg-accent');
  });
});

const schema = z.object({ title: z.string().min(1, 'A title.'), summary: z.string() });

function Demo({ onSubmit }: { onSubmit(values: z.infer<typeof schema>): void }) {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { title: '', summary: '' },
  });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormRow control={form.control} name="title" label="Title" hint="What it is called.">
          {(field) => <Input {...field} />}
        </FormRow>
        <SummaryField control={form.control} name="summary" />
        <SaveBar label="Save it">
          <span>quiet</span>
        </SaveBar>
      </form>
    </Form>
  );
}

describe('FormRow', () => {
  it('is the brief’s row: label, control, hint, error', async () => {
    const user = userEvent.setup();
    const submitted = vi.fn();
    render(<Demo onSubmit={submitted} />);
    const title = screen.getByRole('textbox', { name: 'Title' });
    expect(screen.getByText('What it is called.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'What changed' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save it' }));
    expect(await screen.findByText('A title.')).toBeInTheDocument();
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(submitted).not.toHaveBeenCalled();
    await user.type(title, 'Chili');
    await user.type(screen.getByRole('textbox', { name: 'What changed' }), 'first');
    await user.click(screen.getByRole('button', { name: 'Save it' }));
    expect(submitted).toHaveBeenCalledWith({ title: 'Chili', summary: 'first' }, expect.anything());
    expect(screen.getByText('quiet')).toBeInTheDocument();
  });
});
