import { useState, useMemo } from "react";
import DOMPurify from "dompurify";
import { ChevronDown, ChevronUp } from "lucide-react";

interface EmailBodyProps {
  html?: string | null;
  text?: string | null;
  maxCollapsedHeight?: number;
}

/**
 * Renders email content like a proper email client.
 * Uses sanitized HTML when available, falls back to formatted plain text.
 * Content is collapsible when it exceeds a threshold height.
 */
export default function EmailBody({
  html,
  text,
  maxCollapsedHeight = 200,
}: EmailBodyProps) {
  const [expanded, setExpanded] = useState(false);

  const sanitizedHtml = useMemo(() => {
    if (html) {
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          "p",
          "br",
          "div",
          "span",
          "a",
          "b",
          "strong",
          "i",
          "em",
          "u",
          "ul",
          "ol",
          "li",
          "blockquote",
          "pre",
          "code",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "table",
          "thead",
          "tbody",
          "tr",
          "td",
          "th",
          "img",
          "hr",
          "font",
          "sub",
          "sup",
        ],
        ALLOWED_ATTR: [
          "href",
          "target",
          "rel",
          "src",
          "alt",
          "width",
          "height",
          "style",
          "class",
          "color",
          "size",
          "face",
          "align",
          "valign",
          "colspan",
          "rowspan",
          "cellpadding",
          "cellspacing",
          "border",
        ],
        ADD_ATTR: ["target"],
      });
    }

    if (text) {
      // Convert plain text to basic HTML
      return textToHtml(text);
    }

    return null;
  }, [html, text]);

  if (!sanitizedHtml) return null;

  return (
    <div className="mt-2 relative">
      <div
        className={`email-body overflow-hidden transition-all ${
          !expanded ? "max-h-[200px]" : ""
        }`}
        style={!expanded ? { maxHeight: maxCollapsedHeight } : undefined}
      >
        <div
          className="text-sm leading-relaxed text-foreground email-content"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      </div>
      {/* Gradient fade + expand/collapse toggle */}
      <div
        className={`flex items-center justify-center pt-1 ${
          !expanded
            ? "bg-gradient-to-t from-background via-background/80 to-transparent -mt-10 pt-10"
            : ""
        }`}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 py-1"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" /> Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" /> Show more
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Convert plain text email to simple HTML.
 * Handles line breaks, quoted lines (> prefix), and URLs.
 */
function textToHtml(text: string): string {
  const lines = text.split("\n");
  const parts: string[] = [];
  let inQuote = false;

  for (const line of lines) {
    const isQuoted = /^>+/.test(line.trimStart());

    if (isQuoted && !inQuote) {
      parts.push('<blockquote class="email-quote">');
      inQuote = true;
    } else if (!isQuoted && inQuote) {
      parts.push("</blockquote>");
      inQuote = false;
    }

    // Strip leading > markers
    const clean = line.replace(/^(>\s*)+/, "");
    // Convert URLs to links
    const withLinks = escapeHtml(clean).replace(
      /https?:\/\/[^\s<>"']+/g,
      (url) => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`
    );
    parts.push(withLinks + "<br>");
  }

  if (inQuote) parts.push("</blockquote>");

  return parts.join("");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
