'use client';

import { Node, NodeProps } from '@xyflow/react';
import { BaseNode, type BaseNodeData } from '@abbottland/fui-components';

export type DefaultNodeData = BaseNodeData & {
  content?: string;
};

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

