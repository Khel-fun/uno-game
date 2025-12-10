import { Socket } from 'socket.io-client';
import socketManager from './socketManager';

// Initialize connection
socketManager.connect();

// Create a proxy that always gets the current socket from the manager
// This prevents stale socket references when reconnection creates a new socket
const socketProxy = new Proxy({} as Socket, {
  get(target, prop: string | symbol) {
    const currentSocket = socketManager.getSocket();
    if (!currentSocket) {
      if (prop === 'emit' || prop === 'on' || prop === 'off') {
        return (...args: unknown[]) => console.warn(`Socket not initialized, cannot call ${String(prop)}`);
      }
      return undefined;
    }
    const value = currentSocket[prop as keyof Socket];
    return typeof value === 'function' ? (value as Function).bind(currentSocket) : value;
  }
});

// Export both the socket and the manager for components that need advanced features
export { socketManager };
export default socketProxy;