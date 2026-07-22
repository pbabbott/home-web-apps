'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export interface PageWordStats {
  totalWords: number;
  aiWords: number;
  aiPercent: number;
}

const INITIAL_STATS: PageWordStats = {
  totalWords: 0,
  aiWords: 0,
  aiPercent: 0,
};

// Set on the page-content wrapper in the root layout, scoping the scrape to
// the current route's rendered output (excludes ReaderToolsDrawer/DebugModal,
// which are siblings, not descendants).
const PAGE_CONTENT_SELECTOR = '[data-page-content]';

// Set on the child wrapper inside AIContent (fui-components), around
// `children` only — excludes the "AI-GENERATED" label text from the count.
const AI_CONTENT_SELECTOR = '[data-ai-content-body]';

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

// `Element.textContent` includes text inside `<style>`/`<script>` tags (raw
// CSS/JS source, not reader-visible words) — AIContent's glow-animation
// `<style>` and shiki/rehype-pretty-code's per-block `<style>` both inject
// these. Walk visible text nodes only so those don't inflate the count.
function visibleText(root: Element): string {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const tag = node.parentElement?.tagName;
      return tag === 'STYLE' || tag === 'SCRIPT'
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT;
    },
  });

  let text = '';
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    text += `${node.textContent ?? ''} `;
  }
  return text;
}

function computeStats(container: Element): PageWordStats {
  const totalWords = countWords(visibleText(container));
  const aiWords = Array.from(
    container.querySelectorAll(AI_CONTENT_SELECTOR),
  ).reduce((sum, el) => sum + countWords(visibleText(el)), 0);
  const aiPercent =
    totalWords > 0 ? Math.round((aiWords / totalWords) * 100) : 0;

  return { totalWords, aiWords, aiPercent };
}

/**
 * Scrapes word counts from the current route's rendered DOM — total words
 * and words inside `<AIContent>` blocks — rather than deriving them from
 * MDX/frontmatter, so it works on any page, not just blog posts.
 * Recomputes on route change and on any content mutation (MDX/async content
 * can paint after the pathname changes).
 */
export function usePageWordStats(): PageWordStats {
  const pathname = usePathname();
  const [stats, setStats] = useState<PageWordStats>(INITIAL_STATS);

  useEffect(() => {
    const container = document.querySelector(PAGE_CONTENT_SELECTOR);

    const update = () => {
      setStats(container ? computeStats(container) : INITIAL_STATS);
    };
    update();

    if (!container) return;

    const observer = new MutationObserver(update);
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [pathname]);

  return stats;
}
