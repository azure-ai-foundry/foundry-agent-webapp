import type { ClassAttributes, HTMLAttributes } from 'react';
import type { Components, ExtraProps } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import copy from 'copy-to-clipboard';
import { Button } from '@fluentui/react-components';
import { CopyRegular } from '@fluentui/react-icons';
import { memo, useMemo } from 'react';
import { CitationMarker } from '../chat/CitationMarker';
import { parseContentWithCitations } from '../../utils/citationParser';
import type { IAnnotation } from '../../types/chat';
import styles from './Markdown.module.css';

interface MarkdownProps {
  content: string;
  /** Annotations for inline citation rendering */
  annotations?: IAnnotation[];
  /** Callback when a citation marker is clicked */
  onCitationClick?: (index: number, annotation?: IAnnotation) => void;
}

interface CodeBlockProps
  extends ClassAttributes<HTMLElement>,
    HTMLAttributes<HTMLElement>,
    ExtraProps {
  inline?: boolean;
}

// Custom paragraph component - render inline for chat messages
const Paragraph: Components['p'] = ({ children }) => {
  return <span className={styles.paragraph}>{children} </span>;
};

// Enhanced code block with syntax highlighting and copy button
const CodeBlock = memo<CodeBlockProps>(
  ({ inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className ?? '');

    if (inline || !match) {
      return (
        <code {...props} className={styles.inlineCode}>
          {children}
        </code>
      );
    }

    const language = match[1];
    const content = String(children)
      .replace(/\n$/, '')
      .replaceAll('&nbsp;', '');

    return (
      <div className={styles.codeBlock}>
        <div className={styles.codeHeader}>
          <span className={styles.codeLanguage}>{language}</span>
          <Button
            appearance="subtle"
            icon={<CopyRegular />}
            size="small"
            onClick={() => {
              copy(content);
            }}
            className={styles.copyButton}
          >
            Copy
          </Button>
        </div>
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          showLineNumbers={true}
          wrapLines={true}
          wrapLongLines={true}
          customStyle={{
            margin: 0,
            borderBottomLeftRadius: '6px',
            borderBottomRightRadius: '6px',
            fontSize: '0.9em',
            maxWidth: '100%',
            overflowX: 'auto',
          }}
          codeTagProps={{
            style: {
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
            }
          }}
          PreTag="div"
        >
          {content}
        </SyntaxHighlighter>
      </div>
    );
  }
);

CodeBlock.displayName = 'CodeBlock';

// Custom link component with styling
const Link: Components['a'] = ({ href, children }) => {
  return (
    <a 
      href={href} 
      className={styles.link}
      target="_blank" 
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
};

// Custom list components
const UnorderedList: Components['ul'] = ({ children }) => {
  return <ul className={styles.list}>{children}</ul>;
};

const OrderedList: Components['ol'] = ({ children }) => {
  return <ol className={styles.list}>{children}</ol>;
};

const ListItem: Components['li'] = ({ children }) => {
  return <li className={styles.listItem}>{children}</li>;
};

// Custom heading components
const Heading: Components['h1'] = ({ children, ...props }) => {
  return <h1 className={styles.heading1} {...props}>{children}</h1>;
};

const Heading2: Components['h2'] = ({ children, ...props }) => {
  return <h2 className={styles.heading2} {...props}>{children}</h2>;
};

const Heading3: Components['h3'] = ({ children, ...props }) => {
  return <h3 className={styles.heading3} {...props}>{children}</h3>;
};

const Heading4: Components['h4'] = ({ children, ...props }) => {
  return <h4 className={styles.heading4} {...props}>{children}</h4>;
};

const Heading5: Components['h5'] = ({ children, ...props }) => {
  return <h5 className={styles.heading5} {...props}>{children}</h5>;
};

const Heading6: Components['h6'] = ({ children, ...props }) => {
  return <h6 className={styles.heading6} {...props}>{children}</h6>;
};

// Shared rehype sanitize config
const rehypeSanitizeConfig = [
  rehypeSanitize,
  {
    ...defaultSchema,
    tagNames: [...(defaultSchema.tagNames ?? []), 'sub', 'sup'],
    attributes: {
      ...defaultSchema.attributes,
      code: [['className', /^language-./]],
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as [typeof rehypeSanitize, any];

// Shared base components (without paragraph - that varies)
const baseComponents = {
  code: CodeBlock,
  a: Link,
  ul: UnorderedList,
  ol: OrderedList,
  li: ListItem,
  h1: Heading,
  h2: Heading2,
  h3: Heading3,
  h4: Heading4,
  h5: Heading5,
  h6: Heading6,
};

/**
 * Renders content with inline citation markers.
 * Parses [N] markers and replaces them with CitationMarker components.
 */
function ContentWithCitations({ 
  content, 
  annotations,
  onCitationClick 
}: { 
  content: string; 
  annotations?: IAnnotation[];
  onCitationClick?: (index: number, annotation?: IAnnotation) => void;
}) {
  const parsed = useMemo(
    () => parseContentWithCitations(content, annotations),
    [content, annotations]
  );

  // If no citations, render plain markdown
  if (parsed.citations.length === 0) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeSanitizeConfig]}
        components={{ p: Paragraph, ...baseComponents }}
      >
        {content}
      </ReactMarkdown>
    );
  }

  // Build citation index map for quick lookup
  const citationMap = new Map(
    parsed.citations.map(c => [c.index, c.annotation])
  );

  // Custom text renderer that handles [N] markers
  const TextWithCitations: Components['p'] = ({ children }) => {
    // children can be a string or array of React nodes
    const processNode = (node: React.ReactNode): React.ReactNode => {
      if (typeof node !== 'string') {
        return node;
      }

      // Split text on citation markers [N]
      const parts = node.split(/(\[\d+\])/g);
      
      return parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (match) {
          const idx = parseInt(match[1], 10);
          const annotation = citationMap.get(idx);
          return onCitationClick ? (
            <CitationMarker
              key={`citation-${idx}-${i}`}
              index={idx}
              annotation={annotation}
              onClick={onCitationClick}
            />
          ) : (
            <sup key={`citation-${idx}-${i}`}>[{idx}]</sup>
          );
        }
        return part;
      });
    };

    const processed = Array.isArray(children)
      ? children.map(processNode)
      : processNode(children);

    return <span className={styles.paragraph}>{processed} </span>;
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      rehypePlugins={[rehypeSanitizeConfig]}
      components={{ p: TextWithCitations, ...baseComponents }}
    >
      {parsed.processedText}
    </ReactMarkdown>
  );
}

export function Markdown({ content, annotations, onCitationClick }: MarkdownProps) {
  return (
    <div className={styles.markdown}>
      <ContentWithCitations 
        content={content} 
        annotations={annotations}
        onCitationClick={onCitationClick}
      />
    </div>
  );
}
