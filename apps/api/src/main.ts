import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Use Socket.IO adapter for WebSocket support
    app.useWebSocketAdapter(new IoAdapter(app));

    // Cookie parser (must be before guards that read cookies)
    app.use(cookieParser());

    // Global prefix
    app.setGlobalPrefix('api');

    // CORS
    app.enableCors({
        origin: (origin, callback) => {
            // Allow requests with no origin (mobile apps, curl, etc.)
            if (!origin) return callback(null, true);
            // Allow any localhost port in dev, plus all configured production origins
            const allowed = [
                process.env.WEB_URL,
                process.env.LMS_URL,
            ].filter(Boolean) as string[];
            if (
                /^http:\/\/localhost:\d+$/.test(origin) ||
                /^https:\/\/[a-z0-9-]+\.netlify\.app$/.test(origin) ||
                allowed.includes(origin)
            ) {
                return callback(null, true);
            }
            return callback(new Error(`CORS: origin ${origin} not allowed`));
        },
        credentials: true,
    });

    const reflector = app.get(Reflector);

    // Global pipes
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    // Global guards
    app.useGlobalGuards(new JwtAuthGuard(reflector));

    // Global filters
    app.useGlobalFilters(new AllExceptionsFilter());

    // Global interceptors
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.listen(process.env.PORT ?? 3001);
    console.log(`API running on http://localhost:${process.env.PORT ?? 3001}/api`);
}
bootstrap();
