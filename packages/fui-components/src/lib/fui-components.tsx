import styled from 'styled-components';

/* eslint-disable-next-line */
export interface MyNewLibProps {}

const StyledMyNewLib = styled.div`
  color: pink;
`;

export function MyNewLib(props: MyNewLibProps) {
  return (
    <StyledMyNewLib>
      <h1>Welcome to MyNewLib!</h1>
    </StyledMyNewLib>
  );
}

export default MyNewLib;
