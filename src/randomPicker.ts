export const MAX_RANDOM_CHOICES = 100;
export const MAX_RANDOM_INPUT_LENGTH = 10_000;

export function parseRandomChoices(input: string): { choices: string[]; error: string | null } {
  if (input.length > MAX_RANDOM_INPUT_LENGTH) {
    return { choices: [], error: `Keep the list to ${MAX_RANDOM_INPUT_LENGTH.toLocaleString("en-US")} characters or fewer.` };
  }

  const seen = new Set<string>();
  const choices: string[] = [];
  for (const line of input.split(/\r?\n/)) {
    const choice = line.trim();
    const key = choice.toLowerCase();
    if (!choice || seen.has(key)) continue;
    seen.add(key);
    choices.push(choice);
    if (choices.length > MAX_RANDOM_CHOICES) {
      return { choices: [], error: `Use up to ${MAX_RANDOM_CHOICES} unique choices. Remove a few to start drawing.` };
    }
  }
  return { choices, error: null };
}

export function pickRandomChoice(choices: readonly string[], random: () => number = Math.random): string | null {
  if (choices.length === 0) return null;
  return choices[Math.floor(random() * choices.length)];
}
