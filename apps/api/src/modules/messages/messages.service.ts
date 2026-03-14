import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Message } from './entities/message.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class MessagesService {
    constructor(
        @InjectRepository(Message)
        private readonly messageRepo: Repository<Message>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
    ) {}

    /** Save a new message and return it with sender/receiver populated */
    async save(
        senderId: string,
        receiverId: string,
        content: string,
        attachment?: { url: string; name: string; size: number; type: string } | null,
    ): Promise<Message> {
        const msg = this.messageRepo.create({
            senderId,
            receiverId,
            content,
            ...(attachment && {
                attachmentUrl: attachment.url,
                attachmentName: attachment.name,
                attachmentSize: attachment.size,
                attachmentType: attachment.type,
            }),
        });
        const saved = await this.messageRepo.save(msg);
        return this.messageRepo.findOne({
            where: { id: saved.id },
            relations: ['sender', 'receiver'],
        }) as Promise<Message>;
    }

    /**
     * Get all conversations for a user.
     * Returns one entry per unique counterpart, with last message + unread count.
     */
    async getConversations(userId: string): Promise<any[]> {
        if (!userId) return [];
        // Get all distinct counterpart IDs
        const sent = await this.messageRepo
            .createQueryBuilder('m')
            .select('DISTINCT m.receiver_id', 'otherId')
            .where('m.sender_id = :userId', { userId })
            .getRawMany();

        const received = await this.messageRepo
            .createQueryBuilder('m')
            .select('DISTINCT m.sender_id', 'otherId')
            .where('m.receiver_id = :userId', { userId })
            .getRawMany();

        const otherIds = Array.from(
            new Set([...sent.map(r => r.otherId), ...received.map(r => r.otherId)])
        ).filter(id => id && id !== userId);

        if (otherIds.length === 0) return [];

        const conversations = await Promise.all(
            otherIds.map(async (otherId) => {
                const [lastMsg] = await this.messageRepo.find({
                    where: [
                        { senderId: userId, receiverId: otherId },
                        { senderId: otherId, receiverId: userId },
                    ],
                    relations: ['sender', 'receiver'],
                    order: { createdAt: 'DESC' },
                    take: 1,
                });

                const unreadCount = await this.messageRepo.count({
                    where: { senderId: otherId, receiverId: userId, isRead: false },
                });

                const other = await this.userRepo.findOne({ where: { id: otherId } });

                return {
                    otherId,
                    otherUser: other,
                    lastMessage: lastMsg,
                    unreadCount,
                };
            })
        );

        // Sort by most recent message
        return conversations
            .filter(c => c.lastMessage)
            .sort((a, b) =>
                new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
            );
    }

    /** Get message thread between two users with optional cursor-based pagination */
    async getThread(
        userAId: string,
        userBId: string,
        limit = 50,
        cursor?: string,
    ): Promise<{ messages: Message[]; hasMore: boolean }> {
        const qb = this.messageRepo.createQueryBuilder('m')
            .where(
                '(m.senderId = :a AND m.receiverId = :b) OR (m.senderId = :b AND m.receiverId = :a)',
                { a: userAId, b: userBId },
            )
            .leftJoinAndSelect('m.sender', 'sender')
            .leftJoinAndSelect('m.receiver', 'receiver')
            .orderBy('m.createdAt', 'DESC')
            .take(limit + 1);

        if (cursor) {
            qb.andWhere('m.createdAt < :cursor', { cursor });
        }

        const raw = await qb.getMany();
        const hasMore = raw.length > limit;
        return { messages: raw.slice(0, limit).reverse(), hasMore };
    }

    /** Mark all messages from senderId to receiverId as read */
    async markRead(receiverId: string, senderId: string): Promise<void> {
        await this.messageRepo.update(
            { senderId, receiverId, isRead: false },
            { isRead: true },
        );
    }

    /** Broadcast a message from one sender to multiple receivers */
    async broadcastToMany(senderId: string, receiverIds: string[], content: string): Promise<Message[]> {
        return Promise.all(receiverIds.map(rid => this.save(senderId, rid, content)));
    }

    /** Get all users except the current user for the "New Conversation" picker */
    async getUsers(currentUserId: string): Promise<User[]> {
        if (!currentUserId) return [];
        return this.userRepo.find({
            where: { id: Not(currentUserId), isActive: true },
            order: { firstName: 'ASC' },
        });
    }
}
