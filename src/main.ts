import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppConfig } from './config/app-config';

const SWAGGER_PATH = 'api/docs';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const { port, apiPrefix, corsOrigins } = app.get(ConfigService<AppConfig, true>).get('app', { infer: true });

  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: corsOrigins });

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('AP Scout API').setVersion('0.1.0').addBearerAuth().build(),
  );
  SwaggerModule.setup(SWAGGER_PATH, app, document);

  await app.listen(port);
}

void bootstrap();
