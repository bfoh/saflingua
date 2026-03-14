import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LiveSessionEntity } from './entities/live-session.entity';

@Injectable()
export class LiveClassroomService {
    constructor(
        @InjectRepository(LiveSessionEntity)
        private readonly sessionRepo: Repository<LiveSessionEntity>,
    ) {}

    async createSession(hostId: string, classId: string, title: string): Promise<LiveSessionEntity> {
        const session = this.sessionRepo.create({
            host: { id: hostId } as any,
            class: { id: classId } as any,
            title,
            status: 'scheduled',
        });
        return this.sessionRepo.save(session);
    }

    async getSession(sessionId: string): Promise<LiveSessionEntity> {
        const session = await this.sessionRepo.findOne({
            where: { id: sessionId },
            relations: ['class', 'host'],
        });
        if (!session) throw new NotFoundException('Session not found');
        return session;
    }

    async startSession(sessionId: string, hostId: string): Promise<LiveSessionEntity> {
        const session = await this.getSession(sessionId);
        if (session.host?.id !== hostId) throw new ForbiddenException('Only the host can start the session');
        session.status = 'live';
        session.startedAt = new Date();
        return this.sessionRepo.save(session);
    }

    async endSession(sessionId: string, hostId: string): Promise<LiveSessionEntity> {
        const session = await this.getSession(sessionId);
        if (session.host?.id !== hostId) throw new ForbiddenException('Only the host can end the session');
        session.status = 'ended';
        session.endedAt = new Date();
        return this.sessionRepo.save(session);
    }

    async getActiveForClass(classId: string): Promise<LiveSessionEntity | null> {
        return this.sessionRepo.findOne({
            where: { class: { id: classId } as any, status: 'live' },
            relations: ['host'],
        });
    }

    async saveRecording(
        sessionId: string,
        hostId: string,
        recordingUrl: string,
        resourceId?: string,
    ): Promise<LiveSessionEntity> {
        const session = await this.getSession(sessionId);
        if (session.host?.id !== hostId) throw new ForbiddenException('Only the host can save the recording');
        session.recordingUrl = recordingUrl;
        if (resourceId) session.resourceId = resourceId;
        return this.sessionRepo.save(session);
    }
}
