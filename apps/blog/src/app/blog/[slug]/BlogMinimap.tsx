'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  neutral,
  primary,
  secondary,
  accentPurple,
  accentFalcon,
  success,
  warning,
  error,
} from '@abbottland/fui-components';

type ContentBlock = {
  tag: string;
  top: number;
  height: number;
  widthRatio?: number;
  rowCount?: number;
  colCount?: number;
  panelColor?: string;
};

const MINIMAP_WIDTH = 100;

// Deterministic line-width patterns for text and code rendering
const TEXT_LINE_WIDTHS = [0.9, 0.7, 0.85, 0.6, 0.8, 0.75, 0.65, 0.9, 0.55, 0.8];
const CODE_LINE_WIDTHS = [0.7, 0.9, 0.5, 0.8, 0.6, 0.85, 0.4, 0.75, 0.65, 0.9];

/** Convert a 6-digit hex token to rgba() with the given alpha. */
function toRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Maps a TransparentPanel color prop to its representative hex token. */
function panelColorHex(color: string): string {
  const map: Record<string, string> = {
    default: neutral[600],
    dark: neutral[800],
    white: neutral[200],
    primary: primary[700],
    secondary: secondary[600],
    success: success[500],
    error: error[600],
    warning: warning[500],
    'accent-purple': accentPurple[500],
    'accent-falcon': accentFalcon[600],
  };
  return map[color] ?? neutral[600];
}

/** Minimap colour palette derived from FUI design tokens. */
const C = {
  minimapBg: neutral[900], // #23272B — dark panel background
  codeBlockBg: neutral[1000], // #171819 — darker than minimap so code blocks recede
  codeBlockBorder: neutral[700], // #3D4A4F — subtle border
  codeLine: neutral[600], // #728A92 — readable lines against the dark bg
  textLine: neutral[500], // #8DABB5 — paragraph text representation
  listMark: neutral[600], // #728A92 — bullet dots + item lines
  headingBright: neutral[100], // #F2FCFF — H1 / H2
  headingMid: neutral[300], // #C8D9DE — H3 / H4
  headingDim: neutral[500], // #8DABB5 — H5 / H6
  blockquote: accentPurple[400], // #8F63FF — left-accent purple
  tableBg: neutral[800], // #2E373B — table body (slightly lighter than minimap)
  tableBorder: primary[800], // #008E91 — muted teal row / column grid lines
  imagePrimary: primary[400], // #63FDFF — teal end of image gradient
  imageAccent: accentPurple[300], // #AC8CFF — light purple end of image gradient
  diagramPrimary: secondary[400], // #2BC9FF — blue end of diagram gradient
  diagramAccent: accentPurple[400], // #8F63FF — deeper purple end of diagram gradient
  thumbAccent: primary[400], // #63FDFF — viewport indicator borders
} as const;

function scanArticleBlocks(article: HTMLElement): ContentBlock[] {
  const scrolled = window.scrollY;
  const articleTop = article.getBoundingClientRect().top + scrolled;
  const articleWidth = article.offsetWidth || 1;

  const elements = article.querySelectorAll<HTMLElement>(
    'h1, h2, h3, h4, h5, h6, p, img, pre, ul, ol, blockquote',
  );

  const blocks: ContentBlock[] = [];
  const seenTops = new Set<number>();

  elements.forEach((el) => {
    // Skip anything nested inside a table — the table block represents those
    if (el.closest('table')) return;

    const rect = el.getBoundingClientRect();
    const top = Math.round(rect.top + scrolled - articleTop);
    const height = el.offsetHeight;
    if (height < 1) return;
    // Skip duplicate tops (e.g. img inside figure — figure already captured)
    if (seenTops.has(top)) return;
    seenTops.add(top);

    const block: ContentBlock = { tag: el.tagName, top, height };
    if (el.tagName === 'IMG') {
      block.widthRatio = Math.min(1, el.offsetWidth / articleWidth);
    }
    blocks.push(block);
  });

  // Tables
  const tables = article.querySelectorAll<HTMLElement>('table');
  tables.forEach((el) => {
    const rect = el.getBoundingClientRect();
    const top = Math.round(rect.top + scrolled - articleTop);
    const height = el.offsetHeight;
    if (height < 1 || seenTops.has(top)) return;
    seenTops.add(top);
    const rows = el.querySelectorAll('tr');
    const firstRow = rows[0];
    blocks.push({
      tag: 'TABLE',
      top,
      height,
      rowCount: rows.length,
      colCount: firstRow ? firstRow.querySelectorAll('td, th').length : 2,
    });
  });

  // Diagrams: React Flow containers rendered by DiagramViewer
  const diagrams = article.querySelectorAll<HTMLElement>(
    '.react-flow, .xyflow',
  );
  diagrams.forEach((el) => {
    const rect = el.getBoundingClientRect();
    const top = Math.round(rect.top + scrolled - articleTop);
    const height = el.offsetHeight;
    if (height < 1 || seenTops.has(top)) return;
    seenTops.add(top);
    blocks.push({ tag: 'DIAGRAM', top, height });
  });

  // TransparentPanel components (identified by data-fui attribute)
  const panels = article.querySelectorAll<HTMLElement>(
    '[data-fui="transparent-panel"]',
  );
  panels.forEach((el) => {
    const rect = el.getBoundingClientRect();
    const top = Math.round(rect.top + scrolled - articleTop);
    const height = el.offsetHeight;
    if (height < 1 || seenTops.has(top)) return;
    seenTops.add(top);
    blocks.push({
      tag: 'PANEL',
      top,
      height,
      panelColor: el.dataset.color ?? 'default',
    });
  });

  blocks.sort((a, b) => a.top - b.top);
  return blocks;
}

