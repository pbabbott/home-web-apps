import { extendTailwindMerge } from "tailwind-merge";

export const extendedTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "text-h1",
        "text-h2",
        "text-h3",
        "text-h4",
        "text-h5",
        "text-h6",
        "text-body1",
        "text-body2",
        "text-button",
        "text-small",
        "text-caption"
    ],
    },
  },
});
