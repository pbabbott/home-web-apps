'use client';

import { NodeProps, Node } from '@xyflow/react';
import { Typography, type NodeColorScheme } from '@abbottland/fui-components';

export interface TextNodeData extends Record<string, unknown> {
  content?: string;
  colorScheme?: NodeColorScheme;
}

type TextNodeType = Node<TextNodeData, 'text'>;

// Text color mapping for TextNode
const textColorStyles: Record<NodeColorScheme, string> = {
  primary: 'text-primary-300',
  secondary: 'text-secondary-100',
  default: 'text-neutral-200',
};

export function TextNode({ id, data, selected }: NodeProps<TextNodeType>) {
  const colorScheme = data.colorScheme ?? 'default';
  const textColor = textColorStyles[colorScheme];
  const contentValue = data.content ?? 'Text';

  return (
    <div
      className={`
        min-w-[50px] min-h-[24px] px-1
        ${selected ? 'outline outline-2 outline-primary-500 outline-offset-2 rounded' : ''}
      `}
    >
      <Typography
        variant="body1"
        component="span"
        className={`whitespace-pre-wrap ${textColor}`}
      >
        {contentValue}
      </Typography>
    </div>
  );
}

