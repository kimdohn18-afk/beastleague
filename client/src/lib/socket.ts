'use client';
import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export function getSocket(token: string): Socket {
  if (!socketInstance || !socketInstance.connected) {
    socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000', {
      auth: { token },
      autoConnect: true,
    });
  }
  return socketInstance;
}

export function useSocket() {
  const { data: session } = useSession();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!session?.accessToken) return;
    const socket = getSocket(session.accessToken);
    socketRef.current = socket;

    return () => {
      // 컴포넌트 언마운트 시 룸만 떠남 (전체 연결 해제 X)
    };
  }, [session?.accessToken]);

  return socketRef.current;
}
