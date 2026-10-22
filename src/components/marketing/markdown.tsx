import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const components: Components = {
  h2: ({ children }) => <h2 className="mt-10 mb-3 text-2xl font-extrabold tracking-tight first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-6 mb-2 text-xl font-bold">{children}</h3>,
  p: ({ children }) => <p className="my-4 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-4 list-disc space-y-2 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="my-4 list-decimal space-y-2 pl-6">{children}</ol>,
  li: ({ children }) => <li className="pl-1 leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  blockquote: ({ children }) => <blockquote className="my-4 border-l-4 border-primary pl-4 italic">{children}</blockquote>,
  hr: () => <hr className="my-8 border-border" />,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b-2 border-border p-2 font-bold">{children}</th>,
  td: ({ children }) => <td className="border-b border-border p-2 align-top">{children}</td>,
  a: ({ href = "", children }) => {
    const cls = "font-semibold text-primary underline underline-offset-4 dark:text-foreground";
    // Site links stay in the reader's language; anything else opens in a new tab.
    if (href.startsWith("/") && !href.startsWith("//")) return <Link href={href} className={cls}>{children}</Link>;
    if (href.startsWith("tel:") || href.startsWith("mailto:") || href.startsWith("#")) return <a href={href} className={cls}>{children}</a>;
    return <a href={href} className={cls} target="_blank" rel="noopener noreferrer nofollow">{children}</a>;
  },
  // Pages carry their own <h1>; a stray "# Title" in admin copy becomes a section heading.
  h1: ({ children }) => <h2 className="mt-10 mb-3 text-2xl font-extrabold tracking-tight first:mt-0">{children}</h2>,
  img: () => null,
};

/** Renders admin-edited Markdown. Raw HTML is not allowed (react-markdown escapes it). */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("max-w-prose text-lg", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
        {children}
      </ReactMarkdown>
    </div>
  );
}
