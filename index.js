/**
 * SmartSocket Client - Main Entry Point
 * 
 * Exports all client-side modules for convenient imports
 */

export { default as SmartSocketClient } from './SmartSocketClient.js';
export { BinaryEncoder } from './BinaryEncoder.js';
export { logger } from './logger.js';

// Re-export as default for backwards compatibility
import SmartSocketClient from './SmartSocketClient.js';
export default SmartSocketClient;
