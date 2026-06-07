/**
 * Join class names, dropping falsy values. Keeps CSS-module usage tidy under
 * `noUncheckedIndexedAccess`, where `styles.foo` is `string | undefined`.
 */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter((c): c is string => typeof c === 'string' && c.length > 0).join(' ');
}
