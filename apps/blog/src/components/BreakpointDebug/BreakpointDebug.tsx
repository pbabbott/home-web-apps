// Dev aid: shows the current Tailwind breakpoint, fixed mid-left on screen.
// Not currently mounted anywhere — drop it into a layout when debugging
// responsive layout issues.
export default function BreakpointDebug() {
  return (
    <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50 font-mono text-sm font-bold px-2 py-1 rounded bg-black/70 pointer-events-none">
      <span className="sm:hidden text-neutral-400">base</span>
      <span className="hidden sm:inline md:hidden text-blue-400">sm</span>
      <span className="hidden md:inline lg:hidden text-green-400">md</span>
      <span className="hidden lg:inline xl:hidden text-yellow-400">lg</span>
      <span className="hidden xl:inline 2xl:hidden text-orange-400">xl</span>
      <span className="hidden 2xl:inline text-red-400">2xl</span>
    </div>
  );
}
