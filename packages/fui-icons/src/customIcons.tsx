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

export const DuckDnsIcon: FC<SvgIconProps> = ({ size, className }) => (
  <svg
    viewBox="-0.01 27.45 512.09 457.21"
    width={size}
    height={size}
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* dashboard-icons duckdns — MIT */}
    <path
      d="M226.8 213.8c-15.5 0-51 7.5-63.8-.1-9.4-5.6-15.6-18.7-23.2-26.5-14.1-14.4-30.6-26.3-48.7-35.1-8.1-4-19.6-10.8-28.9-7.7-17.5 5.8-30.6 34.2-38.6 49.4-31.6 59.6-29.4 136.1-5.7 198 17.1 44.7 47.5 59.6 91.1 74.1 64.5 21.5 143.6 25.7 209.1 6.4 40.2-11.9 69.3-19.2 90.5-58.3 20.3-37.5 30.3-84.3 24.2-126.8-2.6-18.1-19.6-50-16.5-66.6 2.5-13.2 29.8-8.9 39.7-12.6 29.2-11.1 73.4-64.3 49-98-12.6-17.4-53.4 3.4-70.3-7.4-9.9-6.3-15.3-24.1-22.7-33.3-16.5-20.7-39.3-33.4-64.9-39.1C276.2 14.3 211 69.5 207 140.4c-1.5 27 9.5 49.4 19.8 73.4"
      fill="#040502"
    />
    <path
      d="M304.7 54.7c-56.8 10.7-83.6 74.7-64.8 125.7 5 13.5 40.5 44.4 26.3 56.5-6.8 5.8-19.9 3.6-28.2 3.6-20.1-.2-39.9-1.8-60.1.6-11.1 1.3-23.6 5.8-32.5-3.4-18.3-18.7-28.6-40.4-52-54.9-6.8-4.2-17.9-12.5-26-7.5-14.3 8.9-23.7 34.5-29.4 49.6-17 44.8-14.2 97.2-.8 142.4 4.7 15.7 11 36.7 23.3 48.1 15.4 14.2 42 22.2 61.8 27.9 55.9 16.1 116.4 19.8 173.5 8 21.5-4.5 55.7-10.2 72.7-24.9 36.2-31.5 43.3-97.1 37.9-141.2-2.7-22.1-19-43.5-20.4-64.5-1.1-17.3 22-38.6 24.8-57.8 9-62.9-40.6-120.6-106.1-108.2"
      fill="#fcfc01"
    />
    <path
      d="M340.3 95.3c-29.3 11.2-10 54.3 17.7 42.8 28.9-11.8 10.1-53.4-17.7-42.8"
      fill="#040502"
    />
    <path
      d="M435.9 122.6c4.9 26.7-2.9 47.6-6.7 73.4 41-3.6 62.2-34.1 62.3-73.4z"
      fill="#fd0101"
    />
  </svg>
);

export const CylinderIcon: FC<SvgIconProps> = ({ size, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* lucide/database — ISC license */}
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5V19A9 3 0 0 0 21 19V5" />
    <path d="M3 12A9 3 0 0 0 21 12" />
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
