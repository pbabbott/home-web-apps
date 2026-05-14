import { outerPolyStr } from './constants';

export function HexagonButtonDefs() {
  return (
    <defs>
      <linearGradient id="shimmerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#00d4ff" stopOpacity="0" />
        <stop offset="30%" stopColor="#00d4ff" stopOpacity="0" />
        <stop offset="47%" stopColor="#b0eeff" stopOpacity="0.06" />
        <stop offset="50%" stopColor="white" stopOpacity="0.09" />
        <stop offset="53%" stopColor="#b0eeff" stopOpacity="0.06" />
        <stop offset="70%" stopColor="#00d4ff" stopOpacity="0" />
        <stop offset="100%" stopColor="#00d4ff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="glossGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="white" stopOpacity="0.25" />
        <stop offset="50%" stopColor="white" stopOpacity="0.04" />
        <stop offset="100%" stopColor="white" stopOpacity="0" />
      </linearGradient>
      <clipPath id="hexClip">
        <polygon points={outerPolyStr} />
      </clipPath>
      <filter id="travelGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="innerGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="4" />
      </filter>
    </defs>
  );
}
