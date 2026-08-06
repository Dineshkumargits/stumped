import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TrpcRouter } from './trpc/trpc.router';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"], // Clickjacking protection
        },
      },
      xFrameOptions: { action: 'deny' },
      xContentTypeOptions: true, // nosniff
    }),
  );

  // CORS — allow the mobile app origin(s) plus the standalone public scores
  // site. CORS_ORIGIN is a comma-separated allowlist; a single "*" entry
  // reflects any origin (safe here: protected routes still require a valid
  // JWT the browser can't forge, and public routes expose only public data).
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:8081')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Non-browser clients (no Origin header) and allowlisted origins pass.
      if (
        !origin ||
        allowedOrigins.includes('*') ||
        allowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST'], // Only methods we use
  });

  // Apply tRPC middleware
  const trpcRouter = app.get(TrpcRouter);
  trpcRouter.applyMiddleware(app);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🏏 Stumped backend running on http://0.0.0.0:${port}`);
  console.log(`   tRPC endpoint: http://0.0.0.0:${port}/trpc`);
}
bootstrap();
