import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('messages')
export class Message {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'sender_id', type: 'uuid' })
    senderId: string;

    @Column({ name: 'receiver_id', type: 'uuid' })
    receiverId: string;

    @Column({ type: 'text', default: '' })
    content: string;

    @Column({ name: 'is_read', default: false })
    isRead: boolean;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @Column({ name: 'attachment_url', type: 'varchar', nullable: true })
    attachmentUrl: string | null;

    @Column({ name: 'attachment_name', type: 'varchar', nullable: true })
    attachmentName: string | null;

    @Column({ name: 'attachment_size', type: 'integer', nullable: true })
    attachmentSize: number | null;

    @Column({ name: 'attachment_type', type: 'varchar', nullable: true })
    attachmentType: string | null;

    @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sender_id' })
    sender: User;

    @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'receiver_id' })
    receiver: User;
}
