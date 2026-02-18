import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "img",
];
const ALLOWED_ATTR = ["src", "alt", "title", "class"];

interface RichTextContentProps {
  html: string;
  className?: string;
}

export function RichTextContent({
  html,
  className = "",
}: RichTextContentProps) {
  // Sanitize HTML with DOMPurify to prevent XSS — only allow safe formatting tags
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });

  return (
    <div
      className={`rich-text-content ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
