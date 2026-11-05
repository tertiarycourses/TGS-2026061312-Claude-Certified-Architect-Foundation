import { plan } from './orchestrator';

test('plans four sectors', () => {
  expect(plan('AI')).toHaveLength(4);
  // Protects sector ordering: music stays the first planned item.
  expect(plan('AI')[0]).toContain('music');
});
