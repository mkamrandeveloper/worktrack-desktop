import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { app } from 'electron';

const logsDir = path.join(app.getPath('userData'), 'logs');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, service, stack, ...meta }) => {
    const svc = service ? `[${service}] ` : '';
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    const stackStr = stack ? `\n${stack}` : '';
    return `${timestamp} ${level.toUpperCase().padEnd(5)} ${svc}${message}${extra}${stackStr}`;
  })
);

const transports: winston.transport[] = [
  new DailyRotateFile({
    dirname: logsDir,
    filename: 'worktrack-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: logFormat,
  }),
  new DailyRotateFile({
    dirname: logsDir,
    filename: 'worktrack-error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '30d',
    format: logFormat,
  }),
];

// app.isPackaged is the authoritative signal — a packaged install never has
// NODE_ENV set, which would otherwise leave verbose console logging enabled.
const isDev = !app.isPackaged;

if (isDev) {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      ),
    })
  );
}

const rootLogger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  transports,
  exitOnError: false,
});

/**
 * Creates a child logger with a service name prefix.
 */
export function createLogger(service: string): winston.Logger {
  return rootLogger.child({ service });
}

export const logger = createLogger('Main');

/** Captures uncaught exceptions and unhandled promise rejections */
export function setupCrashReporting(): void {
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  });
}
