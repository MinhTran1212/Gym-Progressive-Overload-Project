import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkoutDto } from './create-workout.dto';
import { CreateWorkoutSetDto } from './create-workout-set.dto';

export class UpdateWorkoutDto extends PartialType(CreateWorkoutDto) {}

export class UpdateWorkoutSetDto extends PartialType(CreateWorkoutSetDto) {}

