/**
 * SmartSocket Client - Production WebSocket with compression & auto-reconnect
 * 
 * Features: DEFLATE compression, auto-reconnection, rooms, acknowledgments, error handling
 */

export interface SmartSocketClientOptions {
  apiKey?: string;
  enableAcknowledgments?: boolean;
  enableErrorHandling?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  ackTimeout?: number;
}

export interface SmartSocketMessage {
  event: string;
  data: any;
}

export interface SmartSocketEvent {
  connected: void;
  disconnected: void;
  error: Error;
  [eventName: string]: any;
}

export interface SmartSocketStats {
  connected: boolean;
  reconnectAttempts: number;
  pendingAcks: number;
  features: {
    acknowledgments: boolean;
    errorHandling: boolean;
  };
}

export class SmartSocketClient {
  /**
   * Create new SmartSocket client
   * @param url - WebSocket URL (wss:// for production, ws:// for dev)
   * @param options - Configuration options (or apiKey string for backwards compatibility)
   */
  constructor(url: string, options?: SmartSocketClientOptions | string);

  /**
   * Connection status
   */
  connected: boolean;

  /**
   * Current namespace
   */
  namespace: string;

  /**
   * Establish connection to SmartSocket server
   * @throws {Error} Connection failed
   * @returns Promise resolving when connected
   */
  connect(): Promise<void>;

  /**
   * Gracefully disconnect and cleanup
   */
  disconnect(): void;

  /**
   * Manually trigger reconnection
   */
  reconnect(): void;

  /**
   * Listen to server events with automatic decompression
   * 
   * @param event - Event name to listen for
   * @param callback - Callback function receiving decompressed data
   * 
   * @example
   * socket.on('message', (data) => {
   *   console.log('Received:', data);
   * });
   */
  on<T = any>(event: string, callback: (data: T) => void): this;

  /**
   * Remove event listener
   */
  off(event: string, callback?: Function): this;

  /**
   * Listen for single event then remove
   */
  once<T = any>(event: string, callback: (data: T) => void): this;

  /**
   * Send message to server with optional acknowledgment
   * Automatically handles compression if beneficial
   * 
   * @param event - Event name
   * @param payload - Data to send (will be auto-compressed if beneficial)
   * @param onAck - Optional callback for acknowledgment response
   * @returns true if sent, false if not connected
   * 
   * @example
   * socket.send('message', { text: 'Hello' }, (err, ack) => {
   *   console.log('Server received:', ack);
   * });
   */
  send(event: string, payload: any, onAck?: (error: Error | null, data?: any) => void): Promise<boolean>;

  /**
   * Emit event to server
   * 
   * @param event - Event name
   * @param payload - Data to send
   * @returns true if sent, false if not connected
   * 
   * @example
   * socket.emit('user-joined', { username: 'John' });
   */
  emit(event: string, payload?: any): Promise<boolean>;

  /**
   * Fire event locally (internal use)
   */
  fire(event: string, data?: any): void;

  /**
   * Get client statistics
   */
  getStats(): SmartSocketStats;

  /**
   * Check if connected
   */
  isConnected(): boolean;
