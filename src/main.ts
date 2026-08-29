import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Elite Central Vacuum API')
    .setDescription(
      'Full REST API & Intake Platform for Elite Central Vacuum services, store, scheduling, and management',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT-auth',
        description: 'Enter your JWT access token (e.g. eyJhbGciOiJIUzI1Ni...)',
        in: 'header',
      },
      'JWT-auth',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'bearer',
        description: 'Enter your JWT access token (e.g. eyJhbGciOiJIUzI1Ni...)',
        in: 'header',
      },
      'bearer',
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument, {
    customSiteTitle: 'Elite Central Vacuum API Docs',
    customCss: `
      /* Dark Mode Palette */
      :root {
        --bg-base: #0b1320;
        --bg-surface: #111c2e;
        --bg-card: #16243b;
        --bg-input: #0d1726;
        --border-color: #243552;
        --border-light: #33486c;
        --text-primary: #f1f5f9;
        --text-secondary: #94a3b8;
        --text-muted: #64748b;
        --brand-blue: #2563eb;
        --brand-hover: #1d4ed8;
        --brand-cyan: #06b6d4;
        --success: #10b981;
        --warning: #f59e0b;
        --danger: #ef4444;
      }

      body {
        background-color: var(--bg-base) !important;
        color: var(--text-primary) !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif !important;
      }

      .swagger-ui, .swagger-ui .topbar {
        background-color: var(--bg-base) !important;
      }

      .swagger-ui .topbar {
        border-bottom: 1px solid var(--border-color) !important;
        padding: 12px 0 !important;
      }

      .swagger-ui .info hgroup.main h2,
      .swagger-ui .info p,
      .swagger-ui .opblock-tag,
      .swagger-ui .opblock-summary-description,
      .swagger-ui .parameter__name,
      .swagger-ui .parameter__type,
      .swagger-ui .model-title,
      .swagger-ui label,
      .swagger-ui .response-col_status,
      .swagger-ui .response-col_description,
      .swagger-ui .tab li button.tablinks {
        color: var(--text-primary) !important;
      }

      .swagger-ui .info .title small.version-stamp {
        background-color: var(--brand-blue) !important;
        color: #fff !important;
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
        color: var(--text-primary) !important;
        fill: var(--text-primary) !important;
      }

      .swagger-ui .opblock-summary-path {
        opacity: 1 !important;
        font-weight: 600 !important;
      }

      .swagger-ui .opblock-summary {
        border-color: var(--border-color) !important;
      }

      .swagger-ui .scheme-container,
      .swagger-ui .opblock,
      .swagger-ui .model-container,
      .swagger-ui .responses-inner,
      .swagger-ui .opblock-section-header {
        background: var(--bg-surface) !important;
        border-color: var(--border-color) !important;
      }

      .swagger-ui .opblock.opblock-post {
        background: rgba(16, 185, 129, 0.05) !important;
        border-color: rgba(16, 185, 129, 0.3) !important;
      }

      .swagger-ui .opblock.opblock-get {
        background: rgba(37, 99, 235, 0.05) !important;
        border-color: rgba(37, 99, 235, 0.3) !important;
      }

      .swagger-ui .opblock.opblock-patch {
        background: rgba(245, 158, 11, 0.05) !important;
        border-color: rgba(245, 158, 11, 0.3) !important;
      }

      .swagger-ui .opblock.opblock-delete {
        background: rgba(239, 68, 68, 0.05) !important;
        border-color: rgba(239, 68, 68, 0.3) !important;
      }

      .swagger-ui input, .swagger-ui textarea, .swagger-ui select {
        background: var(--bg-input) !important;
        color: var(--text-primary) !important;
        border: 1px solid var(--border-color) !important;
        border-radius: 6px !important;
      }

      .swagger-ui input:focus, .swagger-ui textarea:focus {
        border-color: var(--brand-blue) !important;
        outline: none !important;
      }

      .swagger-ui .btn {
        background: var(--brand-blue) !important;
        border-color: var(--brand-hover) !important;
        color: #fff !important;
        border-radius: 6px !important;
        font-weight: 500 !important;
      }

      .swagger-ui .btn.authorize {
        background: transparent !important;
        border-color: var(--success) !important;
        color: var(--success) !important;
      }

      .swagger-ui .btn.authorize svg {
        fill: var(--success) !important;
      }

      .swagger-ui .btn.cancel {
        background: #334155 !important;
        border-color: #475569 !important;
        color: #fff !important;
      }

      /* Modal & Authorization Popup Dark Mode */
      .swagger-ui .dialog-ux .backdrop-ux {
        background: rgba(0, 0, 0, 0.8) !important;
        backdrop-filter: blur(4px) !important;
      }

      .swagger-ui .dialog-ux .modal-ux {
        background: var(--bg-surface) !important;
        border: 1px solid var(--border-color) !important;
        border-radius: 12px !important;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5) !important;
      }

      .swagger-ui .modal-ux-header {
        border-bottom: 1px solid var(--border-color) !important;
        padding: 16px 24px !important;
      }

      .swagger-ui .modal-ux-header h3 {
        color: var(--text-primary) !important;
        font-size: 1.25rem !important;
        font-weight: 600 !important;
      }

      .swagger-ui .modal-ux-header .close-modal {
        fill: var(--text-secondary) !important;
      }

      .swagger-ui .modal-ux-content {
        padding: 24px !important;
        color: var(--text-primary) !important;
      }

      .swagger-ui .modal-ux-content h4 {
        color: var(--text-primary) !important;
      }

      .swagger-ui .modal-ux-content p {
        color: var(--text-secondary) !important;
      }

      .swagger-ui .modal-ux-content code {
        background: var(--bg-input) !important;
        color: var(--brand-cyan) !important;
        padding: 2px 6px !important;
        border-radius: 4px !important;
      }

      .swagger-ui .auth-container {
        border-bottom: 1px solid var(--border-color) !important;
        padding-bottom: 20px !important;
        margin-bottom: 20px !important;
      }

      .swagger-ui .auth-container:last-child {
        border-bottom: none !important;
        margin-bottom: 0 !important;
      }

      .swagger-ui .auth-container h4 {
        color: var(--text-primary) !important;
      }

      .swagger-ui .auth-container input[type="text"],
      .swagger-ui .auth-container input[type="password"] {
        background: var(--bg-input) !important;
        color: var(--text-primary) !important;
        border: 1px solid var(--border-light) !important;
        padding: 8px 12px !important;
        border-radius: 6px !important;
        width: 100% !important;
      }

      .swagger-ui .auth-btn-wrapper {
        display: flex !important;
        gap: 12px !important;
        margin-top: 16px !important;
      }

      .swagger-ui .btn.modal-btn.auth {
        background: var(--brand-blue) !important;
        border-color: var(--brand-hover) !important;
        color: #fff !important;
      }

      .swagger-ui .btn.modal-btn.btn-done {
        background: #334155 !important;
        border-color: #475569 !important;
        color: #fff !important;
      }

      .swagger-ui table thead tr th,
      .swagger-ui table thead tr td {
        color: var(--text-secondary) !important;
        border-bottom: 1px solid var(--border-color) !important;
      }

      .swagger-ui .model-box {
        background: var(--bg-card) !important;
      }

      .swagger-ui section.models {
        border: 1px solid var(--border-color) !important;
        border-radius: 8px !important;
        background: var(--bg-surface) !important;
      }

      .swagger-ui section.models h4 {
        color: var(--text-primary) !important;
      }
    `,
  });

  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
