import type { FC } from 'react';

export type SvgIconProps = { size: number; className?: string };

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
