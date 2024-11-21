import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { Panel } from "./Panel";

const meta = {
  title: "Example/Panel",
  component: Panel,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["transparent", "outlined"],
      description: "The variant of the panel",
    },
    color: {
      control: "select",
      options: [
        "default",
        "white",
        "primary",
        "secondary",
        "success",
        "error",
        "warning",
        "accent-purple",
        "accent-falcon",
      ],
      description: "The color scheme of the panel",
    },
    children: {
      control: "text",
      description: "The content of the panel",
    },
    onClick: { action: "clicked" },
  },
  args: {
    onClick: fn(),
    children: "Panel content", // Default text for all stories
  },
} satisfies Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof meta>;

const PanelContent = ({ children }) => {
  return <div className="m-20">{children}</div>;
};

export const Primary: Story = {
  args: {
    variant: "transparent",
    color: "primary",
    children: <PanelContent>Primary Panel</PanelContent>,
  },
};

export const Secondary: Story = {
  args: {
    variant: "transparent",
    color: "secondary",
    children: <PanelContent>Secondary Panel</PanelContent>,
  },
};

export const Outlined: Story = {
  args: {
    variant: "outlined",
    color: "primary",
    children: <PanelContent>Outlined Panel</PanelContent>,
  },
};

export const Success: Story = {
  args: {
    variant: "transparent",
    color: "success",
    children: <PanelContent>Success Panel</PanelContent>,
  },
};

export const Error: Story = {
  args: {
    variant: "transparent",
    color: "error",
    children: <PanelContent>Error</PanelContent>,
  },
};

export const Warning: Story = {
  args: {
    variant: "transparent",
    color: "warning",
    children: <PanelContent>Warning</PanelContent>,
  },
};

export const AccentPurple: Story = {
  args: {
    variant: "transparent",
    color: "accent-purple",
    children: <PanelContent>Accent Purple</PanelContent>,
  },
};

export const AccentFalcon: Story = {
  args: {
    variant: "transparent",
    color: "accent-falcon",
    children: <PanelContent>Accent Falcon</PanelContent>,
  },
};

// Example showing all variants for a single color
export const AllVariants: Story = {
  render: (args) => (
    <div className="flex gap-4">
      <Panel {...args} variant="transparent">
        <PanelContent>Transparent</PanelContent>
      </Panel>
      <Panel {...args} variant="outlined">
        <PanelContent>Outlined</PanelContent>
      </Panel>
    </div>
  ),
};

// Example showing all colors in a grid
export const ColorShowcase: Story = {
  render: (args) => (
    <div className="grid grid-cols-3 gap-4">
      <Panel {...args} color="default">
        <PanelContent>Default</PanelContent>
      </Panel>
      <Panel {...args} color="white">
        <PanelContent>White</PanelContent>
      </Panel>
      <Panel {...args} color="primary">
        <PanelContent>Primary</PanelContent>
      </Panel>
      <Panel {...args} color="secondary">
        <PanelContent>Secondary</PanelContent>
      </Panel>
      <Panel {...args} color="success">
        <PanelContent>Success</PanelContent>
      </Panel>
      <Panel {...args} color="error">
        <PanelContent>Error</PanelContent>
      </Panel>
      <Panel {...args} color="warning">
        <PanelContent>Warning</PanelContent>
      </Panel>
      <Panel {...args} color="accent-purple">
        <PanelContent>Purple</PanelContent>
      </Panel>
      <Panel {...args} color="accent-falcon">
        <PanelContent>Falcon</PanelContent>
      </Panel>
    </div>
  ),
};
