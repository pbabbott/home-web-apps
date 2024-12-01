import React, { useState, FocusEvent } from "react";
import ActiveOrnament from "./ActiveOrnament";
import { extendedTwMerge } from "../../utils/extendTwMerge";
import { InputColor } from "./types";
import { getSvgColorClasses } from "./ColorHelpers";


export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  color: InputColor;
}

const getContainerColorClasses = (color: InputColor) => {
  const colors = {
    default: "",
    primary: "",
  };
  return colors[color] || "";
};

const getInputColorClasses = (color: InputColor) => {
  const colors = {
    default: "bg-neutral-600 border-neutral-300",
    primary: "bg-primary-900 border-primary-300",
  };
  return colors[color] || "";
};

export const Input: React.FC<InputProps> = ({
  color = "default",
  onFocus,
  onBlur,
  ...props
}) => {
  const [isActive, setIsActive] = useState(false);

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    setIsActive(true);
    onFocus?.(e);
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    setIsActive(false);
    onBlur?.(e);
  };

  const baseClasses = "relative";
  const baseInputClasses =
    "border focus:outline-none focus:ring-0 active:outline-none px-2";

  const containerColorClasses = getContainerColorClasses(color);
  const inputColorClasses = getInputColorClasses(color);

  const svgColorClasses = getSvgColorClasses(color)

  const svgHeight = 4;

  return (
    <div className={extendedTwMerge(baseClasses, containerColorClasses)}>
      <input
        className={extendedTwMerge(baseInputClasses, inputColorClasses)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
      <svg
        className="absolute -bottom-[4px] left-0 right-[20px] w-full"
        height={svgHeight}
      >
        <line
          x1="0"
          y1="2"
          x2="100%"
          y2="2"
          className={extendedTwMerge("stroke-2", svgColorClasses.line)}
          shapeRendering="crispEdges"
        />
      </svg>
      {isActive && (
        <ActiveOrnament color={color} />
      )}
    </div>
  );
};