function ParagraphBlock({
  scaledTop,
  scaledHeight,
}: {
  scaledTop: number;
  scaledHeight: number;
}) {
  const lineHeight = 1;
  const lineGap = 2;
  const lineCount = Math.max(
    1,
    Math.floor(scaledHeight / (lineHeight + lineGap)),
  );
  return (
    <div
      className="absolute"
      style={{
        top: scaledTop,
        height: Math.max(2, scaledHeight),
        left: 4,
        right: 4,
      }}
    >
      {Array.from({ length: lineCount }, (_, j) => {
        const isLast = j === lineCount - 1;
        const widthFactor = TEXT_LINE_WIDTHS[j % TEXT_LINE_WIDTHS.length];
        return (
          <div
            key={j}
            style={{
              position: 'absolute',
              top: j * (lineHeight + lineGap),
              left: 0,
              width: isLast ? `${widthFactor * 60}%` : `${widthFactor * 100}%`,
              height: lineHeight,
              backgroundColor: C.textLine,
              borderRadius: 0.5,
            }}
          />
        );
      })}
    </div>
  );
}

function CodeBlock({
  scaledTop,
  scaledHeight,
}: {
  scaledTop: number;
  scaledHeight: number;
}) {
  const lineHeight = 2;
  const lineGap = 1;
  const lineCount = Math.max(
    1,
    Math.floor((scaledHeight - 2) / (lineHeight + lineGap)),
  );
  return (
    <div
      className="absolute overflow-hidden"
      style={{
        top: scaledTop,
        height: Math.max(4, scaledHeight),
        left: 4,
        right: 4,
        backgroundColor: C.codeBlockBg,
        borderRadius: 1,
        border: `1px solid ${C.codeBlockBorder}`,
      }}
    >
      {Array.from({ length: lineCount }, (_, j) => (
        <div
          key={j}
          style={{
            position: 'absolute',
            top: 1 + j * (lineHeight + lineGap),
            left: 4,
            width: `${CODE_LINE_WIDTHS[j % CODE_LINE_WIDTHS.length] * 80}%`,
            height: lineHeight,
            backgroundColor: C.codeLine,
            borderRadius: 0.5,
          }}
        />
      ))}
    </div>
  );
}

