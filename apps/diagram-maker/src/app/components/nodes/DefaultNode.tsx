'use client';

import { Node, NodeProps } from '@xyflow/react';
import { BaseNode, BaseNodeData } from './BaseNode';

export interface DefaultNodeData extends BaseNodeData {
  content?: string;
}

type DefaultNodeType = Node<DefaultNodeData, 'customDefault'>;

export function DefaultNode({
  id,
  data,
  selected,
}: NodeProps<DefaultNodeType>) {
  return (
    <BaseNode id={id} data={data} selected={selected} showLabel={false} />
  );
}

