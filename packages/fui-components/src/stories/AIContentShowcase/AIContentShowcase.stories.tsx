import type { Meta, StoryObj } from '@storybook/react-vite';

import { AIContent } from '../../components/AIContent/AIContent';
import { Typography } from '../../components/Typography/Typography';

const meta: Meta = {
  title: 'Showcase/AIContent',
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof meta>;

const LOREM_A =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';
const LOREM_B =
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';
const AI_TEXT =
  'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.';

const AI_TEXT_2 =
  'At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident.';

const Paragraphs = ({ animated }: { animated: boolean }) => (
  <div className="flex w-[560px] flex-col gap-4 bg-neutral-800 p-6 text-neutral-50">
    <Typography variant="body2">{LOREM_A}</Typography>
    <AIContent highlighted animated={animated}>
      <div className="flex flex-col gap-4">
        <Typography variant="body2">{AI_TEXT}</Typography>
        <Typography variant="body2">{AI_TEXT_2}</Typography>
      </div>
    </AIContent>
    <Typography variant="body2">{LOREM_B}</Typography>
  </div>
);

export const InlineParagraph: Story = {
  render: () => <Paragraphs animated={false} />,
};
