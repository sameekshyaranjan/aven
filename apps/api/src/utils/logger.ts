import { env } from '../config/env';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogContext {
  requestId?: string;
  [key: string]: unknown;
}

class Logger {
  private formatLog(level: LogLevel, message: string, context?: LogContext): string {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      environment: env.NODE_ENV,
      ...context,
    };

    return JSON.stringify(entry);
  }

  info(message: string, context?: LogContext): void {
    // eslint-disable-next-line no-console
    console.log(this.formatLog('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    // eslint-disable-next-line no-console
    console.warn(this.formatLog('warn', message, context));
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    let errorDetails: Record<string, unknown> = {};

    if (error instanceof Error) {
      errorDetails = {
        errorName: error.name,
        errorMessage: error.message,
        stack: env.NODE_ENV === 'development' ? error.stack : undefined,
      };
    } else if (error !== undefined) {
      errorDetails = { errorDetails: error };
    }

    // eslint-disable-next-line no-console
    console.error(
      this.formatLog('error', message, {
        ...errorDetails,
        ...context,
      }),
    );
  }

  debug(message: string, context?: LogContext): void {
    if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
      // eslint-disable-next-line no-console
      console.debug(this.formatLog('debug', message, context));
    }
  }
}

export const logger = new Logger();
export default logger;
