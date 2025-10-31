import { useState } from 'react';
import { Button } from 'fui-components';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-neutral-1000 text-neutral-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-h1 text-primary-500">Sample App</h1>

        <div className="bg-neutral-900 p-6 rounded-lg space-y-4">
          <h2 className="text-h2 text-secondary-500">Using fui-components</h2>

          <div className="flex gap-4 flex-wrap">
            <Button
              primary
              label="Primary Button"
              onClick={() => setCount((count) => count + 1)}
            />
            <Button
              label="Secondary Button"
              onClick={() => setCount((count) => count - 1)}
            />
            <Button size="large" label="Large Button" />
            <Button size="small" label="Small Button" />
          </div>

          <p className="text-body1 text-neutral-200">
            Count: <span className="text-primary-400 font-bold">{count}</span>
          </p>

          <div className="mt-4 p-4 bg-primary-900/20 rounded border border-primary-700">
            <p className="text-caption text-primary-200">
              This app uses components and theme from{' '}
              <code className="text-primary-400">fui-components</code> package.
              The colors you see (primary, secondary, neutral) come from the
              shared theme configuration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
