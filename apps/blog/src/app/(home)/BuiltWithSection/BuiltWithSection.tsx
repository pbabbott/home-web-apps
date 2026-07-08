'use client';

import {
  HorizontalRule,
  OutlinedButton,
  TransparentPanel,
  Typography,
} from '@abbottland/fui-components';
import { Icon } from '@abbottland/fui-icons';
import { OpenInNewWindowIcon } from '@radix-ui/react-icons';

interface ToolCardProps {
  iconName: string;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}

function ToolCard({
  iconName,
  title,
  description,
  href,
  linkLabel,
}: ToolCardProps) {
  return (
    <TransparentPanel color="default" className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3">
        <Icon name={iconName} size={28} className="text-primary-500 shrink-0" />
        <Typography variant="h5" component="h3">
          {title}
        </Typography>
      </div>
      <Typography variant="body1" component="p" className="flex-1">
        {description}
      </Typography>
      <OutlinedButton
        component="a"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        color="primary"
        className="self-start"
      >
        <span className="flex items-center gap-2">
          {linkLabel}
          <OpenInNewWindowIcon width={16} height={16} />
        </span>
      </OutlinedButton>
    </TransparentPanel>
  );
}

export default function BuiltWithSection() {
  return (
    <div
      id="built-with"
      className="bg-neutral-800 w-full flex flex-col items-center justify-center px-4 py-16"
    >
      <div className="flex flex-col items-center w-full max-w-screen-lg gap-6">
        <Typography variant="h2" component="h2" className="text-center">
          Diagrams & Interfaces
        </Typography>
        <HorizontalRule className="w-full" />

        <Typography
          variant="body1"
          component="p"
          className="text-center max-w-2xl"
        >
          This site leans on a couple of dedicated tools, purpose-built for its
          diagrams and interface - I designed and built both myself.
        </Typography>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-4">
          <ToolCard
            iconName="radix-share"
            title="Diagram Maker"
            description="Every architecture diagram on this site was drawn with Diagram
              Maker, a diagramming tool I designed and built myself. Sketching
              out systems visually is one of my favorite parts of software
              engineering, so I built the editor I wished existed."
            href="https://diagram-maker.abbottland.io"
            linkLabel="diagram-maker.abbottland.io"
          />
          <ToolCard
            iconName="radix-cube"
            title="FUI Components"
            description="The glowing panels, animations, and small interactive touches
              across this site come from FUI Components, a 'Futuristic UI'
              component library I built and maintain. Outside the constraints
              of a corporate design system, it has been a fun outlet for
              animations and non-essential features I rarely get to build at
              work."
            href="https://fui-components.abbottland.io/"
            linkLabel="fui-components.abbottland.io"
          />
        </div>
      </div>
    </div>
  );
}
