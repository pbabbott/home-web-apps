import type { Meta, StoryObj } from "@storybook/react";

import { Panel, Typography, Button } from "../index";
import { PanelColor, PanelVariant } from "../components/Panel/types";
import { ButtonColor } from "../components/Button/Button";

const meta = {
  title: "Examples/Panel",
  component: Panel,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["transparent", "outlined", "dots"],
      description: "The variant of the panel",
    },
  },
  args: {
    variant: 'transparent'
  }
} satisfies Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof meta>;

const SamplePanel = ({
  color,
  buttonColor,
  variant = 'transparent'
}: {
  color: PanelColor;
  buttonColor: ButtonColor;
  variant?: PanelVariant;
}) => (
  <Panel className="max-w-80 px-8 py-4" variant={variant} color={color}>
    <Typography variant="h4" component="h4">
      I am a header
    </Typography>
    <Typography className="mb-12" variant="body2" component="p">
      The quick brown fox jumped over the lazy dog.
    </Typography>

    <div className="flex justify-end">
      <Button color={buttonColor}>Button</Button>
    </div>
  </Panel>
);

export const SimpleShowcase: Story = {
  render: (args) => (
    <div className="flex gap-8">
      <SamplePanel color="default" buttonColor="secondary" variant={args.variant} />
      <SamplePanel color="white" buttonColor="primary" variant={args.variant} />
      <SamplePanel color="primary" buttonColor="primary" variant={args.variant} />
      <SamplePanel color="secondary" buttonColor="secondary" variant={args.variant} />
    </div>
  ),
};
