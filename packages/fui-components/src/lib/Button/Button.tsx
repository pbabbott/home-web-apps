import styled from 'styled-components';

/* eslint-disable-next-line */
export interface ButtonProps {}

export function Button(props: ButtonProps) {
  return (
    <button className="bg-primary-700 hover:bg-primary-900 text-white py-2 px-4">
      Button
    </button>
  );
}

export default Button;