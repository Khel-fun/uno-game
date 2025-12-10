"use client";

import React from 'react';
import { useSocketConnection } from '@/context/SocketConnectionContext';
import { AlertCircle, Wifi, WifiOff, RefreshCw } from 'lucide-react';

export const ConnectionStatusIndicator: React.FC = () => {
  const { status, isConnected, isReconnecting, reconnect } = useSocketConnection();

  console.log('Socket status:', status, isConnected, isReconnecting);

  // Don't show anything if connected
  if (isConnected) {
    return null;
  }

  const getStatusConfig = () => {
    switch (status) {
      case 'connecting':
        return {
          icon: <RefreshCw className="w-4 h-4 animate-spin" />,
          text: 'Connecting...',
          bgColor: 'bg-yellow-500/90',
          textColor: 'text-white',
        };
      case 'reconnecting':
        return {
          icon: <RefreshCw className="w-4 h-4 animate-spin" />,
          text: 'Reconnecting...',
          bgColor: 'bg-orange-500/90',
          textColor: 'text-white',
        };
      case 'disconnected':
        return {
          icon: <WifiOff className="w-4 h-4" />,
          text: 'Disconnected',
          bgColor: 'bg-red-500/90',
          textColor: 'text-white',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          text: 'Connection Error',
          bgColor: 'bg-red-600/90',
          textColor: 'text-white',
        };
      default:
        return {
          icon: <WifiOff className="w-4 h-4" />,
          text: 'No Connection',
          bgColor: 'bg-gray-500/90',
          textColor: 'text-white',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300">
      <div className={`${config.bgColor} ${config.textColor} px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm flex items-center gap-3`}>
        <div className="flex items-center gap-2">
          {config.icon}
          <span className="text-sm font-medium">{config.text}</span>
        </div>
        
        {(status === 'disconnected' || status === 'error') && !isReconnecting && (
          <button
            onClick={reconnect}
            className="ml-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-medium transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

export const ConnectionStatusBadge: React.FC = () => {
  const { status, isConnected } = useSocketConnection();

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
      case 'reconnecting':
        return 'bg-yellow-500 animate-pulse';
      case 'disconnected':
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
      <span className="text-xs text-gray-600 dark:text-gray-400">
        {isConnected ? 'Online' : 'Offline'}
      </span>
    </div>
  );
};
