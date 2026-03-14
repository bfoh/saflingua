import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassEntity } from '../classes/entities/class.entity';
import { LiveSessionEntity } from './entities/live-session.entity';

interface AuthPayload {
    sub: string;
    email: string;
}

interface Participant {
    userId: string;
    userName: string;
    role: string;
    isHost: boolean;
    socketId: string;
}

@WebSocketGateway({
    namespace: '/classroom',
    cors: {
        origin: process.env.WEB_URL || 'http://localhost:3000',
        credentials: true,
    },
})
export class LiveClassroomGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    // sessionId → Map<socketId, Participant>
    private readonly sessions = new Map<string, Map<string, Participant>>();

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        @InjectRepository(ClassEntity)
        private readonly classRepo: Repository<ClassEntity>,
        @InjectRepository(LiveSessionEntity)
        private readonly sessionRepo: Repository<LiveSessionEntity>,
    ) {}

    private async authenticate(client: Socket): Promise<string | null> {
        const token =
            (client.handshake.auth?.token as string) ||
            (client.handshake.query?.token as string);

        if (!token) return null;

        const isDev = this.configService.get('NODE_ENV') !== 'production';

        try {
            const payload = this.jwtService.verify<AuthPayload>(token, {
                secret: this.configService.get<string>('SUPABASE_JWT_SECRET'),
            });
            return payload.sub;
        } catch {
            if (!isDev) return null;
            const decoded = this.jwtService.decode(token) as AuthPayload | null;
            return decoded?.sub ?? null;
        }
    }

    async handleConnection(client: Socket) {
        const userId = await this.authenticate(client);
        if (!userId) {
            client.disconnect();
            return;
        }
        client.data.userId = userId;
        console.log(`[ClassroomGateway] ${client.id} (${userId}) connected`);
    }

    handleDisconnect(client: Socket) {
        const userId = client.data.userId as string;
        const sessionId = client.data.sessionId as string;
        console.log(`[ClassroomGateway] ${client.id} (${userId}) disconnected`);

        if (sessionId) {
            this.removeParticipant(sessionId, client.id);
            client.to(`session:${sessionId}`).emit('participant_left', { userId });
        }
    }

    private getOrCreateSession(sessionId: string): Map<string, Participant> {
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, new Map());
        }
        return this.sessions.get(sessionId)!;
    }

    private removeParticipant(sessionId: string, socketId: string) {
        const participants = this.sessions.get(sessionId);
        if (participants) {
            participants.delete(socketId);
            if (participants.size === 0) this.sessions.delete(sessionId);
        }
    }

    @SubscribeMessage('join_session')
    async handleJoinSession(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { sessionId: string; isHost: boolean; userName?: string },
    ) {
        const userId = client.data.userId as string;
        const room = `session:${data.sessionId}`;

        // Authorization check
        const session = await this.sessionRepo.findOne({
            where: { id: data.sessionId },
            relations: ['class', 'class.students', 'host'],
        });

        if (!session) {
            client.emit('error', { message: 'Session not found' });
            return;
        }

        const isInstructor = session.host?.id === userId;
        const isEnrolled = session.class?.students?.some(s => s.id === userId);

        if (!isInstructor && !isEnrolled) {
            client.emit('error', { message: 'Not authorized for this session' });
            client.disconnect();
            return;
        }

        await client.join(room);
        client.data.sessionId = data.sessionId;

        const participants = this.getOrCreateSession(data.sessionId);
        const participant: Participant = {
            userId,
            userName: data.userName ?? '',
            role: data.isHost ? 'host' : 'student',
            isHost: data.isHost,
            socketId: client.id,
        };
        participants.set(client.id, participant);

        // Tell newcomer about existing participants
        const existing = [...participants.values()].filter(p => p.socketId !== client.id);
        client.emit('you_joined', { participants: existing });

        // Tell everyone else about this new participant
        client.to(room).emit('participant_joined', {
            userId,
            userName: data.userName ?? '',
            isHost: data.isHost,
        });
    }

    @SubscribeMessage('leave_session')
    handleLeaveSession(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { sessionId: string },
    ) {
        const userId = client.data.userId as string;
        const room = `session:${data.sessionId}`;
        client.leave(room);
        this.removeParticipant(data.sessionId, client.id);
        client.to(room).emit('participant_left', { userId });
        client.data.sessionId = undefined;
    }

    @SubscribeMessage('session_live')
    async handleSessionLive(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { sessionId: string; classId: string },
    ) {
        // Load class with enrolled students and notify each enrolled student
        try {
            const cls = await this.classRepo.findOne({
                where: { id: data.classId },
                relations: ['students', 'teacher'],
            });
            if (!cls) return;

            const instructorName =
                `${cls.teacher?.firstName ?? ''} ${cls.teacher?.lastName ?? ''}`.trim() ||
                'Your Instructor';

            const payload = {
                sessionId: data.sessionId,
                className: cls.name,
                instructorName,
            };

            // Emit to each enrolled student's personal room on the /classroom namespace
            for (const student of cls.students ?? []) {
                client.to(student.id).emit('class_live', payload);
            }
        } catch (err) {
            console.error('[ClassroomGateway] session_live error:', err.message);
        }
    }

    // ─── WebRTC Signaling relay (server is just a relay, no media processing) ───

    @SubscribeMessage('request_offer')
    handleRequestOffer(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { hostId: string; sessionId: string },
    ) {
        // Find host's socket in the session and tell them to create an offer for this student
        const participants = this.sessions.get(data.sessionId);
        if (!participants) return;

        for (const [, p] of participants) {
            if (p.userId === data.hostId && p.isHost) {
                this.server.to(p.socketId).emit('student_ready', {
                    studentId: client.data.userId,
                    studentSocketId: client.id,
                });
                return;
            }
        }
    }

    @SubscribeMessage('webrtc_offer')
    handleOffer(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { targetId: string; offer: RTCSessionDescriptionInit; sessionId: string },
    ) {
        // Relay offer to target user in this session
        const participants = this.sessions.get(data.sessionId);
        if (!participants) return;

        for (const [, p] of participants) {
            if (p.userId === data.targetId) {
                this.server.to(p.socketId).emit('webrtc_offer', {
                    fromId: client.data.userId,
                    offer: data.offer,
                });
                return;
            }
        }
    }

    @SubscribeMessage('webrtc_answer')
    handleAnswer(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { targetId: string; answer: RTCSessionDescriptionInit; sessionId: string },
    ) {
        const participants = this.sessions.get(data.sessionId);
        if (!participants) return;

        for (const [, p] of participants) {
            if (p.userId === data.targetId) {
                this.server.to(p.socketId).emit('webrtc_answer', {
                    fromId: client.data.userId,
                    answer: data.answer,
                });
                return;
            }
        }
    }

    @SubscribeMessage('webrtc_ice')
    handleIceCandidate(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { targetId: string; candidate: RTCIceCandidateInit; sessionId: string },
    ) {
        const participants = this.sessions.get(data.sessionId);
        if (!participants) return;

        for (const [, p] of participants) {
            if (p.userId === data.targetId) {
                this.server.to(p.socketId).emit('webrtc_ice', {
                    fromId: client.data.userId,
                    candidate: data.candidate,
                });
                return;
            }
        }
    }

    // ─── Hand Raise ───────────────────────────────────────────────────────────

    @SubscribeMessage('hand_raise')
    handleHandRaise(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { sessionId: string; userName: string },
    ) {
        const userId = client.data.userId as string;
        const participants = this.sessions.get(data.sessionId);
        if (!participants) return;

        // Emit only to the host
        for (const [, p] of participants) {
            if (p.isHost) {
                this.server.to(p.socketId).emit('hand_raised', {
                    userId,
                    userName: data.userName,
                });
                return;
            }
        }
    }

    @SubscribeMessage('hand_lower')
    handleHandLower(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { sessionId: string },
    ) {
        const userId = client.data.userId as string;
        const participants = this.sessions.get(data.sessionId);
        if (!participants) return;

        for (const [, p] of participants) {
            if (p.isHost) {
                this.server.to(p.socketId).emit('hand_lowered', { userId });
                return;
            }
        }
    }

    @SubscribeMessage('allow_speak')
    handleAllowSpeak(
        @ConnectedSocket() _client: Socket,
        @MessageBody() data: { targetId: string; sessionId: string },
    ) {
        const participants = this.sessions.get(data.sessionId);
        if (!participants) return;

        for (const [, p] of participants) {
            if (p.userId === data.targetId) {
                this.server.to(p.socketId).emit('speak_allowed');
                return;
            }
        }
    }

    @SubscribeMessage('revoke_speak')
    handleRevokeSpeak(
        @ConnectedSocket() _client: Socket,
        @MessageBody() data: { targetId: string; sessionId: string },
    ) {
        const participants = this.sessions.get(data.sessionId);
        if (!participants) return;

        for (const [, p] of participants) {
            if (p.userId === data.targetId) {
                this.server.to(p.socketId).emit('speak_revoked');
                return;
            }
        }
    }

    // ─── Q&A Chat ─────────────────────────────────────────────────────────────

    @SubscribeMessage('classroom_msg')
    handleClassroomMsg(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { sessionId: string; content: string; userName: string },
    ) {
        const userId = client.data.userId as string;
        const room = `session:${data.sessionId}`;
        this.server.to(room).emit('new_classroom_msg', {
            userId,
            userName: data.userName,
            content: data.content,
            ts: new Date().toISOString(),
        });
    }
}
