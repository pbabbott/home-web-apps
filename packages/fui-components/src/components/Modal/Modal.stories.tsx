import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Modal,
  ModalTrigger,
  ModalContent,
  ModalTitle,
  ModalDescription,
  type ModalColor,
} from './Modal';

const meta: Meta = {
  title: 'Components/Modal',
};
export default meta;
type Story = StoryObj<typeof meta>;

// Stories render open by default (via `defaultOpen`) purely so the modal is
// visible without interaction in Storybook/screenshot tests. The Modal
// component itself defaults to closed — callers control open state.
const ModalDemo = ({ color }: { color: ModalColor }) => (
  <Modal defaultOpen>
    <ModalTrigger className="bg-transparent border border-neutral-700 text-neutral-50 px-4 py-2 cursor-pointer outline-none uppercase text-button">
      Open Modal
    </ModalTrigger>
    <ModalContent color={color}>
      <ModalTitle>System Alert</ModalTitle>
      <ModalDescription>
        This is a {color} variant modal built on Radix Dialog primitives.
      </ModalDescription>
    </ModalContent>
  </Modal>
);

export const Primary: Story = {
  render: () => <ModalDemo color="primary" />,
};

export const Secondary: Story = {
  render: () => <ModalDemo color="secondary" />,
};
