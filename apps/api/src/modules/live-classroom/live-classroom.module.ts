import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LiveSessionEntity } from './entities/live-session.entity';
import { ClassEntity } from '../classes/entities/class.entity';
import { User } from '../users/entities/user.entity';
import { LiveClassroomService } from './live-classroom.service';
import { LiveClassroomGateway } from './live-classroom.gateway';
import { LiveClassroomController } from './live-classroom.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([LiveSessionEntity, ClassEntity, User]),
        ConfigModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('SUPABASE_JWT_SECRET'),
            }),
        }),
    ],
    providers: [LiveClassroomService, LiveClassroomGateway],
    controllers: [LiveClassroomController],
    exports: [LiveClassroomService],
})
export class LiveClassroomModule {}
