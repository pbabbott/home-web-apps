import { extendedTwMerge } from '../../utils/extendTwMerge';

export type HorizontalRuleProps = {
  className?: string;
  color?: 'primary' | 'secondary' | 'neutral';
};

export const HorizontalRule = ({
  className,
  color = 'primary',
}: HorizontalRuleProps) => {
  const gradientStyles = {
    primary: 'bg-gradient-to-r from-transparent via-primary-500 to-transparent',
    secondary:
      'bg-gradient-to-r from-transparent via-secondary-500 to-transparent',
    neutral: 'bg-gradient-to-r from-transparent via-neutral-500 to-transparent',
  };

  return (
    <hr
      className={extendedTwMerge(
        'h-[1px] border-0 my-4',
        gradientStyles[color],
        className,
      )}
    />
  );
};
