import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { WorkoutsService } from './workouts.service';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { CreateWorkoutSetDto } from './dto/create-workout-set.dto';
import {
  UpdateWorkoutDto,
  UpdateWorkoutSetDto,
} from './dto/update-workout.dto';
import { GetWorkoutsQueryDto } from './dto/get-workouts-query.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';

@Controller('workouts')
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @Post()
  create(
    @Body() createWorkoutDto: CreateWorkoutDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workoutsService.create(createWorkoutDto, user?.id);
  }

  @Get()
  findAll(
    @Query() query: GetWorkoutsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workoutsService.findAll(query, user?.id);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workoutsService.findOne(id, user?.id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateWorkoutDto: UpdateWorkoutDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workoutsService.update(id, updateWorkoutDto, user?.id);
  }

  @Patch(':id/finish')
  finishWorkout(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workoutsService.finishWorkout(id, user?.id);
  }

  @Post(':id/sets')
  addSet(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createSetDto: CreateWorkoutSetDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workoutsService.addSet(id, createSetDto, user?.id);
  }

  @Patch(':id/sets/:setId')
  updateSet(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('setId', ParseUUIDPipe) setId: string,
    @Body() updateSetDto: UpdateWorkoutSetDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workoutsService.updateSet(id, setId, updateSetDto, user?.id);
  }

  @Delete(':id/sets/:setId')
  removeSet(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('setId', ParseUUIDPipe) setId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workoutsService.removeSet(id, setId, user?.id);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workoutsService.remove(id, user?.id);
  }
}
