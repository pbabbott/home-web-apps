import type { StoryObj } from '@storybook/react-vite';
import { Card } from '../../components/Card/Card';
import { Typography } from '../../components/Typography/Typography';
import { CalendarIcon, ClockIcon } from '@radix-ui/react-icons';
import { Button } from '../../components/Button/Button';
import { HorizontalRule } from '../../components/HorizontalRule/HorizontalRule';

const subTextColor = 'text-neutral-500';

const meta = {
  title: 'Showcase/Card',
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const AllColors: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-6">
      <Card color="default">
        <div>Default</div>
      </Card>
      <Card color="primary">
        <div>Primary</div>
      </Card>
      <Card color="secondary">
        <div>Secondary</div>
      </Card>
      <Card color="success">
        <div>Success</div>
      </Card>
      <Card color="error">
        <div>Error</div>
      </Card>
      <Card color="warning">
        <div>Warning</div>
      </Card>
      <Card color="accent-purple">
        <div>Accent Purple</div>
      </Card>
      <Card color="accent-falcon">
        <div>Accent Falcon</div>
      </Card>
    </div>
  ),
};

export const BlogPost: Story = {
  render: () => (
    <Card color="primary">
      <Typography
        variant="h3"
        component="h3"
        className="w-fit text-transparent bg-clip-text bg-neutral-200 transition-all duration-300 group-hover:bg-gradient-to-r group-hover:from-primary-500 group-hover:via-neutral-50 group-hover:to-accent-falcon-300"
      >
        Quantum Computing Basics
      </Typography>
      <Typography
        variant="body2"
        className="mb-4 text-neutral-300 transition-all duration-300 group-hover:text-neutral-50"
      >
        A beginners guide to understanding quantum mechanics and its application
        in next-generation computing systems.
      </Typography>
      <div className="flex flex-row gap-x-2 items-center">
        <CalendarIcon width={20} height={20} className={subTextColor} />
        <Typography variant="body2" component="span" className={subTextColor}>
          2025-12-09
        </Typography>
        <ClockIcon width={20} height={20} className={subTextColor} />
        <Typography variant="body2" component="span" className={subTextColor}>
          8min read
        </Typography>
      </div>
      <HorizontalRule color="primary" />
      <div className="flex justify-end">
        <Button color="primary" variant="text">
          &gt; READ_MORE
        </Button>
      </div>
    </Card>
  ),
};
