'use client';

import { Panel, Typography } from '@abbottland/fui-components';

export default function WelcomeSection() {
  return (
    <div className="flex flex-col items-center justify-center w-full max-w-3xl gap-6 py-32">
      <Panel color="primary" variant="outlined">
        <Typography variant="h4" component="h4">
          Welcome to Abbottland.io
        </Typography>
        <Typography variant="body1" component="p">
          This is the home page of Abbottland.io
        </Typography>
      </Panel>
    </div>
  );
}
