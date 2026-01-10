// SmartSocket connection utility for real-time messaging
import { logger } from './logger.js';
import { BinaryEncoder } from './BinaryEncoder.js';

class SmartSocketClient {
  constructor(url, apiKey, options = {}) {
    this.url = url;
    this.apiKey = apiKey;
    this.socket = null;
    this.listeners = {};
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000; // Start with 1 second
    
    // Feature toggles - match server defaults (all enabled)
    this.features = {
      middleware: options.middleware !== false,
      acknowledgments: options.acknowledgments !== false,
      smartsocketApi: options.smartsocketApi !== false,
      errorHandlers: options.errorHandlers !== false
    };
    
    // Acknowledgment system
    this.pendingAcks = new Map();
    this.ackCounter = 0;
    this.ackTimeout = options.ackTimeout || 15000; // Increased from 5s to 15s for large data
    
    // Error handlers
    this.errorHandlers = {
      'connection-error': null,
      'message-error': null,
      'validation-error': null,
      'ack-timeout': null,
      'receive-error': null
    };
  }

  /**
   * Generate unique acknowledgment ID
   */
  _generateAckId() {
    return `ack_${++this.ackCounter}_${Date.now()}`;
  }

  /**
   * Register acknowledgment handler
   */
  _registerAck(ackId, callback) {
    const timeoutId = setTimeout(() => {
      this.pendingAcks.delete(ackId);
      this._handleError('ack-timeout', { ackId });
      if (callback) callback(new Error('Acknowledgment timeout'));
    }, this.ackTimeout);

    this.pendingAcks.set(ackId, { timeoutId, callback });
  }

  /**
   * Handle incoming acknowledgment
   */
  _handleAckResponse(ackId, response) {
    const ackInfo = this.pendingAcks.get(ackId);
    if (ackInfo) {
      clearTimeout(ackInfo.timeoutId);
      this.pendingAcks.delete(ackId);
      
      if (ackInfo.callback) {
        if (response && response.error) {
          ackInfo.callback(new Error(response.error));
        } else {
          ackInfo.callback(null, response);
        }
      }
    }
  }

  /**
   * Register error handler
   */
  onError(errorType, handler) {
    if (!this.features.errorHandlers) return this;
    
    if (this.errorHandlers.hasOwnProperty(errorType)) {
      this.errorHandlers[errorType] = handler;
    }
    return this;
  }

  /**
   * Handle errors internally
   */
  _handleError(errorType, context = {}) {
    if (!this.features.errorHandlers) return;
    
    const handler = this.errorHandlers[errorType];
    if (handler) {
      try {
        handler(context);
      } catch (err) {
        logger.error(`[SmartSocket] Error in error handler: ${err.message}`);
      }
    }
  }


  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.url);

        this.socket.onopen = () => {
          logger.log('[SmartMessage] Connected to SmartSocket');
          this.connected = true;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000; // Reset delay
          this.emit('connected');
          resolve();
        };

        this.socket.onmessage = async (event) => {
          try {
            // BinaryEncoder automatically handles:
            // - Format detection (binary, compressed, chunked, or JSON)
            // - Decompression using native DecompressionStream
            // - Chunk reassembly
            // - Binary format decoding
            const messageData = event.data;
            const decoded = await BinaryEncoder.decode(messageData);
            
            // If null, it means we're still waiting for more chunks
            if (decoded === null || decoded === undefined) {
              return;
            }
            
            if (decoded && decoded.event) {
              const { event: eventName, data: eventData } = decoded;
              
              // Extract acknowledgment ID if present in data
              let ackId = null;
              if (eventData && eventData.__ackId) {
                ackId = eventData.__ackId;
                delete eventData.__ackId;
              }
              
              // Handle acknowledgment responses from server
              if (eventName === '__ack__' && eventData && eventData.ackId) {
                this._handleAckResponse(eventData.ackId, eventData.response);
                return;
              }
              
              // Execute all listeners for this event
              const result = this.listeners[eventName]?.map(cb => cb(eventData));
              
              // Emit internal event
              this.emit(eventName, eventData);
              
              // Send acknowledgment if server requested it (but NOT for room/broadcast messages)
              if (ackId && this.features.acknowledgments && !eventName.includes(':')) {
                // Use direct send to avoid creating ack for the ack
                try {
                  const encoded = await BinaryEncoder.encode('__ack__', {
                    ackId,
                    response: result ? { success: true, result: result[0] } : { success: true }
                  });
                  if (Array.isArray(encoded)) {
                    for (const chunk of encoded) {
                      this.socket.send(chunk);
                    }
                  } else {
                    this.socket.send(encoded);
                  }
                } catch (err) {
                  logger.error('[SmartSocketClient] Failed to send ack:', err);
                }
              }
            }
          } catch (e) {
            logger.error('[SmartMessage] Failed to decode message:', e);
            this._handleError('receive-error', { error: e.message });
          }
        };

        this.socket.onerror = (error) => {
          logger.error('[SmartMessage] WebSocket error:', error);
          this.connected = false;
          this.emit('error', error);
        };

        this.socket.onclose = () => {
          logger.log('[SmartMessage] Disconnected from SmartSocket');
          this.connected = false;
          this.emit('disconnected');
          
          // Automatic reconnection with exponential backoff
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            logger.log(`[SmartMessage] Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
              logger.log('[SmartMessage] Attempting to reconnect...');
              this.connect().catch((err) => {
                logger.error('[SmartMessage] Reconnection failed:', err.message);
              });
            }, this.reconnectDelay);
            
            // Exponential backoff: increase delay by 1.5x each time, max 30 seconds
            this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
          } else {
            logger.error('[SmartMessage] Max reconnection attempts reached');
          }
          
          reject(new Error('WebSocket connection closed'));
        };
      } catch (error) {
        logger.error('[SmartMessage] Connection error:', error);
        reject(error);
      }
    });
  }

  async send(event, payload, callback = null) {
    if (!this.connected || !this.socket) {
      logger.error('[SmartMessage] Not connected');
      return false;
    }

    try {
      // Add acknowledgment ID if callback provided and feature enabled
      let ackId = null;
      let dataToSend = payload;
      
      if (callback && this.features.acknowledgments) {
        ackId = this._generateAckId();
        dataToSend = { ...payload, __ackId: ackId };
        this._registerAck(ackId, callback);
      }

      // BinaryEncoder automatically handles:
      // - JSON encoding
      // - Compression (if beneficial >15% savings)
      // - Chunking for large messages
      // - Binary format optimization
      const encoded = await BinaryEncoder.encode(event, dataToSend);
      
      if (Array.isArray(encoded)) {
        // Multiple chunks
        for (const chunk of encoded) {
          this.socket.send(chunk);
        }
      } else {
        // Single message
        this.socket.send(encoded);
      }
      return true;
    } catch (error) {
      logger.error('[SmartMessage] Send error:', error);
      this._handleError('message-error', { error: error.message, event });
      return false;
    }
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return this;
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
    return this;
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((callback) => callback(data));
    }
    return this;
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.connected = false;
    }
  }

  isConnected() {
    return this.connected;
  }
}

export default SmartSocketClient;
