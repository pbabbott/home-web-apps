import React from 'react';

export const ScrollableTable = ({
  children,
}: {
  children: React.ReactNode;
}) => <div className="overflow-x-auto w-full mb-8">{children}</div>;
