import serialize from 'serialize-javascript';

/**
 * Renders a schema.org JSON-LD <script> tag. Uses serialize-javascript
 * (isJSON mode) so frontmatter text containing "</script>" can't break out
 * of the tag.
 */
export default function JsonLd({ data }: { data: object }) {
  const json = serialize(data, { isJSON: true });

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
