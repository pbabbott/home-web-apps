// import { createTest } from '@storybook/react/experimental-playwright';
// import { composeStories } from '@storybook/react';
// import * as stories from './Button.stories';

// This function will be executed in the browser
// and compose all stories, exporting them in a single object
// const composedStories = composeStories(stories);
// const { Primary } = composedStories;
// const test = createTest(base);

// test('renders primary button', async ({ mount }) => {
//   // The mount function will execute all the necessary steps in the story,
//   // such as loaders, render, and play function
//   await mount(<stories.Primary />);
// });

// test('renders primary button with overridden props', async ({ mount }) => {
//   // You can pass custom props to your component via JSX
//   const component = await mount(
//     <stories.Primary>label from test</stories.Primary>,
//   );
//   await expect(component).toContainText('label from test');
//   await expect(component.getByRole('button')).toHaveClass(
//     /storybook-button--primary/,
//   );
// });

// test('Button Primary snapshot', async () => {
//   await Primary.run();
//   expect(document.body.firstChild).toMatchSnapshot();
// });
