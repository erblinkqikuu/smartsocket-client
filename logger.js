// Logger utility - always log in test/debug mode
const isDev = true; // Always enabled for now

export const logger = {
  log: (...args) => {
    if (isDev) console.log('[Client]', ...args);
  },
  error: (...args) => {
    if (isDev) console.error('[Client]', ...args);
  },
  warn: (...args) => {
    if (isDev) console.warn('[Client]', ...args);
  },
  debug: (...args) => {
    if (isDev) console.debug('[Client]', ...args);
  }
};

export default logger;
