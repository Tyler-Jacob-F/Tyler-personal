import { App } from '@/App';
import { NODES, TRACES } from '@/routes/stack/data';
import { render, screen, userEvent, within } from '@/test/render';

describe('StackPage', () => {
  it('is reachable from the nav and opens on the overview', async () => {
    render(<App />, { route: '/' });
    expect(await screen.findByRole('link', { name: 'Stack' })).toHaveAttribute('href', '/stack');
    render(<App />, { route: '/stack' });
    expect(
      await screen.findByRole('heading', { name: 'The Keep, under the hood' }),
    ).toBeInTheDocument();
    expect(screen.getByText('How a solo site became five stacks')).toBeInTheDocument();
  });

  it('explains a piece of the system when its box is clicked', async () => {
    const user = userEvent.setup();
    render(<App />, { route: '/stack' });
    await user.click(await screen.findByRole('button', { name: 'RDS Data API' }));
    expect(screen.getByRole('heading', { name: NODES.dataapi!.title })).toBeInTheDocument();
    expect(screen.getByText(/judgment call of Phase 1/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'RDS Data API' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('steps through a traced request and highlights its boxes', async () => {
    const user = userEvent.setup();
    render(<App />, { route: '/stack' });
    await user.click(await screen.findByRole('button', { name: 'Save a recipe' }));
    const steps = TRACES.save!.steps;
    expect(screen.getByText(`step 1 of ${steps.length}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(`step 2 of ${steps.length}`)).toBeInTheDocument();
    const list = screen.getByRole('list');
    const current = within(list).getByRole('button', { current: 'step' });
    expect(current).toHaveTextContent(steps[1]!.text);
    const apigw = screen.getByRole('button', { name: 'API Gateway HTTP API' });
    expect(apigw.getAttribute('class')).toContain('fill-highlight-subtle');
  });

  it('every trace step names boxes and arrows that exist in the diagram', () => {
    render(<App />, { route: '/stack' });
    const ids = new Set(
      Array.from(document.querySelectorAll('[data-id]')).map((el) => el.getAttribute('data-id')),
    );
    const edgeIds = new Set(
      Array.from(document.querySelectorAll('path[id^="e-"]')).map((el) => el.id),
    );
    for (const trace of Object.values(TRACES)) {
      for (const step of trace.steps) {
        for (const n of step.nodes) expect(ids.has(n), `node ${n}`).toBe(true);
        for (const e of step.edges) expect(edgeIds.has(e), `edge ${e}`).toBe(true);
      }
    }
    for (const id of ids) expect(NODES[id!], `copy for ${id}`).toBeDefined();
  });
});
