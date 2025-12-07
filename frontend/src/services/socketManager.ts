import io, { Socket } from 'socket.io-client';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

interface SocketManagerConfig {
  url: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  reconnectDelayMax?: number;
  heartbeatInterval?: number;
  timeout?: number;
}

interface ReconnectionInfo {
  attempts: number;
  isReconnecting: boolean;
  lastRoom?: string;
  lastGameId?: string;
  pendingActions: Array<{ event: string; data: any; callback?: Function }>;
}

class SocketManager {
  private socket: Socket | null = null;
  private config: SocketManagerConfig;
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private currentStatus: ConnectionStatus = 'disconnected';
  private reconnectionInfo: ReconnectionInfo = {
    attempts: 0,
    isReconnecting: false,
    pendingActions: []
  };
  // COMMENTED OUT: Custom heartbeat causing issues, using Socket.IO's built-in instead
  // private heartbeatTimer: NodeJS.Timeout | null = null;
  // private missedHeartbeats = 0;
  // private maxMissedHeartbeats = 5; // Increased from 3 to 5 for more tolerance
  // private lastPongTime: number = Date.now();

  constructor(config: SocketManagerConfig) {
    this.config = {
      reconnectAttempts: config.reconnectAttempts || 10,
      reconnectDelay: config.reconnectDelay || 1000,
      reconnectDelayMax: config.reconnectDelayMax || 30000,
      heartbeatInterval: config.heartbeatInterval || 20000, // Align with server's 25s ping interval
      timeout: config.timeout || 30000, // Match server's connectTimeout
      ...config
    };
  }

