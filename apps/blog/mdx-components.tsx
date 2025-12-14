'use client';

import type { MDXComponents } from 'mdx/types';
import { Typography } from '@abbottland/fui-components';
// See: https://nextjs.org/docs/app/api-reference/file-conventions/mdx-components

const components: MDXComponents = {
  h1: ({ children, ...props }) => (
    <Typography variant="h1" component="h1" {...props}>
      {children}
    </Typography>
  ),
  h2: ({ children, ...props }) => (
    <Typography variant="h2" component="h2" {...props}>
      {children}
    </Typography>
  ),
  h3: ({ children, ...props }) => (
    <Typography variant="h3" component="h3" {...props}>
      {children}
    </Typography>
  ),
  h4: ({ children, ...props }) => (
    <Typography variant="h4" component="h4" {...props}>
      {children}
    </Typography>
  ),
  h5: ({ children, ...props }) => (
    <Typography variant="h5" component="h5" {...props}>
      {children}
    </Typography>
  ),
  h6: ({ children, ...props }) => (
    <Typography variant="h6" component="h6" {...props}>
      {children}
    </Typography>
  ),
  p: ({ children, ...props }) => (
    <Typography variant="body1" component="p" {...props}>
      {children}
    </Typography>
  ),
  span: ({ children, ...props }) => (
    <Typography variant="body1" component="span" {...props}>
      {children}
    </Typography>
  ),
};

export function useMDXComponents(): MDXComponents {
  return components;
}
