import React from 'react';
import Typography from '../Typography/Typography';

export type ComparatorColor = 'default' | 'primary' | 'error';

export interface ComparatorProps {
  color?: ComparatorColor;
  unitA?: string;
  unitB?: string;
  unitACaption?: string;
  unitBCaption?: string;
  label?: string;
}

const SvgLines: React.FC = () => (
  <svg
    className="w-full h-6"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 6"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="0" y1="3" x2="24" y2="3" />
  </svg>
);

const ComparatorBox: React.FC<{
  color?: ComparatorColor;
  label?: string;
  caption?: string;
}> = ({ color = 'default', label, caption }) => {
  const labelValueColor = {
    default: 'text-neutral-50',
    primary: 'text-primary-600',
    error: 'text-error-600',
  };

  const borderColor = {
    default: 'border-neutral-50',
    primary: 'border-primary-600',
    error: 'border-error-700',
  };
  return (
    <div className="flex flex-col items-center justify-center">
      <div
        className={`text-body-2 mb-2 px-2 ${labelValueColor[color]} border rounded-full ${borderColor[color]}`}
      >
        {label}
      </div>
      <div className="text-caption text-neutral-50">{caption}</div>
    </div>
  );
};

export const Comparator: React.FC<ComparatorProps> = ({
  color,
  unitA,
  unitB,
  unitACaption,
  unitBCaption,
  label,
}) => {
  return (
    <>
      <div className="flex justify-center">
        <Typography variant="body2">{label}</Typography>
      </div>
      <div className="flex flex-row">
        <ComparatorBox label={unitACaption} caption={unitA} />
        <div>
          <SvgLines />
        </div>
        <ComparatorBox label={unitBCaption} caption={unitB} />
      </div>
    </>
  );
};