  public connect(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    console.log(this.socket?.connected)
    console.log(this.currentStatus)
    this.updateStatus('connecting');
    
    this.socket = io(this.config.url, {
      forceNew: true,
      reconnection: true, // We'll handle reconnection manually
      timeout: this.config.timeout,
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
    // this.startHeartbeat(); // COMMENTED OUT: Using Socket.IO's built-in heartbeat
    
    return this.socket;
  }

  private setupEventHandlers(): void {
    console.log(this.socket)
    if (!this.socket) return;

    this.socket.on('connect', () => {
      // console.log('✅ Socket connected successfully - ID:', this.socket?.id);
      console.log('🔗 Connected to:', this.config.url);
      this.updateStatus('connected');
      this.reconnectionInfo.attempts = 0;
      this.reconnectionInfo.isReconnecting = false;
      // this.missedHeartbeats = 0; // COMMENTED OUT: Using Socket.IO's built-in heartbeat
      
      // Process pending actions
      this.processPendingActions();
      
      // Rejoin room if we were in one
      if (this.reconnectionInfo.lastRoom) {
        this.rejoinRoom();
      }
    });

    this.socket.on('disconnect', (reason: string) => {
      // console.log('Socket disconnected:', reason);
      this.updateStatus('disconnected');
      
      // Stop heartbeat when disconnected
      // this.stopHeartbeat(); // COMMENTED OUT: Using Socket.IO's built-in heartbeat
      
      // Attempt to reconnect if not a manual disconnect
      if (reason !== 'io client disconnect' && reason !== 'io server disconnect') {
        this.attemptReconnect();
      }
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('Connection error:', error.message);
      this.updateStatus('error');
      
      // Only attempt reconnect if we're not already reconnecting
      if (!this.reconnectionInfo.isReconnecting) {
        this.attemptReconnect();
      }
    });

    // Heartbeat handling
    // COMMENTED OUT: Using Socket.IO's built-in ping/pong mechanism
    /*
    this.socket.on('pong', () => {
      const timestamp = new Date().toISOString();
      this.lastPongTime = Date.now();
      // console.log(`[Heartbeat] ✅ Received pong at ${timestamp} - Missed heartbeats reset to 0`);
      this.missedHeartbeats = 0;
    });
    */

    // Custom reconnection success event
    this.socket.on('reconnected', (data: any) => {
      // console.log('Successfully reconnected to room:', data);
      this.reconnectionInfo.lastRoom = data.room;
      this.reconnectionInfo.lastGameId = data.gameId;
    });
  }

  // COMMENTED OUT: Custom heartbeat implementation causing issues
  // Using Socket.IO's built-in ping/pong mechanism instead
  /*
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.connected) {
        const timestamp = new Date().toISOString();
        const timeSinceLastPong = Date.now() - this.lastPongTime;
        // console.log(`[Heartbeat] 📤 Sending ping at ${timestamp} - Current missed: ${this.missedHeartbeats}, Time since last pong: ${timeSinceLastPong}ms`);
        
        this.socket.emit('ping');
        this.missedHeartbeats++;
        
        // Only disconnect if we've missed too many AND it's been a long time since last pong
        if (this.missedHeartbeats > this.maxMissedHeartbeats && timeSinceLastPong > 60000) {
          console.error(`[Heartbeat] ❌ Too many missed heartbeats (${this.missedHeartbeats}/${this.maxMissedHeartbeats}), no pong for ${timeSinceLastPong}ms - connection appears dead`);
          this.socket.disconnect();
          this.attemptReconnect();
        } else if (this.missedHeartbeats > this.maxMissedHeartbeats) {
          console.warn(`[Heartbeat] ⚠️  Missed ${this.missedHeartbeats} heartbeats but only ${timeSinceLastPong}ms since last pong - giving more time`);
        }
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      // console.log('[Heartbeat] 🛑 Stopping heartbeat timer');
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.missedHeartbeats = 0;
  }
  */

  private attemptReconnect(): void {
    console.log(this.socket)
    if (this.reconnectionInfo.isReconnecting || 
        this.reconnectionInfo.attempts >= this.config.reconnectAttempts!) {
      if (this.reconnectionInfo.attempts >= this.config.reconnectAttempts!) {
        console.error('Max reconnection attempts reached');
        this.updateStatus('error');
      }
      return;
    }

    this.reconnectionInfo.isReconnecting = true;
    this.reconnectionInfo.attempts++;
    this.updateStatus('reconnecting');

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.config.reconnectDelay! * Math.pow(2, this.reconnectionInfo.attempts - 1),
      this.config.reconnectDelayMax!
    );

    // console.log(`Attempting to reconnect (attempt ${this.reconnectionInfo.attempts}/${this.config.reconnectAttempts}) in ${delay}ms...`);

    setTimeout(() => {
      if (this.socket && !this.socket.connected) {
        this.socket.connect();
      } else {
        this.connect();
      }
    }, delay);
  }

  private rejoinRoom(): void {
    if (!this.socket || !this.reconnectionInfo.lastRoom) return;

    // console.log('Attempting to rejoin room:', this.reconnectionInfo.lastRoom);
    
    this.socket.emit('rejoinRoom', {
      room: this.reconnectionInfo.lastRoom,
      gameId: this.reconnectionInfo.lastGameId,
    }, (response: any) => {
      if (response.success) {
        // console.log('Successfully rejoined room');
        // Emit custom event for components to sync state
        this.socket!.emit('roomRejoined', {
          room: this.reconnectionInfo.lastRoom,
          gameId: this.reconnectionInfo.lastGameId,
        });
      } else {
        console.error('Failed to rejoin room:', response.error);
      }
    });
  }

  private processPendingActions(): void {
    const actions = [...this.reconnectionInfo.pendingActions];
    this.reconnectionInfo.pendingActions = [];
    
    actions.forEach(action => {
      // console.log('Processing pending action:', action.event);
      this.emit(action.event, action.data, action.callback);
    });
  }

  public emit(event: string, data?: any, callback?: Function): void {
    if (!this.socket) {
      console.error('Socket not initialized');
      return;
    }

    if (this.socket.connected) {
      if (callback) {
        this.socket.emit(event, data, callback);
      } else {
        this.socket.emit(event, data);
      }
    } else {
      // Buffer the action if disconnected
      // console.log('Buffering action for reconnection:', event);
      this.reconnectionInfo.pendingActions.push({ event, data, callback });
    }
  }

  public on(event: string, handler: (...args: any[]) => void): void {
    if (!this.socket) {
      console.error('Socket not initialized');
      return;
    }
    this.socket.on(event, handler);
  }

  public off(event: string, handler?: (...args: any[]) => void): void {
    if (!this.socket) return;
    
    if (handler) {
      this.socket.off(event, handler);
    } else {
      this.socket.off(event);
    }
  }

  public setRoomInfo(room: string, gameId?: string): void {
    this.reconnectionInfo.lastRoom = room;
    this.reconnectionInfo.lastGameId = gameId;
  }

  public clearRoomInfo(): void {
    this.reconnectionInfo.lastRoom = undefined;
    this.reconnectionInfo.lastGameId = undefined;
  }

  public disconnect(): void {
    // this.stopHeartbeat(); // COMMENTED OUT: Using Socket.IO's built-in heartbeat
    this.reconnectionInfo = {
      attempts: 0,
      isReconnecting: false,
      pendingActions: []
    };
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.updateStatus('disconnected');
  }

  private updateStatus(status: ConnectionStatus): void {
    if (this.currentStatus !== status) {
      this.currentStatus = status;
      this.statusListeners.forEach(listener => listener(status));
    }
  }

  public onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    // Return unsubscribe function
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public getStatus(): ConnectionStatus {
    return this.currentStatus;
  }

  public isConnected(): boolean {
    return this.socket?.connected || false;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }
}

// Create singleton instance
const socketManager = new SocketManager({
  url: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:4000',
});

export default socketManager;
