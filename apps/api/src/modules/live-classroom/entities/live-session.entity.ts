import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
} from 'typeorm';
import { ClassEntity } from '../../classes/entities/class.entity';
import { User } from '../../users/entities/user.entity';

export type LiveSessionStatus = 'scheduled' | 'live' | 'ended';

@Entity('live_sessions')
export class LiveSessionEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => ClassEntity, { onDelete: 'SET NULL', nullable: true, eager: false })
    @JoinColumn({ name: 'class_id' })
    class: ClassEntity;

    @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
    @JoinColumn({ name: 'host_id' })
    host: User;

    @Column({ length: 255 })
    title: string;

    @Column({ length: 20, default: 'scheduled' })
    status: LiveSessionStatus;

    @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
    startedAt: Date | null;

    @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
    endedAt: Date | null;

    @Column({ name: 'recording_url', type: 'text', nullable: true })
    recordingUrl: string | null;

    @Column({ name: 'resource_id', type: 'uuid', nullable: true })
    resourceId: string | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
