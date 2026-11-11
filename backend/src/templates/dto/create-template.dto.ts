import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateWorkoutSetDto } from '../../workouts/dto/create-workout-set.dto';
import { CreateWorkoutExerciseGroupDto } from '../../workouts/dto/create-workout.dto';

export class CreateTemplateDto {
  @IsString({ message: 'Template name must be a string' })
  @IsNotEmpty({ message: 'Template name cannot be empty' })
  name: string;

  @IsString({ message: 'Note must be a string' })
  @IsOptional()
  note?: string;

  @IsArray({ message: 'Sets must be an array' })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkoutSetDto)
  set?: CreateWorkoutSetDto[];

  @IsArray({ message: 'Exercises must be an array' })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkoutExerciseGroupDto)
  exercises?: CreateWorkoutExerciseGroupDto[];
}

