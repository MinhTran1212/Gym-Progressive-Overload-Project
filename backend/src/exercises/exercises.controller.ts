import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ExercisesService } from './exercises.service';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';

@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() createExerciseDto: CreateExerciseDto,
  ) {
    return this.exercisesService.create(createExerciseDto, user?.id);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.exercisesService.findAll(user?.id);
  }

  @Get('muscle/:muscleGroup')
  findByMuscle(
    @Param('muscleGroup') muscle: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.exercisesService.findByMuscle(muscle, user?.id);
  }

  @Get(':id/progression')
  getProgression(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.exercisesService.getProgression(id, user?.id);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.exercisesService.findOne(id, user?.id);
  }

  @Patch(':id')
  updateOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateExerciseDto: UpdateExerciseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.exercisesService.updateOne(id, updateExerciseDto, user?.id);
  }

  @Delete(':id')
  deleteOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.exercisesService.deleteOne(id, user?.id);
  }
}
