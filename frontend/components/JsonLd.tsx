// Server-side JSON-LD structured data injector.
// Renders in initial HTML → no JS dependency → Googlebot reads on first crawl.

interface Props {
  data: Record<string, unknown> | Record<string, unknown>[]
}

export function JsonLd({ data }: Props) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint: dangerouslySetInnerHTML is intentional for JSON-LD
      dangerouslySetInnerHTML={{ __html: JSON.stringify(Array.isArray(data) ? data : data) }}
    />
  )
}
