export interface StorybookButtonProps {
  /** Is this the principal call to action on the page? */
  primary?: boolean;
  /** What background color to use */
  backgroundColor?: string;
  /** How large should the button be? */
  size?: 'small' | 'medium' | 'large';
  /** Button contents */
  label: string;
  /** Optional click handler */
  onClick?: () => void;
}

/** Primary UI component for user interaction */
export const StorybookButton = ({
  primary = false,
  size = 'medium',
  backgroundColor,
  label,
  ...props
}: StorybookButtonProps) => {
  // Base button styles
  const baseClasses =
    'font-semibold rounded-md cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';

  // Size-based classes
  const sizeClasses = {
    small: 'px-3 py-1.5 text-sm',
    medium: 'px-4 py-2 text-base',
    large: 'px-6 py-3 text-lg',
  };

  // Primary vs secondary styling
  const modeClasses = primary
    ? 'bg-primary text-white hover:bg-primary-700 focus:ring-primary'
    : 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300 focus:ring-neutral-500';

  const className = `${baseClasses} ${sizeClasses[size]} ${modeClasses}`.trim();

  return (
    <button
      type="button"
      className={className}
      style={backgroundColor ? { backgroundColor } : undefined}
      {...props}
    >
      {label}
    </button>
  );
};
