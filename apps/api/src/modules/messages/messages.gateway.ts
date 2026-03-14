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
import { MessagesService } from './messages.service';

interface AuthPayload {
    sub: string;
    email: string;
}

@WebSocketGateway({
    namespace: '/messages',
    cors: {
        origin: process.env.WEB_URL || 'http://localhost:3000',
        credentials: true,
    },
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly connectedUsers = new Map<string, string>(); // socketId → userId

    constructor(
        private readonly messagesService: MessagesService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    async handleConnection(client: Socket) {
        console.log(`[MessagesGateway] New attempt from client ${client.id}`);
        try {
            const token =
                (client.handshake.auth?.token as string) ||
                (client.handshake.query?.token as string);

            if (!token) {
                console.warn(`[MessagesGateway] No token for client ${client.id}`);
                client.disconnect();
                return;
            }

            let userId: string;
            const isDev = this.configService.get('NODE_ENV') !== 'production';

            try {
                const payload = this.jwtService.verify<AuthPayload>(token, {
                    secret: this.configService.get<string>('SUPABASE_JWT_SECRET'),
                });
                userId = payload.sub;
            } catch (verifyErr) {
                if (!isDev) {
                    throw verifyErr;
                }
                // In dev: decode without verifying the signature so the real user ID is used
                const decoded = this.jwtService.decode(token) as AuthPayload | null;
                if (!decoded?.sub) {
                    console.error(`[MessagesGateway] Cannot decode token for ${client.id}`);
                    client.disconnect();
                    return;
                }
                console.warn(`[MessagesGateway] JWT verify failed (dev mode), using decoded sub: ${decoded.sub}`);
                userId = decoded.sub;
            }

            client.data.userId = userId;
            this.connectedUsers.set(client.id, userId);

            // Join a personal room so messages can be targeted
            await client.join(userId);
            console.log(`[MessagesGateway] Client ${client.id} (User: ${userId}) joined room ${userId}`);

            // Broadcast to everyone that this user is now online
            this.server.emit('user_online', { userId });
        } catch (err) {
            console.error(`[MessagesGateway] Auth failed for ${client.id}:`, err.message);
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        const userId = client.data.userId;
        console.log(`[MessagesGateway] Client ${client.id} (User: ${userId}) disconnected`);
        this.connectedUsers.delete(client.id);

        // Only broadcast offline if this user has no other active connections
        const stillConnected = [...this.connectedUsers.values()].includes(userId);
        if (!stillConnected && userId) {
            this.server.emit('user_offline', { userId });
        }
    }

    @SubscribeMessage('get_online_users')
    handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
        const uniqueIds = [...new Set(this.connectedUsers.values())];
        client.emit('online_users', { userIds: uniqueIds });
    }

    @SubscribeMessage('send_message')
    async handleSendMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: {
            receiverId: string;
            content: string;
            attachment?: { url: string; name: string; size: number; type: string } | null;
        },
    ) {
        const senderId = client.data.userId as string;
        console.log(`[MessagesGateway] send_message from ${senderId} to ${data.receiverId}`);

        const hasContent = !!data.content?.trim();
        const hasAttachment = !!(data.attachment?.url);
        if (!senderId || !data.receiverId || (!hasContent && !hasAttachment)) {
            console.warn('[MessagesGateway] Invalid message data', { senderId, receiverId: data.receiverId });
            return;
        }

        const message = await this.messagesService.save(
            senderId,
            data.receiverId,
            data.content?.trim() || '',
            data.attachment,
        );

        const payload = {
            id: message.id,
            senderId: message.senderId,
            receiverId: message.receiverId,
            content: message.content,
            isRead: message.isRead,
            createdAt: message.createdAt,
            sender: {
                id: message.sender?.id,
                firstName: message.sender?.firstName,
                lastName: message.sender?.lastName,
                email: message.sender?.email,
            },
            attachmentUrl: message.attachmentUrl ?? null,
            attachmentName: message.attachmentName ?? null,
            attachmentSize: message.attachmentSize ?? null,
            attachmentType: message.attachmentType ?? null,
        };

        // Emit to receiver's room
        console.log(`[MessagesGateway] Emitting new_message to room ${data.receiverId}`);
        const result = this.server.to(data.receiverId).emit('new_message', payload);
        console.log(`[MessagesGateway] Emit result:`, result ? 'success' : 'failed');

        // Echo back to sender (confirmation)
        client.emit('message_sent', payload);
    }

    @SubscribeMessage('mark_read')
    async handleMarkRead(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { senderId: string },
    ) {
        const receiverId = client.data.userId as string;
        if (!receiverId || !data.senderId) return;

        await this.messagesService.markRead(receiverId, data.senderId);

        // Notify the sender that their messages were read
        this.server.to(data.senderId).emit('messages_read', { by: receiverId });
    }

    @SubscribeMessage('typing')
    handleTyping(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { receiverId: string; isTyping: boolean },
    ) {
        const senderId = client.data.userId as string;
        if (!senderId || !data.receiverId) return;

        this.server.to(data.receiverId).emit('user_typing', {
            senderId,
            isTyping: data.isTyping,
        });
    }
}
