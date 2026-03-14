import { Controller, Get, Post, Body, Param, Query, BadRequestException } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesGateway } from './messages.gateway';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('messages')
export class MessagesController {
    constructor(
        private readonly messagesService: MessagesService,
        private readonly messagesGateway: MessagesGateway,
    ) {}

    /** GET /api/messages/users — all users the current user can message */
    @Get('users')
    async getUsers(@CurrentUser() user: User) {
        return this.messagesService.getUsers(user.id);
    }

    /** GET /api/messages/conversations — all conversations for current user */
    @Get('conversations')
    async getConversations(@CurrentUser() user: User) {
        return this.messagesService.getConversations(user.id);
    }

    /** GET /api/messages/thread/:userId?cursor=<ISO>&limit=<n> — message history */
    @Get('thread/:userId')
    async getThread(
        @CurrentUser() user: User,
        @Param('userId') otherId: string,
        @Query('cursor') cursor?: string,
        @Query('limit') limit?: string,
    ) {
        return this.messagesService.getThread(
            user.id,
            otherId,
            limit ? parseInt(limit, 10) : 50,
            cursor,
        );
    }

    /** POST /api/messages/broadcast — send a message to multiple recipients at once */
    @Post('broadcast')
    async broadcast(
        @CurrentUser() user: User,
        @Body() body: { receiverIds: string[]; content: string },
    ) {
        if (!Array.isArray(body.receiverIds) || body.receiverIds.length === 0 || !body.content?.trim()) {
            throw new BadRequestException('receiverIds (non-empty array) and content are required');
        }
        const messages = await this.messagesService.broadcastToMany(
            user.id, body.receiverIds, body.content.trim(),
        );
        // Push real-time notification to each receiver's socket room
        for (const msg of messages) {
            const payload = {
                id: msg.id,
                senderId: msg.senderId,
                receiverId: msg.receiverId,
                content: msg.content,
                isRead: msg.isRead,
                createdAt: msg.createdAt,
                sender: {
                    id: msg.sender?.id,
                    firstName: msg.sender?.firstName,
                    lastName: msg.sender?.lastName,
                    email: msg.sender?.email,
                },
                attachmentUrl: null,
                attachmentName: null,
                attachmentSize: null,
                attachmentType: null,
            };
            this.messagesGateway.server.to(msg.receiverId).emit('new_message', payload);
        }
        return { sent: messages.length };
    }
}
