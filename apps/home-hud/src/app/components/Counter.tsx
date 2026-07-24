'use client';

import { useState } from 'react';
import { Button, Typography } from '@abbottland/fui-components';

export function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div className="flex items-center gap-4">
      <Button onClick={() => setCount((c) => c + 1)}>Boop the counter</Button>
      <Typography variant="body1">{count}</Typography>
    </div>
  );
}
