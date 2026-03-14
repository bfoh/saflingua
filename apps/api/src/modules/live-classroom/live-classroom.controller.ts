import { Controller, Get, Post, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { LiveClassroomService } from './live-classroom.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('live-classroom')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LiveClassroomController {
    constructor(private readonly service: LiveClassroomService) {}

    @Post()
    async createSession(
        @CurrentUser() user: User,
        @Body() body: { classId: string; title: string },
    ) {
        return this.service.createSession(user.id, body.classId, body.title);
    }

    // Must come before :id to avoid route collision
    @Get('class/:classId/active')
    async getActiveSession(@Param('classId', ParseUUIDPipe) classId: string) {
        const session = await this.service.getActiveForClass(classId);
        return session ?? null;
    }

    @Get(':id')
    async getSession(@Param('id', ParseUUIDPipe) id: string) {
        return this.service.getSession(id);
    }

    @Post(':id/start')
    async startSession(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
        return this.service.startSession(id, user.id);
    }

    @Post(':id/end')
    async endSession(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
        return this.service.endSession(id, user.id);
    }

    @Post(':id/save-recording')
    async saveRecording(
        @CurrentUser() user: User,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: { recordingUrl: string; resourceId?: string },
    ) {
        return this.service.saveRecording(id, user.id, body.recordingUrl, body.resourceId);
    }
}
