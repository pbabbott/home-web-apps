import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { Panel, Typography, Button } from "../index";
import { PanelColor } from "../components/Panel/types";
import { ButtonColor } from "../components/Button/Button";

const meta = {
  title: "Examples/Panel",
  component: Panel,
  parameters: {
    layout: "centered",
  },
  args: {
    onClick: fn(),
  },
} satisfies Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof meta>;

const SamplePanel = ({
  color,
  buttonColor,
}: {
  color: PanelColor;
  buttonColor: ButtonColor;
}) => (
  <Panel className="max-w-72 px-10 py-5" variant="transparent" color={color}>
    <Typography variant="h4" component="h4">
      I am a header
    </Typography>
    <Typography className="mb-8" variant="body2" component="p">
      The quick brown fox jumped over the lazy dog.
    </Typography>

    <div className="flex justify-end">
      <Button color={buttonColor}>Button</Button>
    </div>
  </Panel>
);

export const TransparentShowcase: Story = {
  render: () => (
    <div className="flex gap-4">
      <SamplePanel color="default" buttonColor="secondary" />
    </div>
  ),
};
