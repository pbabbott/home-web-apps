import { NextResponse } from 'next/server';

export const healthzRoute = async () => {
  return NextResponse.json({ status: 'ok' });
};
