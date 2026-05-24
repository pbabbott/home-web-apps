'use client';

import { type NodeProps, type Node } from '@xyflow/react';
import { Typography } from '../../Typography/Typography';
import { type NodeColorScheme } from '../../BaseNode/BaseNode';

export interface TextNodeData extends Record<string, unknown> {
  content?: string;
  colorScheme?: NodeColorScheme;
}

type TextNodeType = Node<TextNodeData, 'text'>;

const textColorStyles: Record<NodeColorScheme, string> = {
  primary: 'text-primary-300',
  secondary: 'text-secondary-100',
  default: 'text-neutral-200',
};

export function TextNode({ data, selected }: NodeProps<TextNodeType>) {
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
