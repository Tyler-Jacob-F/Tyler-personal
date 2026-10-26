import { App } from '@/App';
import { render, screen } from '@/test/render';

describe('App', () => {
  it('shows the name on the page', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tyler Fuqua');
  });
});
