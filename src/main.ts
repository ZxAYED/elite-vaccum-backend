import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';

function sanitizeJsonStringLiterals(jsonStr: string): string {
  let inString = false;
  let isEscaped = false;
  let result = '';

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (inString) {
      if (isEscaped) {
        result += char;
        isEscaped = false;
      } else if (char === '\\') {
        result += char;
        isEscaped = true;
      } else if (char === '"') {
        result += char;
        inString = false;
      } else if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else if (char === '\t') {
        result += '\\t';
      } else if (char.charCodeAt(0) < 32) {
        result += '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0');
      } else {
        result += char;
      }
    } else {
      if (char === '"') {
        inString = true;
      }
      result += char;
    }
  }

  return result;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use((req: Request, res: Response, next: NextFunction) => {
    const contentType = req.headers['content-type'] || '';
    if (
      req.method !== 'GET' &&
      req.method !== 'HEAD' &&
      typeof contentType === 'string' &&
      contentType.includes('application/json')
    ) {
      let rawData = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => {
        rawData += chunk;
      });
      req.on('end', () => {
        if (!rawData || !rawData.trim()) {
          req.body = {};
          return next();
        }
        try {
          req.body = JSON.parse(rawData);
          return next();
        } catch {
          try {
            const sanitized = sanitizeJsonStringLiterals(rawData);
            req.body = JSON.parse(sanitized);
            return next();
          } catch (err) {
            return next(err);
          }
        }
      });
    } else {
      next();
    }
  });

  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:5174', '*'],
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Nest Postgres Template')
    .setDescription('API documentation')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'bearer',
    )
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument, {
    customSiteTitle: 'API Docs',
    customCss: `
      body { background-color: #0b1220 !important; }
      .swagger-ui, .swagger-ui .topbar { background: #0b1220 !important; }
      .swagger-ui .topbar { border-bottom: 1px solid #1f2937; }
      .swagger-ui .info hgroup.main h2,
      .swagger-ui .info p,
      .swagger-ui .opblock-tag,
      .swagger-ui .opblock-summary-description,
      .swagger-ui .parameter__name,
      .swagger-ui .model-title,
      .swagger-ui label,
      .swagger-ui .response-col_status,
      .swagger-ui .response-col_description,
      .swagger-ui .tab li button.tablinks {
        color: #e5e7eb !important;
      }
      .swagger-ui .opblock-summary-path,
      .swagger-ui .opblock-summary-path__deprecated,
      .swagger-ui .opblock-summary-description,
      .swagger-ui .opblock-summary-method,
      .swagger-ui .opblock-control-arrow svg,
      .swagger-ui .authorization__btn svg,
      .swagger-ui .opblock .opblock-summary-operation-id,
      .swagger-ui .opblock .opblock-summary-path a,
      .swagger-ui .opblock .opblock-summary-path span {
        color: #f8fafc !important;
        fill: #f8fafc !important;
      }
      .swagger-ui .opblock-summary-path {
        opacity: 1 !important;
        font-weight: 600 !important;
      }
      .swagger-ui .opblock-summary {
        border-color: #374151 !important;
      }
      .swagger-ui .scheme-container,
      .swagger-ui .opblock,
      .swagger-ui .model-container,
      .swagger-ui .responses-inner,
      .swagger-ui .opblock-section-header {
        background: #111827 !important;
        border-color: #374151 !important;
      }
      .swagger-ui input, .swagger-ui textarea, .swagger-ui select {
        background: #0f172a !important;
        color: #e5e7eb !important;
        border: 1px solid #374151 !important;
      }
      .swagger-ui .btn {
        background: #2563eb !important;
        border-color: #1d4ed8 !important;
        color: #fff !important;
      }
    `,
  });

  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
