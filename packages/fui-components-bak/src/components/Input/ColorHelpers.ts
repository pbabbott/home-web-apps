import { InputColor } from './types';

export const getSvgColorClasses = (color: InputColor) => {
  const colors = {
    primary: {
      line: 'stroke-primary-300',
      circle: 'fill-primary-300',
    },
    default: {
      line: 'stroke-neutral-300',
      circle: 'fill-neutral-300',
    },
  };
  return colors[color] || '';
};
