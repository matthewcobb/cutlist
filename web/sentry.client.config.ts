import * as Sentry from '@sentry/nuxt';

Sentry.init({
  dsn: 'https://7eaff5b372831b004f21a057b3cbe8ff@o4511273719693312.ingest.de.sentry.io/4511273752002640',
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  debug: false,
});
