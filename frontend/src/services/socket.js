import socketManager from './socketManager';

// Create a backward-compatible socket instance
const socket = socketManager.connect();

// Export both the socket and the manager for components that need advanced features
export { socketManager };
export default socket;