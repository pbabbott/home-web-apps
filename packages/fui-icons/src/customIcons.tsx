import type { FC } from 'react';

export type SvgIconProps = { size: number; className?: string };

export const BananaIcon: FC<SvgIconProps> = ({ size, className }) => (
  <svg
    viewBox="0 0 48 48"
    width={size}
    height={size}
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* icon-park-solid banana — Apache 2.0 */}
    <path
      d="M26 43c10-2 19.242-12.485 16.867-23.059L41.999 16V8l-6-1c0 12.941-3 23-16 25c-5.976.92-11.705-.386-16.129-2.922L5 36c2 5 11 9 21 7"
      fill="#FFE135"
      stroke="#C8860A"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16 32c-2.8-.933-6.035-3.173-7.476-5.425a1.7 1.7 0 0 1-.245-1.043l.245-3.75c.053-.81 1.01-1.24 1.671-.77C12.33 22.529 16.228 25 19 25c7 0 13-2.5 16-8"
      stroke="#C8860A"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const RouterIcon: FC<SvgIconProps> = ({ size, className }) => (
  <svg
    viewBox="0 0 48 48"
    width={size}
    height={size}
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* icon-park-solid router-one — Apache 2.0 */}
    <g fill="none">
      <path
        fill="#9CA3AF"
        stroke="#4B5563"
        strokeLinejoin="round"
        strokeWidth="4"
        d="M10 24L4 38h40l-6-14z"
      />
      <path
        stroke="#4B5563"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
        d="M10 4v20M38 4v20M24 4v20M4 38v6h40v-6"
      />
    </g>
  </svg>
);

export const HaproxyIcon: FC<SvgIconProps> = ({ size, className }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* central 2x2 grid */}
    <rect x="5.5" y="5.5" width="5" height="5" fill="#256ea5" />
    <rect x="13.5" y="5.5" width="5" height="5" fill="#256ea5" />
    <rect x="5.5" y="13.5" width="5" height="5" fill="#256ea5" />
    <rect x="13.5" y="13.5" width="5" height="5" fill="#256ea5" />
    {/* connecting lines */}
    <line
      x1="10.5"
      y1="8"
      x2="13.5"
      y2="8"
      stroke="#284a6a"
      strokeWidth="0.5"
    />
    <line
      x1="10.5"
      y1="16"
      x2="13.5"
      y2="16"
      stroke="#284a6a"
      strokeWidth="0.5"
    />
    <line
      x1="8"
      y1="10.5"
      x2="8"
      y2="13.5"
      stroke="#284a6a"
      strokeWidth="0.5"
    />
    <line
      x1="16"
      y1="10.5"
      x2="16"
      y2="13.5"
      stroke="#284a6a"
      strokeWidth="0.5"
    />
    {/* outer edge squares */}
    <rect x="10" y="1" width="4" height="2.5" fill="#3378bc" />
    <rect x="10" y="20.5" width="4" height="2.5" fill="#3378bc" />
    <rect x="1" y="10" width="2.5" height="4" fill="#3378bc" />
    <rect x="20.5" y="10" width="2.5" height="4" fill="#3378bc" />
    {/* corner dots */}
    <rect x="1" y="1" width="2" height="2" fill="#169bd6" />
    <rect x="21" y="1" width="2" height="2" fill="#169bd6" />
    <rect x="1" y="21" width="2" height="2" fill="#169bd6" />
    <rect x="21" y="21" width="2" height="2" fill="#169bd6" />
  </svg>
);
