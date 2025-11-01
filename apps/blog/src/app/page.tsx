'use client';
import { Button, Typography } from 'fui-components';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-800">
      <div className="w-full min-h-screen bg-secondary-900">
        <Typography variant="h1" component="h1">
          Abbottland.io
        </Typography>
      </div>
      <div className="flex flex-col items-center justify-center w-full max-w-3xl gap-6 py-32">
        <Typography variant="h2" component="h2">
          Welcome to Abbottland.io
        </Typography>
        <Typography variant="body1" component="p">
          This is the home page of Abbottland.io
        </Typography>
        <Button>Hello world</Button>
      </div>
    </div>
  );
}
