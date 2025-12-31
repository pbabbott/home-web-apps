'use client';

import type { MDXComponents } from 'mdx/types';
import { Typography } from '@abbottland/fui-components';
import { DiagramViewer } from './src/components/diagram';
// See: https://nextjs.org/docs/app/api-reference/file-conventions/mdx-components

const baseClasses = 'not-prose mb-8';

const components: MDXComponents = {
  h1: ({ children, ...props }) => (
    <Typography className={baseClasses} variant="h1" component="h1" {...props}>
      {children}
    </Typography>
  ),
  h2: ({ children, ...props }) => (
    <Typography className={baseClasses} variant="h2" component="h2" {...props}>
      {children}
    </Typography>
  ),
  h3: ({ children, ...props }) => (
    <Typography className={baseClasses} variant="h3" component="h3" {...props}>
      {children}
    </Typography>
  ),
  h4: ({ children, ...props }) => (
    <Typography className={baseClasses} variant="h4" component="h4" {...props}>
      {children}
    </Typography>
  ),
  h5: ({ children, ...props }) => (
    <Typography className={baseClasses} variant="h5" component="h5" {...props}>
      {children}
    </Typography>
  ),
  h6: ({ children, ...props }) => (
    <Typography className={baseClasses} variant="h6" component="h6" {...props}>
      {children}
    </Typography>
  ),
  p: ({ children, ...props }) => (
    <Typography
      className={baseClasses}
      variant="body1"
      component="p"
      {...props}
    >
      {children}
    </Typography>
  ),
  span: ({ children, ...props }) => (
    <Typography
      className="not-prose"
      variant="body1"
      component="span"
      {...props}
    >
      {children}
    </Typography>
  ),
  pre: ({ children, ...props }) => (
    <pre
      className="not-prose whitespace-pre-wrap break-words overflow-wrap-anywhere"
      {...props}
    >
      {children}
    </pre>
  ),
  code: ({ children, ...props }) => (
    <Typography
      variant="body1"
      component="code"
      className="not-prose bg-neutral-900 text-accent-purple-300 px-2 rounded border border-accent-purple-300/50"
      {...props}
    >
      {children}
    </Typography>
  ),
  DiagramViewer,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
