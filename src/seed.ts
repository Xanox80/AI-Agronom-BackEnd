import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/** Boots the app context so boot-time seeders (catalogue DEMO data, CATALOG_SEED_DEMO) run, then exits. */
async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  await app.close();
}

void seed();
