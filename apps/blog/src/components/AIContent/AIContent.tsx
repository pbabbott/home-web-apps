'use client';

import {
  AIContent as FuiAIContent,
  type AIContentProps as FuiAIContentProps,
} from '@abbottland/fui-components';
import { useReaderPreferences } from '@/context/ReaderPreferences.Context';
import { useAnimationsContext } from '@/context/Animations.Context';

export type AIContentProps = Omit<
  FuiAIContentProps,
  'highlighted' | 'animated'
>;

/**
 * MDX-facing wrapper: authors write `<AIContent>…</AIContent>` around
 * AI-assisted sections. Whether it's actually highlighted (and whether the
 * highlight pulses) is driven by the reader's own preferences, not the
 * author — so this component reads context instead of taking those as props.
 */
export default function AIContent(props: AIContentProps) {
  const { highlightAiEnabled } = useReaderPreferences();
  const { animationsEnabled } = useAnimationsContext();

  return (
    <FuiAIContent
      highlighted={highlightAiEnabled}
      animated={animationsEnabled}
      {...props}
    />
  );
}
