import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  return (
    <div className={`font-mono ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        // Headings - inherit size from parent
        h1: ({ children }) => <h1 className="text-blue-400 font-bold font-mono mt-3 mb-3">{children}</h1>,
        h2: ({ children }) => <h2 className="text-blue-400 font-bold font-mono mt-3 mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-blue-400 font-semibold font-mono mt-2 mb-2">{children}</h3>,

        // Paragraphs and text - inherit size from parent with inline style
        p: ({ children }) => <span className="block mb-3 font-mono">{children}</span>,
        strong: ({ children }) => <strong className="font-bold text-white font-mono">{children}</strong>,
        em: ({ children }) => <em className="text-gray-200 italic font-mono">{children}</em>,

        // Lists - minimal spacing
        ul: ({ children }) => <ul className="ml-3 list-disc font-mono">{children}</ul>,
        ol: ({ children }) => <ol className="ml-3 list-decimal font-mono">{children}</ol>,
        li: ({ children }) => <li className="text-gray-100 font-mono">{children}</li>,

        // Code - inherit font size from parent
        code: ({ inline, className, children, ...props }) => {
          // Check if this code is inside a pre tag (code block)
          const isCodeBlock = !inline && className;

          if (!isCodeBlock) {
            // Inline code
            return <code className="text-green-300 bg-gray-800/30 px-1 py-0.5 rounded font-mono">{children}</code>;
          }
          // Code block
          return (
            <code className="block text-green-300 bg-gray-900/70 p-3 rounded overflow-x-auto border border-gray-800 font-mono" {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => <pre className="bg-gray-900/70 rounded my-3 overflow-x-auto">{children}</pre>,

        // Links - inherit font with subtle styling
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-blue-400 hover:text-blue-300 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),

        // Blockquotes - inherit font with minimal styling
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-gray-700 pl-3 text-gray-400 my-2">
            {children}
          </blockquote>
        ),

        // Horizontal rule
        hr: () => <hr className="border-gray-800 my-2" />,

        // Tables (from GFM) - inherit font
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => <thead className="border-b border-gray-800">{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr className="border-b border-gray-900">{children}</tr>,
        td: ({ children }) => <td className="px-2 py-1">{children}</td>,
        th: ({ children }) => <th className="px-2 py-1 text-gray-300 text-left">{children}</th>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};