function ListBlock({
  scaledTop,
  scaledHeight,
}: {
  scaledTop: number;
  scaledHeight: number;
}) {
  const lineGap = 3;
  const lineCount = Math.max(1, Math.floor(scaledHeight / lineGap));
  return (
    <div
      className="absolute"
      style={{
        top: scaledTop,
        height: Math.max(2, scaledHeight),
        left: 4,
        right: 4,
      }}
    >
      {Array.from({ length: lineCount }, (_, j) => {
        const widthFactor = TEXT_LINE_WIDTHS[j % TEXT_LINE_WIDTHS.length];
        return (
          <div
            key={j}
            style={{
              position: 'absolute',
              top: j * lineGap,
              left: 0,
              right: 0,
              height: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <div
              style={{
                width: 2,
                height: 2,
                borderRadius: '50%',
                backgroundColor: C.listMark,
                flexShrink: 0,
              }}
            />
            <div
              style={{
                width: `${widthFactor * 85}%`,
                height: 1,
                backgroundColor: C.listMark,
                borderRadius: 0.5,
                opacity: 0.7,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function TableBlock({
  scaledTop,
  scaledHeight,
  rowCount = 3,
  colCount = 2,
}: {
  scaledTop: number;
  scaledHeight: number;
  rowCount?: number;
  colCount?: number;
}) {
  const innerWidth = MINIMAP_WIDTH - 10; // 4px left + 4px right + 2px border
  const rowH = Math.max(1, scaledHeight / rowCount);
  const colW = innerWidth / colCount;

  return (
    <div
      className="absolute overflow-hidden"
      style={{
        top: scaledTop,
        height: Math.max(6, scaledHeight),
        left: 4,
        right: 4,
        backgroundColor: C.tableBg,
        borderRadius: 1,
        border: `1px solid ${C.tableBorder}`,
      }}
    >
      {/* Horizontal row dividers */}
      {Array.from({ length: rowCount - 1 }, (_, j) => (
        <div
          key={`r${j}`}
          style={{
            position: 'absolute',
            top: (j + 1) * rowH,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: C.tableBorder,
          }}
        />
      ))}
      {/* Vertical column dividers */}
      {Array.from({ length: colCount - 1 }, (_, j) => (
        <div
          key={`c${j}`}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: Math.round((j + 1) * colW),
            width: 1,
            backgroundColor: C.tableBorder,
          }}
        />
      ))}
    </div>
  );
}

function TransparentPanelBlock({
  scaledTop,
  scaledHeight,
  panelColor = 'default',
}: {
  scaledTop: number;
  scaledHeight: number;
  panelColor?: string;
}) {
  const hex = panelColorHex(panelColor);
  const cornerSize = 3;

  return (
    <div
      className="absolute"
      style={{
        top: scaledTop,
        height: Math.max(5, scaledHeight),
        left: 4,
        right: 4,
        backgroundColor: toRgba(hex, 0.3),
      }}
    >
      {/* Corner squares mirroring the actual TransparentPanel decoration */}
      {(
        [
          { top: 0, left: 0 },
          { top: 0, right: 0 },
          { bottom: 0, left: 0 },
          { bottom: 0, right: 0 },
        ] as React.CSSProperties[]
      ).map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            ...pos,
            width: cornerSize,
            height: cornerSize,
            backgroundColor: hex,
          }}
        />
      ))}
    </div>
  );
}

export default function BlogMinimap() {
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [articleHeight, setArticleHeight] = useState(0);
  const [articleDocTop, setArticleDocTop] = useState(0);
  const [minimapHeight, setMinimapHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [visible, setVisible] = useState(false);

  const minimapRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const scanArticle = useCallback(() => {
    const article = document.getElementById('blog-article');
    if (!article) return;

    const artHeight = article.scrollHeight;
    if (artHeight < 200) return;

    const scrolled = window.scrollY;
    const artDocTop = article.getBoundingClientRect().top + scrolled;
    const found = scanArticleBlocks(article);

    setArticleDocTop(artDocTop);
    setArticleHeight(artHeight);
    setBlocks(found);
    if (found.length > 3) setVisible(true);
  }, []);

  // Watch MDX dynamic import resolving via MutationObserver
  useEffect(() => {
    const article = document.getElementById('blog-article');
    if (!article) return;

    let debounceTimer: ReturnType<typeof setTimeout>;
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(scanArticle, 150);
    });
    observer.observe(article, { childList: true, subtree: true });
    setTimeout(scanArticle, 0);

    return () => {
      observer.disconnect();
      clearTimeout(debounceTimer);
    };
  }, [scanArticle]);

  // Track minimap height for scale calculation
  useEffect(() => {
    const el = minimapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setMinimapHeight(el.clientHeight));
    ro.observe(el);
    setMinimapHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  // Scroll and resize listeners
  useEffect(() => {
    setViewportHeight(window.innerHeight);

    const onScroll = () => setScrollTop(window.scrollY);
    const onResize = () => {
      setViewportHeight(window.innerHeight);
      scanArticle();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [scanArticle]);

  const scrollToRatio = useCallback(
    (clientY: number, smooth = true) => {
      const el = minimapRef.current;
      if (!el || articleHeight === 0) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientY - rect.top) / rect.height),
      );
      const targetScroll =
        articleDocTop + ratio * articleHeight - viewportHeight / 2;
      window.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: smooth ? 'smooth' : 'instant',
      });
    },
    [articleDocTop, articleHeight, viewportHeight],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      scrollToRatio(e.clientY, true);
    },
    [scrollToRatio],
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      scrollToRatio(e.clientY, false);
    };
    const onMouseUp = () => {
      isDragging.current = false;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [scrollToRatio]);

  const scale =
    minimapHeight > 0 && articleHeight > 0 ? minimapHeight / articleHeight : 0;

  const thumbHeight =
    articleHeight > 0
      ? Math.min(
          minimapHeight,
          (viewportHeight / articleHeight) * minimapHeight,
        )
      : 0;
  const rawThumbTop =
    articleHeight > 0
      ? ((scrollTop - articleDocTop) / articleHeight) * minimapHeight
      : 0;
  const thumbTop = Math.max(
    0,
    Math.min(rawThumbTop, minimapHeight - thumbHeight),
  );

  return (
    <div
      className="fixed right-0 top-1/2 -translate-y-1/2 hidden xl:flex flex-col z-50"
      style={{ width: MINIMAP_WIDTH }}
    >
      <div
        ref={minimapRef}
        className="relative overflow-hidden border-l border-neutral-700 cursor-pointer select-none"
        style={{
          height: '70vh',
          backgroundColor: C.minimapBg,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.5s ease',
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Content blocks */}
        {scale > 0 &&
          blocks.map((block, i) => {
            const t = block.tag.toUpperCase();
            const scaledTop = block.top * scale;
            const scaledHeight = block.height * scale;

            if (t === 'DIAGRAM') {
              return (
                <div
                  key={i}
                  className="absolute"
                  style={{
                    top: scaledTop,
                    height: Math.max(8, scaledHeight),
                    left: 4,
                    right: 4,
                    background: toRgba(C.diagramPrimary, 0.18),
                    borderRadius: 1,
                    border: `1px solid ${toRgba(C.diagramPrimary, 0.75)}`,
                  }}
                />
              );
            }

            if (t === 'IMG') {
              const innerWidth = MINIMAP_WIDTH - 8;
              const blockWidth =
                block.widthRatio != null
                  ? Math.round(block.widthRatio * innerWidth)
                  : innerWidth;
              return (
                <div
                  key={i}
                  className="absolute"
                  style={{
                    top: scaledTop,
                    height: Math.max(6, scaledHeight),
                    left: 4,
                    width: blockWidth,
                    background: `linear-gradient(135deg, ${toRgba(C.imagePrimary, 0.25)} 0%, ${toRgba(C.imageAccent, 0.35)} 100%)`,
                    borderRadius: 1,
                    border: `1px solid ${toRgba(C.imagePrimary, 0.15)}`,
                  }}
                />
              );
            }

            if (t === 'TABLE') {
              return (
                <TableBlock
                  key={i}
                  scaledTop={scaledTop}
                  scaledHeight={scaledHeight}
                  rowCount={block.rowCount}
                  colCount={block.colCount}
                />
              );
            }

            if (t === 'PRE') {
              return (
                <CodeBlock
                  key={i}
                  scaledTop={scaledTop}
                  scaledHeight={scaledHeight}
                />
              );
            }

            if (t === 'P') {
              return (
                <ParagraphBlock
                  key={i}
                  scaledTop={scaledTop}
                  scaledHeight={scaledHeight}
                />
              );
            }

            if (t === 'UL' || t === 'OL') {
              return (
                <ListBlock
                  key={i}
                  scaledTop={scaledTop}
                  scaledHeight={scaledHeight}
                />
              );
            }

            if (t === 'PANEL') {
              return (
                <TransparentPanelBlock
                  key={i}
                  scaledTop={scaledTop}
                  scaledHeight={scaledHeight}
                  panelColor={block.panelColor}
                />
              );
            }

            if (t === 'BLOCKQUOTE') {
              return (
                <div
                  key={i}
                  className="absolute"
                  style={{
                    top: scaledTop,
                    height: Math.max(3, scaledHeight),
                    left: 4,
                    right: 4,
                    backgroundColor: toRgba(C.blockquote, 0.2),
                    borderRadius: 1,
                    borderLeft: `2px solid ${toRgba(C.blockquote, 0.7)}`,
                  }}
                />
              );
            }

            if (t.match(/^H[1-6]$/)) {
              const level = parseInt(t[1], 10);
              const color =
                level <= 2
                  ? C.headingBright
                  : level <= 4
                    ? C.headingMid
                    : C.headingDim;
              const widthPct = [92, 78, 65, 52, 42, 34][level - 1] ?? 34;
              const minH = level <= 2 ? 4 : level <= 4 ? 3 : 2;
              return (
                <div
                  key={i}
                  className="absolute"
                  style={{
                    top: scaledTop,
                    height: Math.max(minH, scaledHeight),
                    left: 4,
                    width: `${widthPct}%`,
                    backgroundColor: color,
                    borderRadius: 1,
                    opacity: 0.85,
                  }}
                />
              );
            }

            return null;
          })}

        {/* Viewport indicator */}
        <div
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            top: thumbTop,
            height: Math.max(4, thumbHeight),
            backgroundColor: toRgba(C.thumbAccent, 0.15),
            borderTop: `1px solid ${toRgba(C.thumbAccent, 0.7)}`,
            borderBottom: `1px solid ${toRgba(C.thumbAccent, 0.7)}`,
          }}
        />
      </div>
    </div>
  );
}
