import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import express from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { setupSwagger } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bodyParser: false,
  });
  app.use(cookieParser());

  // Resilient JSON body parser that preserves rawBody and handles escaped control chars
  app.use(
    express.text({
      type: 'application/json',
      limit: '1000mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(
    (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      if (typeof req.body === 'string' && req.body.trim().length > 0) {
        try {
          req.body = JSON.parse(req.body);
        } catch {
          try {
            // Replace raw unescaped control characters inside JSON strings (e.g. carriage returns, raw newlines)
            const sanitized = req.body.replace(/[\x00-\x1F\x7F]/g, (char) => {
              if (char === '\n') return '\\n';
              if (char === '\r') return '';
              if (char === '\t') return '\\t';
              return '';
            });
            req.body = JSON.parse(sanitized);
          } catch (err) {
            return next(err);
          }
        }
      } else if (typeof req.body === 'string' && req.body.trim().length === 0) {
        req.body = {};
      }
      next();
    },
  );
  app.use(express.urlencoded({ extended: true, limit: '1000mb' }));

  // Strict CORS Configuration (prevents wildcard origin credential leaks)
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL.trim());
  }

  const devOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:4173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5173',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isAllowed =
        allowedOrigins.includes(origin) ||
        (process.env.NODE_ENV !== 'production' &&
          devOrigins.some((dev) => origin.startsWith(dev)));
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`CORS origin '${origin}' not allowed by policy`));
      }
    },
    credentials: true,
  });

  // Global API Version Prefix (routes mounted at /api/v1/...)
  app.setGlobalPrefix('api/v1', { exclude: ['/', 'docs'] });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());

  // Initialize Swagger documentation with custom dark theme
  setupSwagger(app);

  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
