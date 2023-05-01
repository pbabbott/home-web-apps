import { render } from '@testing-library/react';

import MyNewLib from './fui-components';

describe('MyNewLib', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<MyNewLib />);
    expect(baseElement).toBeTruthy();
  });
});
