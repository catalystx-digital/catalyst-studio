/**
 * Safely extract a string from a value that may be a nested object.
 *
 * LLM sometimes generates nested objects like {text: "...", url: "..."}
 * for fields that expect plain strings. This helper extracts the string
 * value to prevent [object Object] from rendering.
 *
 * @example
 * safeString("hello") // "hello"
 * safeString({ text: "hello" }) // "hello"
 * safeString({ label: "Click me", href: "/page" }) // "Click me"
 * safeString(null) // ""
 */
export const safeString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    // Try common string property names in order of priority
    const candidate = obj.text ?? obj.label ?? obj.title ?? obj.value ?? obj.name ?? obj.href ?? obj.url ?? '';
    return typeof candidate === 'string' ? candidate : String(candidate);
  }
  return String(value ?? '');
};
