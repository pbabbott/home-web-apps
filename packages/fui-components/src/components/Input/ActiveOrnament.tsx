import { useRef, useEffect, useMemo } from 'react';
import { extendedTwMerge } from '../../utils/extendTwMerge';
import anime from 'animejs';
import type { InputColor } from './types';
import { getSvgColorClasses } from './ColorHelpers';

const useRefs = <T extends SVGElement | HTMLElement>() => {
  const refsByKey = useRef<Record<string, T | null>>({});

  const setRef = (element: T | null, key: string) => {
    refsByKey.current[key] = element;
  };
  return { refsByKey: refsByKey.current, setRef };
};

const ActiveOrnament = ({ color }: { color: InputColor }) => {
  const svgHeight = 4;

  const colorClasses = getSvgColorClasses(color);

  const lineClasses = extendedTwMerge('stroke-2', colorClasses.line);
  const innerCircleClasses = extendedTwMerge(lineClasses, colorClasses.circle);

  const lineCount = 5;
  const lineSpacing = 5;

  const ornamentSvgWidth = 120;
  const circleStartRadius = 0;
  const outerCircleRadius = 12;
  const innerCircleRadius = 4;

  const ornamentXOffset = 4;
  const ornamentSvgHeight = 60;

  const underlineRef = useRef<SVGLineElement | null>(null);
  const underlineExtension = useRef<SVGLineElement | null>(null);
  const diagonalLine = useRef<SVGLineElement | null>(null);
  const outerCircle = useRef<SVGCircleElement | null>(null);
  const innerCircle = useRef<SVGCircleElement | null>(null);

  const { refsByKey, setRef } = useRefs<SVGElement>();

  const diagonalStartCoordinate = {
    x: '50%',
    y: ornamentSvgHeight - 2,
  };

  const circleCoordinate = { ...diagonalStartCoordinate };

  const diagonalEndCoordinate = useMemo(() => {
    return {
      // 2  for padding against svg boundary
      // 20 to make the line less jagged
      x: ornamentSvgWidth - outerCircleRadius - 2 - 20,
      y: 0 + outerCircleRadius + 2,
    };
  }, []);

  useEffect(() => {
    if (
      underlineRef.current &&
      underlineExtension.current &&
      diagonalLine.current &&
      outerCircle.current &&
      innerCircle.current
    ) {
      const timeline = anime
        .timeline({
          easing: 'easeOutExpo',
          duration: 550,
        })
        .add({
          targets: underlineRef.current,
          strokeDashoffset: [anime.setDashoffset, 0],
          easing: 'easeInOutSine',
          duration: 200,
        })
        .add(
          {
            targets: underlineExtension.current,
            strokeDashoffset: [anime.setDashoffset, 0],
            easing: 'easeInOutSine',
            duration: 50,
          },
          '-=50',
        )
        .add({
          targets: diagonalLine.current,
          strokeDashoffset: [anime.setDashoffset, 0],
          easing: 'easeInOutSine',
          duration: 150,
        })
        .add(
          {
            targets: outerCircle.current,
            cx: diagonalEndCoordinate.x + 'px',
            cy: diagonalEndCoordinate.y + 'px',
            r: outerCircleRadius + 'px',
            duration: 150,
          },
          '-=150',
        )
        .add(
          {
            targets: innerCircle.current,
            cx: diagonalEndCoordinate.x + 'px',
            cy: diagonalEndCoordinate.y + 'px',
            r: innerCircleRadius + 'px',
            duration: 150,
          },
          '-=150',
        );

      [...Array(lineCount)].forEach((_, i) => {
        // Delay is reduced with more lines
        const delayMultiplier = (lineCount - i) / lineCount;
        const delay = i * 10 * delayMultiplier;
        timeline.add(
          {
            targets: refsByKey[i],
            strokeDashoffset: [anime.setDashoffset, 0],
            easing: 'easeInOutQuad',
            duration: 250,
            delay,
          },
          '-=200',
        );
      });
    }
  }, [diagonalEndCoordinate, refsByKey]);

  return (
    <>
      <div className="absolute -bottom-[8px] left-0">
        <svg className="w-full" height={svgHeight}>
          {/* Underline */}
          <line
            x1="0"
            y1={svgHeight - 2}
            x2="100%"
            y2={svgHeight - 2}
            ref={underlineRef}
            className={lineClasses}
            shapeRendering="crispEdges"
          />
        </svg>
      </div>
      <div className="absolute -bottom-[8px] left-full -right-[120px]">
        <svg className="w-full" height={ornamentSvgHeight}>
          {/* Underline extension Line */}
          <line
            x1="0"
            y1={ornamentSvgHeight - 2}
            x2="50%"
            y2={ornamentSvgHeight - 2}
            className={lineClasses}
            ref={underlineExtension}
            shapeRendering="crispEdges"
          />
          {/* Diagonal Line */}
          <line
            x1={diagonalStartCoordinate.x}
            y1={diagonalStartCoordinate.y}
            x2={diagonalEndCoordinate.x}
            y2={diagonalEndCoordinate.y}
            ref={diagonalLine}
            className={lineClasses}
            shapeRendering="crispEdges"
          />
          {/* Circles follow the diagonal Line */}
          <circle
            cx={circleCoordinate.x}
            cy={circleCoordinate.y}
            r={circleStartRadius}
            ref={outerCircle}
            shapeRendering="crispEdges"
            className={extendedTwMerge(lineClasses, 'fill-none')}
          />
          <circle
            cx={circleCoordinate.x}
            cy={circleCoordinate.y}
            r={circleStartRadius}
            ref={innerCircle}
            shapeRendering="crispEdges"
            className={innerCircleClasses}
          />

          {/* Accent lines */}
          <>
            {[...Array(lineCount)].map((_, index) => {
              return (
                <line
                  key={index}
                  ref={(element) => setRef(element, '' + index)}
                  className={lineClasses}
                  shapeRendering="crispEdges"
                  x2={ornamentXOffset + index * lineSpacing}
                  x1={ornamentXOffset + index * lineSpacing}
                  y2={ornamentSvgHeight * (0.15 * index)}
                  y1={ornamentSvgHeight - 2}
                />
              );
            })}
          </>
        </svg>
      </div>
    </>
  );
};

export default ActiveOrnament;
