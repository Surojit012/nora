export function extractMentions(input: string): string[] {
  const text = input ?? "";
  const tags = new Set<string>();

  // Mention: starts with @, then 3-24 of letters/numbers/underscore.
  // We require either start-of-string or a non-word char before @ to avoid matching emails.
  const re = /(?:^|[^\w])@([a-zA-Z0-9_]{3,24})/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    tags.add(match[1].toLowerCase());
  }

  return [...tags];
}

