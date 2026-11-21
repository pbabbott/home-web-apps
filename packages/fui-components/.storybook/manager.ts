import { addons } from 'storybook/manager-api';

/**
 * The Home/Landing story is the library's front page: no addon panel (controls,
 * a11y, etc.) should be offered there, so it is forced closed for that story.
 */
const LANDING_STORY_ID = 'home--landing';

addons.setConfig({
  layoutCustomisations: {
    showPanel(state, defaultValue) {
      return state.storyId === LANDING_STORY_ID ? false : defaultValue;
    },
  },
});
