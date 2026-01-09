// SmartSocket Client - Real-time messaging with Namespaces, Acknowledgments, and Advanced Features
import { logger } from './logger.js';
import { BinaryEncoder } from './BinaryEncoder.js';

class SmartSocketClient {
  constructor(url, options = {}) {
    // Support both old and new API
    // Old: new SmartSocketClient(url, apiKey)
    // New: new SmartSocketClient(url, { apiKey, enableNamespaces: true, ... })
    if (typeof options === 'string') {
      options = { apiKey: options };
    }

    this.url = url;
    this.apiKey = options.apiKey;
    this.socket = null;
    this.listeners = {};
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.reconnectDelay = options.reconnectDelay || 1000;
    
    // Feature flags
    this.enableNamespaces = options.enableNamespaces !== false;
    this.enableAcknowledgments = options.enableAcknowledgments !== false;
    this.enableErrorHandling = options.enableErrorHandling !== false;
    
    // Namespace handling
    this.namespace = options.namespace || '/';
    
    // Acknowledgment handling
    this.acks = new Map();
    this.ackCounter = 0;
    this.ackTimeout = options.ackTimeout || 30000;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        // Build correct WebSocket URL with namespace path
        let connectUrl = this.url;
        if (this.enableNamespaces && this.namespace !== '/') {
          // Remove trailing slash from url if present
          if (connectUrl.endsWith('/')) {
            connectUrl = connectUrl.slice(0, -1);
          }
          // Append namespace path
          connectUrl = connectUrl + this.namespace;
        }

        this.socket = new WebSocket(connectUrl);

        this.socket.onopen = () => {
          logger.log(`[SmartSocket] Connected to ${this.namespace}`);
          this.connected = true;
          this.reconnectAttempts = 0;
          this.reconnectDelay = this.reconnectDelay || 1000;
          this.emit('connected');
          resolve();
        };

        this.socket.onmessage = async (event) => {
          try {
            const messageData = event.data;
            const decoded = await BinaryEncoder.decode(messageData);
            
            if (!decoded) return;

            // Handle acknowledgments if enabled
            if (this.enableAcknowledgments && decoded.data && decoded.data._ackId) {
              const ackId = decoded.data._ackId;
              if (this.acks.has(ackId)) {
                const { resolve } = this.acks.get(ackId);
                this.acks.delete(ackId);
                resolve(decoded.data);
                return;
              }
            }

            // Regular event emission
            if (decoded && decoded.event) {
              this.emit(decoded.event, decoded.data);
            }
          } catch (e) {
            logger.error('[SmartSocket] Failed to decode message:', e);
          }
        };

        this.socket.onerror = (error) => {
          logger.error('[SmartSocket] WebSocket error:', error);
          this.connected = false;
          this.emit('error', error);
        };

        this.socket.onclose = () => {
          logger.log('[SmartSocket] Disconnected from server');
          this.connected = false;
          this.emit('disconnected');
          
          // Automatic reconnection with exponential backoff
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1), 30000);
            logger.log(`[SmartSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
              logger.log('[SmartSocket] Attempting to reconnect...');
              this.connect().catch((err) => {
                logger.error('[SmartSocket] Reconnection failed:', err.message);
              });
            }, delay);
          } else {
            logger.error('[SmartSocket] Max reconnection attempts reached');
          }
          
          reject(new Error('WebSocket connection closed'));
        };
      } catch (error) {
        logger.error('[SmartSocket] Connection error:', error);
        reject(error);
      }
    });
  }

  /**
   * Send message with optional acknowledgment
   */
  async send(event, payload, onAck) {
    if (!this.connected || !this.socket) {
      logger.error('[SmartSocket] Not connected');
      return false;
    }

    try {
      let messagePayload = payload;

      // Handle acknowledgment if callback provided and enabled
      if (onAck && this.enableAcknowledgments && typeof onAck === 'function') {
        const ackId = ++this.ackCounter;
        messagePayload = { ...payload, _ackId: ackId };

        const ackPromise = new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            this.acks.delete(ackId);
            reject(new Error(`Acknowledgment timeout for ${event}`));
          }, this.ackTimeout);

          this.acks.set(ackId, { resolve, reject, timer });
        });

        // Fire and forget with callback
        ackPromise
          .then((data) => onAck(null, data))
          .catch((err) => onAck(err, null));
      }

      const encoded = await BinaryEncoder.encode(event, messagePayload);
      
      if (Array.isArray(encoded)) {
        for (const chunk of encoded) {
          this.socket.send(chunk);
        }
      } else {
        this.socket.send(encoded);
      }
      return true;
    } catch (error) {
      logger.error('[SmartSocket] Send error:', error);
      return false;
    }
  }

  /**
   * Send with await-able acknowledgment
   */
  async emit(event, payload) {
    if (!this.connected || !this.socket) {
      logger.error('[SmartSocket] Not connected');
      return false;
    }

    try {
      const encoded = await BinaryEncoder.encode(event, payload);
      
      if (Array.isArray(encoded)) {
        for (const chunk of encoded) {
          this.socket.send(chunk);
        }
      } else {
        this.socket.send(encoded);
      }
      return true;
    } catch (error) {
      logger.error('[SmartSocket] Emit error:', error);
      return false;
    }
  }

  /**
   * Listen for events
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return this;
  }

  /**
   * Listen once
   */
  once(event, callback) {
    const wrapper = (data) => {
      callback(data);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
    return this;
  }

  /**
   * Remove listener
   */
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
    return this;
  }

  /**
   * Fire event locally
   */
  fire(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((callback) => {
        try {
          callback(data);
        } catch (err) {
          logger.error(`[SmartSocket] Error in listener for ${event}:`, err);
        }
      });
    }
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    // Clear pending acknowledgments
    for (const [, ack] of this.acks.entries()) {
      clearTimeout(ack.timer);
    }
    this.acks.clear();

    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.connected = false;
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Get client statistics
   */
  getStats() {
    return {
      connected: this.connected,
      namespace: this.namespace,
      reconnectAttempts: this.reconnectAttempts,
      pendingAcks: this.acks.size,
      features: {
        namespaces: this.enableNamespaces,
        acknowledgments: this.enableAcknowledgments,
        errorHandling: this.enableErrorHandling
      }
    };
  }
}

export default SmartSocketClient;
