"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import socketManager, { type ConnectionStatus } from '@/services/socketManager';

interface SocketConnectionContextType {
  status: ConnectionStatus;
  isConnected: boolean;
  isReconnecting: boolean;
  reconnect: () => void;
  disconnect: () => void;
}

const SocketConnectionContext = createContext<SocketConnectionContextType | undefined>(undefined);

export const useSocketConnection = () => {
  const context = useContext(SocketConnectionContext);
  if (!context) {
    throw new Error('useSocketConnection must be used within a SocketConnectionProvider');
  }
  return context;
};

interface SocketConnectionProviderProps {
  children: ReactNode;
}

export const SocketConnectionProvider: React.FC<SocketConnectionProviderProps> = ({ children }) => {
  const [status, setStatus] = useState<ConnectionStatus>(socketManager.getStatus());
  const [isConnected, setIsConnected] = useState(socketManager.isConnected());
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    // Sync state immediately in case socket connected before mount
    const currentStatus = socketManager.getStatus();
    setStatus(currentStatus);
    setIsConnected(currentStatus === 'connected');
    setIsReconnecting(currentStatus === 'reconnecting');

    // Subscribe to status changes
    const unsubscribe = socketManager.onStatusChange((newStatus) => {
      setStatus(newStatus);
      setIsConnected(newStatus === 'connected');
      setIsReconnecting(newStatus === 'reconnecting');
    });

    // Initial connection if not already connected
    if (!socketManager.isConnected()) {
      socketManager.connect();
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const reconnect = () => {
    socketManager.connect();
  };

  const disconnect = () => {
    socketManager.disconnect();
  };

  return (
    <SocketConnectionContext.Provider
      value={{
        status,
        isConnected,
        isReconnecting,
        reconnect,
        disconnect,
      }}
    >
      {children}
    </SocketConnectionContext.Provider>
  );
};
