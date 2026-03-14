import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@Controller('classes')
export class ClassesController {
    constructor(private readonly classesService: ClassesService) { }

    @Post()
    create(@Body() createClassDto: CreateClassDto) {
        return this.classesService.create(createClassDto);
    }

    @Get()
    findAll() {
        return this.classesService.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.classesService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() updateClassDto: UpdateClassDto) {
        return this.classesService.update(id, updateClassDto);
    }

    @Delete(':id')
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.classesService.remove(id);
    }

    @Post(':id/enroll')
    enrollStudent(@Param('id', ParseUUIDPipe) classId: string, @Body() body: { studentId: string }) {
        return this.classesService.enrollStudent(classId, body.studentId);
    }

    @Delete(':id/students/:studentId')
    @HttpCode(HttpStatus.OK)
    removeStudent(@Param('id', ParseUUIDPipe) classId: string, @Param('studentId', ParseUUIDPipe) studentId: string) {
        return this.classesService.removeStudent(classId, studentId);
    }
}
