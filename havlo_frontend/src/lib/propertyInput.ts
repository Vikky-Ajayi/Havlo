export type PropertyInputKind = 'url' | 'address';

export interface ParsedPropertyInput {
  kind: PropertyInputKind;
  raw: string;
  value: string;
}

function normalizePossibleUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^[a-z]+:\/\//i.test(trimmed)) return trimmed;
  if (/^(www\.)/i.test(trimmed)) return `https://${trimmed}`;
  if (/(rightmove|zoopla|onthemarket|primelocation|propertypal|s1homes|purplebricks|openrent)\./i.test(trimmed)) {
    return `https://${trimmed.replace(/^\/+/, '')}`;
  }
  return trimmed;
}

export function parsePropertyInput(rawValue: string): ParsedPropertyInput {
  const raw = rawValue.trim();
  if (!raw) {
    return { kind: 'address', raw: '', value: '' };
  }

  const candidate = normalizePossibleUrl(raw);
  try {
    const parsed = new URL(candidate);
    const protocol = parsed.protocol.toLowerCase();
    const hostname = parsed.hostname.toLowerCase();
    const looksWebLike = protocol === 'http:' || protocol === 'https:';
    const hasDomain = hostname.includes('.') && !hostname.endsWith('.local');
    const portalHost =
      hostname.includes('rightmove')
      || hostname.includes('zoopla')
      || hostname.includes('onthemarket')
      || hostname.includes('primelocation')
      || hostname.includes('propertypal')
      || hostname.includes('s1homes')
      || hostname.includes('purplebricks')
      || hostname.includes('openrent');

    if (looksWebLike && (hasDomain || portalHost)) {
      return {
        kind: 'url',
        raw,
        value: parsed.toString(),
      };
    }
  } catch {
    // Fall through to address mode.
  }

  return {
    kind: 'address',
    raw,
    value: raw,
  };
}
