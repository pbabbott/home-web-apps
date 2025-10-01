import { render, screen, fireEvent } from '@testing-library/react';
import Button, { ButtonProps } from './Button';
import '@testing-library/jest-dom';

const handleClick = jest.fn();

const renderButton = (props: ButtonProps) => {
  return render(<Button {...props} />);
};

test('renders Button and handles click event', () => {
  renderButton({ onClick: handleClick, children: 'Click Me' });

  const buttonElement = screen.getByText(/Click Me/i);
  expect(buttonElement).toBeInTheDocument();

  fireEvent.click(buttonElement);
  expect(handleClick).toHaveBeenCalledTimes(1);
});
