import { verifyCitation } from './verifier';

test('accepts a dated https citation', () => {
  expect(verifyCitation({url: 'https://a.org', date: '2026-01-01'})).toBe(true);
});
