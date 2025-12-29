'use client';

import { Node, NodeProps } from '@xyflow/react';
import { BaseNode, BaseNodeData } from './BaseNode';

export interface LabeledNodeData extends BaseNodeData {
  label: string;
}

type LabeledNodeType = Node<LabeledNodeData, 'labeled'>;

export function LabeledNode({
  id,
  data,
  selected,
}: NodeProps<LabeledNodeType>) {
  return <BaseNode id={id} data={data} selected={selected} showLabel={true} />;
}
