import { renderTable } from './renderer';

test('renders the header row', () => {
  expect(renderTable([])).toContain('| Claim |');
});
