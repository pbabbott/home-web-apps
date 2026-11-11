import { BuildInfo } from './BuildInfo';

export function Footer() {
  return (
    <div className="px-3 py-1 text-right bg-neutral-950">
      <BuildInfo className="text-neutral-600" />
    </div>
  );
}
