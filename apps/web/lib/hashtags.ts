export function extractHashtags(input: string): string[] {
  const text = input ?? "";
  const tags = new Set<string>();

  // Hashtag: starts with #, then 1-32 of letters/numbers/underscore.
  // We require either start-of-string or a non-word char before # to avoid matching in URLs.
  const re = /(?:^|[^\w])#([a-zA-Z0-9_]{1,32})/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    tags.add(match[1].toLowerCase());
  }

  return [...tags];
}

