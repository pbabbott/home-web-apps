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
  parameters: {
    // ModalContent renders through a Radix Portal, fixed-positioned relative
    // to the viewport rather than nested inside #storybook-root — without
    // `fullscreen`, #storybook-root shrinks to the trigger button's size and
    // the screenshot locator only captures that tiny region.
    layout: 'fullscreen',
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

// Stories render open by default (via `defaultOpen`) purely so the modal is
// visible without interaction in Storybook/screenshot tests. The Modal
// component itself defaults to closed — callers control open state.
//
// The outer div gives #storybook-root an explicit viewport-sized box: Modal's
// content renders through a Radix Portal, fixed-positioned relative to the
// viewport, not nested inside #storybook-root. Without this, the root
// shrinks to the trigger button's size and the screenshot only captures
// that tiny region instead of the centered modal.
const ModalDemo = ({ color }: { color: ModalColor }) => (
  <div style={{ width: '100vw', height: '100vh' }}>
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
  </div>
);

export const Primary: Story = {
  render: () => <ModalDemo color="primary" />,
};

export const Secondary: Story = {
  render: () => <ModalDemo color="secondary" />,
};
