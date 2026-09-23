/**
 * Read an optional Vite env var.
 *
 * `??` is not enough here: an unset var in a `.env` file arrives as `''`, not
 * `undefined`, so a blank line in a copied `.env.example` would satisfy `??`
 * and hand a component an empty string. This treats blank as absent.
 */
export function optionalEnv(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}
