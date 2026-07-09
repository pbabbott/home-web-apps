import React from 'react';
import * as RadixSwitch from '@radix-ui/react-switch';
import { extendedTwMerge } from '../../utils/extendTwMerge';

export type SwitchProps = React.ComponentProps<typeof RadixSwitch.Root>;

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  function Switch({ className, ...props }, ref) {
    return (
      <RadixSwitch.Root
        ref={ref}
        className={extendedTwMerge(
          'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center border transition-colors duration-200 outline-none',
          'disabled:cursor-not-allowed disabled:opacity-40',
          'focus-visible:outline-2 focus-visible:outline-primary-400 focus-visible:outline-offset-2',
          'data-[state=unchecked]:bg-primary-950 data-[state=unchecked]:border-primary-900',
          'data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-400',
          className,
        )}
        {...props}
      >
        <RadixSwitch.Thumb
          className={extendedTwMerge(
            'pointer-events-none block h-5 w-5 translate-x-0.5 border border-primary-800 transition-transform duration-200',
            'data-[state=checked]:translate-x-5',
            'data-[state=unchecked]:bg-primary-800',
            'data-[state=checked]:bg-neutral-50',
          )}
        />
      </RadixSwitch.Root>
    );
  },
);
