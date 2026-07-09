'use client';

import {
  HorizontalRule,
  TransparentPanel,
  Typography,
} from '@abbottland/fui-components';
import { Icon } from '@abbottland/fui-icons';
import { useAnimationsContext } from '@/context/Animations.Context';

const PERSON_PATH =
  'M7.5 0.875C5.49797 0.875 3.875 2.49797 3.875 4.5C3.875 6.15288 4.98124 7.54738 6.49373 7.98351C5.2997 8.12901 4.27557 8.55134 3.50407 9.31167C2.52216 10.2794 2.02502 11.72 2.02502 13.5999C2.02502 13.8623 2.23769 14.0749 2.50002 14.0749C2.76236 14.0749 2.97502 13.8623 2.97502 13.5999C2.97502 11.8799 3.42786 10.7206 4.17091 9.9883C4.91536 9.25463 6.02674 8.87499 7.49995 8.87499C8.97317 8.87499 10.0846 9.25463 10.8291 9.98831C11.5721 10.7206 12.025 11.8799 12.025 13.5999C12.025 13.8623 12.2376 14.0749 12.5 14.0749C12.7623 14.075 12.975 13.8623 12.975 13.6C12.975 11.72 12.4778 10.2794 11.4959 9.31166C10.7244 8.55135 9.70025 8.12903 8.50625 7.98352C10.0187 7.5474 11.125 6.15289 11.125 4.5C11.125 2.49797 9.50203 0.875 7.5 0.875ZM4.825 4.5C4.825 3.02264 6.02264 1.825 7.5 1.825C8.97736 1.825 10.175 3.02264 10.175 4.5C10.175 5.97736 8.97736 7.175 7.5 7.175C6.02264 7.175 4.825 5.97736 4.825 4.5Z';

const PRIMARY = '#3AFCFF';
const SECONDARY = '#2BC9FF';

function FlowParticle({
  color,
  direction,
  delay,
}: {
  color: string;
  direction: 'lr' | 'rl';
  delay: string;
}) {
  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
      style={{
        backgroundColor: color,
        boxShadow: `0 0 6px ${color}`,
        animation: `promise-flow-${direction} 2.4s ease-in-out infinite ${delay}`,
      }}
    />
  );
}

function BondConnector({ animated }: { animated: boolean }) {
  return (
    <div className="flex-1 relative h-0.5 mx-4 mt-10 self-start">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to right, ${PRIMARY}66, #005978, ${SECONDARY}66)`,
        }}
      />
      {animated && (
        <>
          {[0, 0.8, 1.6].map((delay) => (
            <FlowParticle
              key={`lr-${delay}`}
              color={PRIMARY}
              direction="lr"
              delay={`${delay}s`}
            />
          ))}
          {[0.4, 1.2, 2.0].map((delay) => (
            <FlowParticle
              key={`rl-${delay}`}
              color={SECONDARY}
              direction="rl"
              delay={`${delay}s`}
            />
          ))}
        </>
      )}
    </div>
  );
}

function EntityNode({
  color,
  label,
  pulseDelay = '0s',
  animated,
}: {
  color: string;
  label: string;
  pulseDelay?: string;
  animated: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 shrink-0">
      <div className="relative w-20 h-20">
        {/* Pulse ring */}
        {animated && (
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: `1px solid ${color}`,
              animation: `promise-pulse 2.5s ease-out infinite ${pulseDelay}`,
            }}
          />
        )}
        {/* Circle body */}
        <div
          className="relative z-10 w-full h-full rounded-full flex items-center justify-center"
          style={{
            background: '#001B24',
            border: `2px solid ${color}`,
            boxShadow: `0 0 14px ${color}44`,
          }}
        >
          <svg viewBox="0 0 15 15" width="36" height="36" aria-hidden="true">
            <path
              d={PERSON_PATH}
              fill={color}
              fillRule="evenodd"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>
      <Typography
        variant="caption"
        component="span"
        style={{ color, opacity: 0.8 }}
      >
        {label}
      </Typography>
    </div>
  );
}

function PromiseAnimation({ animated }: { animated: boolean }) {
  return (
    <div className="flex items-start w-full max-w-md mx-auto px-4 py-4">
      <EntityNode
        color={PRIMARY}
        label="AUTHOR"
        pulseDelay="0s"
        animated={animated}
      />
      <BondConnector animated={animated} />
      <EntityNode
        color={SECONDARY}
        label="READER"
        pulseDelay="1.25s"
        animated={animated}
      />
    </div>
  );
}

export default function PromiseSection() {
  const { animationsEnabled } = useAnimationsContext();

  return (
    <div
      id="abbottland-promise"
      className="bg-secondary-900 w-full flex flex-col items-center justify-center px-4 py-16"
    >
      <div className="flex flex-col items-center w-full max-w-screen-md gap-6">
        <Typography variant="h2" component="h2" className="text-center">
          The Abbottland Promise
        </Typography>
        <HorizontalRule className="w-full" />

        <PromiseAnimation animated={animationsEnabled} />

        <div className="flex flex-col gap-4 text-center max-w-2xl">
          <Typography variant="body1" component="p">
            Before AI, reading on the internet carried an unspoken contract:
            your attention for something real. That went without saying.
          </Typography>
          <Typography variant="body1" component="p">
            It no longer does.
          </Typography>
          <Typography variant="body1" component="p">
            AI may help me sketch an outline, spark an idea, or workshop a bad
            joke, but it does not write the articles you read here.
          </Typography>
          <Typography variant="body1" component="p">
            Every post and every diagram on this site is written by a human - me
            - with ten fingers.
          </Typography>
          <Typography variant="body1" component="p" className="mb-6">
            That contract still holds here.
          </Typography>
          <TransparentPanel color="default" className="w-full">
            <div className="flex items-center justify-center gap-3">
              <Icon
                name="radix-info"
                size={24}
                className="text-primary-500 shrink-0"
              />
              <Typography variant="body1" component="p">
                All AI-generated text on this site is explicitly labeled.
              </Typography>
            </div>
          </TransparentPanel>
        </div>
      </div>
    </div>
  );
}
