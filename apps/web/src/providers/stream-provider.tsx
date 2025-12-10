'use client';

import { MotiaStreamProvider } from '@motiadev/stream-client-react';

const STREAM_WS_URL = process.env.NEXT_PUBLIC_STREAM_WS_URL || 'ws://localhost:3000';

export function StreamProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotiaStreamProvider address={STREAM_WS_URL}>
      {children}
    </MotiaStreamProvider>
  );
}
