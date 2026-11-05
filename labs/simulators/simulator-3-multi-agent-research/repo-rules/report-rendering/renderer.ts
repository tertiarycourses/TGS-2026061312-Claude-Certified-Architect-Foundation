export function renderTable(rows: string[][]): string {
  const header = '| Claim | Value | Source | Published |';
  return [header, ...rows.map(r => '| ' + r.join(' | ') + ' |')].join('\n');
}
