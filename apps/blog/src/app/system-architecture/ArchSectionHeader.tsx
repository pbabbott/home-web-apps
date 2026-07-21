import { Typography, Badge, type BadgeColor } from '@abbottland/fui-components';
import AIContent from '@/components/AIContent/AIContent';

interface ComplexityBadgeProps {
  label: string;
  color: BadgeColor;
}

function ComplexityBadge({ label, color }: ComplexityBadgeProps) {
  return <Badge color={color}>Complexity: {label}</Badge>;
}

export interface ArchSectionHeaderProps {
  levelLabel: string;
  heading: string;
  description: string;
  complexity: ComplexityBadgeProps;
}

export function ArchSectionHeader({
  levelLabel,
  heading,
  description,
  complexity,
}: ArchSectionHeaderProps) {
  return (
    <>
      <Typography variant="h2" component="h2" className="text-neutral-100 mb-2">
        {heading}
      </Typography>
      <div className="flex items-center justify-between gap-4 mb-3">
        <Typography
          variant="caption"
          component="p"
          className="text-neutral-500"
        >
          {levelLabel}
        </Typography>
        <ComplexityBadge {...complexity} />
      </div>
      <AIContent className="mb-6 max-w-2xl">
        <Typography variant="body1" component="p" className="text-neutral-400">
          {description}
        </Typography>
      </AIContent>
    </>
  );
}
