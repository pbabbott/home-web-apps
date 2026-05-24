import type { StoryObj } from '@storybook/react-vite';
import type { Node, Edge } from '@xyflow/react';
import { DiagramViewer } from '../../components/DiagramViewer/DiagramViewer';
import localNetworkData from './diagram-local-network.json';
import portForwardingData from './diagram-port-forwarding.json';
import fullNetworkData from './diagram-full-network.json';

type DiagramData = { nodes: Node[]; edges: Edge[] };

const meta = {
  title: 'Showcase/DiagramViewer',
};

export default meta;
type Story = StoryObj<typeof meta>;

export const LocalNetwork: Story = {
  render: () => (
    <DiagramViewer data={localNetworkData as DiagramData} height="350px" />
  ),
};

export const WithPortForwarding: Story = {
  render: () => (
    <DiagramViewer data={portForwardingData as DiagramData} height="400px" />
  ),
};

export const FullNetworkWithDuckDNS: Story = {
  render: () => (
    <DiagramViewer data={fullNetworkData as DiagramData} height="600px" />
  ),
};
