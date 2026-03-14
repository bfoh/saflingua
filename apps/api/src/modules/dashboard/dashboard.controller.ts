import { Controller, Get, Post, Param, UseGuards, Request, ParseUUIDPipe } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) { }

    @Get('progress')
    @Roles(UserRole.STUDENT)
    async getMyProgress(@Request() req) {
        return this.dashboardService.getStudentProgress(req.user.id);
    }

    @Post('lessons/:lessonId/complete')
    @Roles(UserRole.STUDENT)
    async completeLesson(@Request() req, @Param('lessonId', ParseUUIDPipe) lessonId: string) {
        return this.dashboardService.markLessonComplete(req.user.id, lessonId);
    }
}
