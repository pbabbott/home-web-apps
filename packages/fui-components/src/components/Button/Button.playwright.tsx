import { test, expect } from '@playwright/experimental-ct-react';

import Button from './Button';

test('playwright renders button', async ({ mount }) => {
  const component = await mount(
    <Button variant="contained" color="primary">
      Button Text
    </Button>,
  );
  await expect(component).toContainText('Button Text');
  await expect(component.getByRole('button')).toHaveClass(
    /fui-button--contained fui-button--primary/,
  );
});
