export function plan(topic: string): string[] {
  return ['music', 'writing', 'film', 'visual arts'].map(s => `${topic}: ${s}`);
}
