import React from "react";
import { PanelColor } from "./types";

const getSquareColorClass = (color: PanelColor) => {
  const colors = {
    default: "fill-neutral-600",
    white: "fill-neutral-50",
    primary: "fill-primary-300",
    secondary: "fill-secondary-200",
    success: "fill-success-100",
    error: "fill-error-200",
    warning: "fill-warning-100",
    "accent-purple": "fill-accent-purple-100",
    "accent-falcon": "fill-accent-falcon-200",
  };
  return colors[color] || "";
};

export interface CornerSquaresProps {
  color: PanelColor;
}

const CornerSquares: React.FC<CornerSquaresProps> = ({ color }) => {
  const squareSize = 8;
  const squareColor = getSquareColorClass(color);
  return (
    <>
      <svg
        className="absolute top-0 left-0"
        width={squareSize}
        height={squareSize}
        viewBox={`0 0 ${squareSize} ${squareSize}`}
      >
        <rect width={squareSize} height={squareSize} className={squareColor} />
      </svg>

      <svg
        className="absolute top-0 right-0"
        width={squareSize}
        height={squareSize}
        viewBox={`0 0 ${squareSize} ${squareSize}`}
      >
        <rect width={squareSize} height={squareSize} className={squareColor} />
      </svg>

      <svg
        className="absolute bottom-0 left-0"
        width={squareSize}
        height={squareSize}
        viewBox={`0 0 ${squareSize} ${squareSize}`}
      >
        <rect width={squareSize} height={squareSize} className={squareColor} />
      </svg>

      <svg
        className="absolute bottom-0 right-0"
        width={squareSize}
        height={squareSize}
        viewBox={`0 0 ${squareSize} ${squareSize}`}
      >
        <rect width={squareSize} height={squareSize} className={squareColor} />
      </svg>
    </>
  );
};

export default CornerSquares;
