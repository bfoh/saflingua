import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
    constructor(private readonly attendanceService: AttendanceService) { }

    // Accessible to any authenticated user — no @Roles = RolesGuard passes through
    @Get('me')
    async getMyAttendance(@CurrentUser() user: User) {
        return this.attendanceService.getMyAttendance(user.id);
    }

    @Post('class/:classId')
    @Roles(UserRole.TEACHER, UserRole.ADMIN)
    async markClassAttendance(
        @Param('classId') classId: string,
        @Body() payload: { records: { studentId: string, isPresent: boolean }[] }
    ) {
        return this.attendanceService.markAttendance(classId, payload.records);
    }

    @Get('class/:classId')
    @Roles(UserRole.TEACHER, UserRole.ADMIN)
    async getAttendance(
        @Param('classId') classId: string,
        @Query('date') date?: string
    ) {
        return this.attendanceService.getAttendanceForClass(classId, date);
    }
}
