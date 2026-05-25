'use client';

import { type Node, type NodeProps } from '@xyflow/react';
import { BaseNode, type BaseNodeData } from '../BaseNode/BaseNode';

export type DefaultNodeData = BaseNodeData & {
  content?: string;
};

type DefaultNodeType = Node<DefaultNodeData, 'customDefault'>;

export function DefaultNode({
  id,
  data,
  selected,
}: NodeProps<DefaultNodeType>) {
  return <BaseNode id={id} data={data} selected={selected} showLabel={false} />;
}
