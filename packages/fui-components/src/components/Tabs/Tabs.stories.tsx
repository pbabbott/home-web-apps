import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="one" className="w-80">
      <TabsList>
        <TabsTrigger value="one">One</TabsTrigger>
        <TabsTrigger value="two">Two</TabsTrigger>
        <TabsTrigger value="three">Three</TabsTrigger>
      </TabsList>
      <TabsContent value="one">Content for tab one.</TabsContent>
      <TabsContent value="two">Content for tab two.</TabsContent>
      <TabsContent value="three">Content for tab three.</TabsContent>
    </Tabs>
  ),
};

export const WithDisabledTrigger: Story = {
  name: 'With disabled trigger',
  render: () => (
    <Tabs defaultValue="one" className="w-80">
      <TabsList>
        <TabsTrigger value="one">One</TabsTrigger>
        <TabsTrigger value="two" disabled>
          Two
        </TabsTrigger>
        <TabsTrigger value="three">Three</TabsTrigger>
      </TabsList>
      <TabsContent value="one">Content for tab one.</TabsContent>
      <TabsContent value="two">Content for tab two.</TabsContent>
      <TabsContent value="three">Content for tab three.</TabsContent>
    </Tabs>
  ),
};
