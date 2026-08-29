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
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(cookieParser());

  // Resilient JSON body parser that sanitizes unescaped control characters
  app.use(express.text({ type: 'application/json', limit: '10mb' }));
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
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
  });
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.enableCors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
  });
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
