'use client';
import type { ReactNode } from 'react';
import PageScrollbar from '@/components/PageScrollbar/PageScrollbar';

export default function PageScrollLayout({
  children,
  wrapperClassName = '',
  railClassName,
}: {
  children: ReactNode;
  wrapperClassName?: string;
  railClassName?: string;
}) {
  return (
    <>
      <div className={`pr-4 md:pr-6 ${wrapperClassName}`}>{children}</div>
      <PageScrollbar className={railClassName} />
    </>
  );
}
