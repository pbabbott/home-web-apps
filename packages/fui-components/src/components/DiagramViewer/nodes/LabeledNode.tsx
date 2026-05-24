'use client';

import { type Node, type NodeProps } from '@xyflow/react';
import { BaseNode, type BaseNodeData } from '../../BaseNode/BaseNode';

export type LabeledNodeData = BaseNodeData & {
  label: string;
};

type LabeledNodeType = Node<LabeledNodeData, 'labeled'>;

export function LabeledNode({
  id,
  data,
  selected,
}: NodeProps<LabeledNodeType>) {
  return <BaseNode id={id} data={data} selected={selected} showLabel={true} />;
}
