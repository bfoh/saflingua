import { Controller, Get, Post, Body, Param, Put, Delete, Patch, ParseUUIDPipe } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('courses')
export class CoursesController {
    constructor(private readonly coursesService: CoursesService) { }

    // Course Level Endpoints
    @Get()
    @Public()
    findAll() {
        return this.coursesService.findAll();
    }

    @Get(':id')
    @Public()
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.coursesService.findOne(id);
    }

    @Post()
    @Public()
    create(@Body() createCourseDto: any) {
        return this.coursesService.create(createCourseDto);
    }

    @Patch(':id')
    @Public()
    update(@Param('id', ParseUUIDPipe) id: string, @Body() updateCourseDto: any) {
        return this.coursesService.update(id, updateCourseDto);
    }

    @Delete(':id')
    @Public()
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.coursesService.remove(id);
    }

    // Module Level Endpoints
    @Post(':courseId/modules')
    @Public()
    addModule(@Param('courseId', ParseUUIDPipe) courseId: string, @Body() moduleDto: any) {
        return this.coursesService.addModule(courseId, moduleDto);
    }

    @Delete('modules/:moduleId')
    @Public()
    removeModule(@Param('moduleId', ParseUUIDPipe) moduleId: string) {
        return this.coursesService.removeModule(moduleId);
    }

    // Lesson Level Endpoints
    @Post('modules/:moduleId/lessons')
    @Public()
    addLesson(@Param('moduleId', ParseUUIDPipe) moduleId: string, @Body() lessonDto: any) {
        return this.coursesService.addLesson(moduleId, lessonDto);
    }

    @Delete('lessons/:lessonId')
    @Public()
    removeLesson(@Param('lessonId', ParseUUIDPipe) lessonId: string) {
        return this.coursesService.removeLesson(lessonId);
    }
}
