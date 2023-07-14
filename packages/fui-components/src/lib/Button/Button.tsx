import styled from 'styled-components';

/* eslint-disable-next-line */
export interface ButtonProps {}

const StyledMyNewLib = styled.div`
  color: pink;
`;

export function Button(props: ButtonProps) {
  return (
    <button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
      Button
    </button>
  );
}

export default Button;