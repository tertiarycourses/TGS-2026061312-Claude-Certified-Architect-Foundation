import { plan } from './orchestrator';

test('plans four sectors', () => {
  expect(plan('AI')).toHaveLength(4);
  // Protects: the first planned sector is music.
  expect(plan('AI')[0]).toContain('music');
});
