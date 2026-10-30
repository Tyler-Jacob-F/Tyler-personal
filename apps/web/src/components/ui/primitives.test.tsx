import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { MemoryRouter, Link } from 'react-router';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('Button', () => {
  it('is outline by default, 44px tall, with a border-strong focus ring', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('data-variant', 'outline');
    expect(button.className).toContain('border-border-strong');
    expect(button.className).toContain('h-11');
    expect(button.className).toContain('focus-visible:ring-border-strong');
    expect(button.className).not.toContain('bg-accent');
  });

  it('has one filled variant, accent on on-accent, and a quiet ghost', () => {
    render(
      <>
        <Button variant="accent">Edit</Button>
        <Button variant="ghost">Cancel</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Edit' }).className).toContain('bg-accent');
    expect(screen.getByRole('button', { name: 'Edit' }).className).toContain('text-on-accent');
    expect(screen.getByRole('button', { name: 'Cancel' }).className).not.toMatch(
      /(^| )border( |$)/,
    );
  });

  it('renders icon-only as a square with the label the type requires', () => {
    render(
      <Button size="icon" aria-label="Search">
        <svg aria-hidden="true" />
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Search' });
    expect(button.className).toContain('size-11');
  });

  it('becomes the child when asked, keeping its classes', () => {
    render(
      <MemoryRouter>
        <Button asChild size="sm">
          <Link to="/recipes/new">New recipe</Link>
        </Button>
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'New recipe' });
    expect(link).toHaveAttribute('href', '/recipes/new');
    expect(link.className).toContain('h-11');
  });

  it('keeps every size at the 44px touch target', () => {
    render(
      <>
        <Button size="sm">a</Button>
        <Button size="icon" aria-label="b">
          b
        </Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'a' }).className).toMatch(/\bh-11\b/);
    expect(screen.getByRole('button', { name: 'b' }).className).toMatch(/\bsize-11\b/);
  });
});

describe('Input and Textarea', () => {
  it('draw a hairline at rest, border-strong when focused, wrong when invalid', () => {
    render(
      <>
        <Input aria-label="Title" />
        <Textarea aria-label="Method" aria-invalid />
      </>,
    );
    const input = screen.getByRole('textbox', { name: 'Title' });
    expect(input.className).toContain('border-border ');
    expect(input.className).toContain('focus-visible:border-border-strong');
    expect(input.className).toContain('h-11');
    const textarea = screen.getByRole('textbox', { name: 'Method' });
    expect(textarea.className).toContain('aria-invalid:border-wrong');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('Label', () => {
  it('labels its control through htmlFor', () => {
    render(
      <>
        <Label htmlFor="serves">Serves</Label>
        <Input id="serves" />
      </>,
    );
    expect(screen.getByLabelText('Serves')).toHaveAttribute('id', 'serves');
  });
});

describe('Chip', () => {
  it('is a quiet span unless it does something', () => {
    render(<Chip>course: main</Chip>);
    const chip = screen.getByText('course: main');
    expect(chip.tagName).toBe('SPAN');
    expect(chip.className).toContain('text-muted');
    expect(chip.className).toContain('rounded-sm');
  });

  it('inverts to text-strong on bg when selected, as a real button with a pressed state', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Chip selected onClick={onClick}>
        breakfast
      </Chip>,
    );
    const chip = screen.getByRole('button', { name: 'breakfast', pressed: true });
    expect(chip.className).toContain('bg-text-strong');
    expect(chip.className).toContain('text-bg');
    expect(chip.className).toContain('before:-inset-y-2.5');
    await user.click(chip);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('can be a link', () => {
    render(
      <MemoryRouter>
        <Chip asChild>
          <Link to="/recipes?tags=course:main">main</Link>
        </Chip>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'main' })).toHaveAttribute(
      'href',
      '/recipes?tags=course:main',
    );
  });
});

describe('Form', () => {
  const schema = z.object({ title: z.string().min(1, 'Title is required.') });
  function Demo() {
    const form = useForm({ resolver: zodResolver(schema), defaultValues: { title: '' } });
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(() => {})} noValidate>
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormDescription>What the recipe is called.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" variant="accent">
            Save
          </Button>
        </form>
      </Form>
    );
  }

  it('wires label, hint and error to the control, in wrong when invalid', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const input = screen.getByLabelText('Title');
    expect(input).toHaveAccessibleDescription('What the recipe is called.');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const message = await screen.findByText('Title is required.');
    expect(message.className).toContain('text-wrong');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Title').className).toContain('data-[error=true]:text-wrong');
  });
});
