import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { BranchesModule } from './modules/branches/branches.module';
import { ClassesModule } from './modules/classes/classes.module';
import { BillingModule } from './modules/billing/billing.module';
import { SettingsModule } from './modules/settings/settings.module';
import { CoursesModule } from './modules/courses/courses.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { ExamsModule } from './modules/exams/exams.module';
import { AiAgentsModule } from './modules/ai-agents/ai-agents.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { MessagesModule } from './modules/messages/messages.module';
import { LiveClassroomModule } from './modules/live-classroom/live-classroom.module';

@Module({
    imports: [
        // Load .env first — globally available via ConfigService
        ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

        // TypeORM connects after ConfigModule has loaded env vars
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                type: 'postgres' as const,
                host: config.get<string>('DB_HOST', 'localhost'),
                port: config.get<number>('DB_PORT', 5432),
                username: config.get<string>('DB_USER', 'postgres'),
                password: config.get<string>('DB_PASSWORD', ''),
                database: config.get<string>('DB_NAME', 'postgres'),
                entities: [__dirname + '/**/*.entity{.ts,.js}'],
                synchronize: false,
                autoLoadEntities: true,
                ssl: config.get('DB_HOST', 'localhost') !== 'localhost'
                    ? { rejectUnauthorized: false }
                    : false,
            }),
        }),

        UsersModule,
        AuthModule,
        BranchesModule,
        ClassesModule,
        BillingModule,
        SettingsModule,
        CoursesModule,
        AssignmentsModule,
        ExamsModule,
        AiAgentsModule,
        DashboardModule,
        AnalyticsModule,
        AttendanceModule,
        MessagesModule,
        LiveClassroomModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule { }
