/**
 * Convert a string to a URL-safe slug.
 * - Strips common file extensions (.html, .pdf, .docx, etc.)
 * - Lowercases
 * - Replaces spaces and special chars with hyphens
 * - Strips anything that isn't a-z, 0-9, hyphen, or underscore
 * - Collapses consecutive hyphens
 * - Trims leading/trailing hyphens
 */
export function slugify(input: string): string {
  return input
    .trim()
    .replace(/\.(html?|pdf|docx?|xlsx?|pptx?|csv|txt|png|jpe?g|gif)$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/[\s]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}
