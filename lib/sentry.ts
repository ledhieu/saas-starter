import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0,
  });
}

export function captureException(error: unknown): void {
  try {
    Sentry.captureException(error);
  } catch (sentryError) {
    console.error('Sentry capture failed:', sentryError);
    console.error('Original error:', error);
  }
}
