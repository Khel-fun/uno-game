/**
 * Smart logger that uses console.log in development and winston in production
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

interface Logger {
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  debug: (...args: any[]) => void;
}

let log: Logger;

if (isDevelopment) {
  // Development: Use console.log
  log = {
    info: (...args: any[]) => console.log('[INFO]', ...args),
    warn: (...args: any[]) => console.warn('[WARN]', ...args),
    error: (...args: any[]) => console.error('[ERROR]', ...args),
    debug: (...args: any[]) => console.log('[DEBUG]', ...args),
  };
} else {
  // Production: Use winston logger
  const logger = require('./logger').default;
  log = {
    info: (...args: any[]) => logger.info(args.join(' ')),
    warn: (...args: any[]) => logger.warn(args.join(' ')),
    error: (...args: any[]) => logger.error(args.join(' ')),
    debug: (...args: any[]) => logger.debug(args.join(' ')),
  };
}

export default log;
