import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { User } from '../../users/entities/user.entity';
import { ClassEntity } from '../../classes/entities/class.entity';

@Entity('class_attendance')
export class AttendanceRecordEntity extends BaseEntity {
    @ManyToOne(() => ClassEntity, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'class_id' })
    class: ClassEntity;

    @Column({ name: 'class_id', type: 'uuid', insert: false, update: false })
    classId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'student_id' })
    student: User;

    @Column({ name: 'student_id', type: 'uuid', insert: false, update: false })
    studentId: string;

    @Column({ type: 'date', default: () => 'CURRENT_DATE' })
    date: Date;

    @Column({ type: 'boolean', default: false })
    isPresent: boolean;
}
