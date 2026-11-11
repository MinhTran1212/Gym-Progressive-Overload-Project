import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsDateString,
  IsUUID,
  IsNotEmpty,
  IsNumber,
  IsInt,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateWorkoutSetDto } from './create-workout-set.dto';

export class ExerciseSetItemDto {
  @IsNumber({}, { message: 'Weight must be a number' })
  @Min(0, { message: 'Weight cannot be negative' })
  @IsOptional()
  weight?: number;

  @IsInt({ message: 'Rep must be an integer' })
  @Min(1, { message: 'Rep must be at least 1' })
  @IsOptional()
  rep?: number;

  @IsInt({ message: 'RPE must be an integer' })
  @Min(1, { message: 'RPE must be between 1 and 10' })
  @Max(10, { message: 'RPE must be between 1 and 10' })
  @IsOptional()
  rpe?: number;

  @IsInt({ message: 'Order must be an integer' })
  @Min(1, { message: 'Order must be at least 1' })
  @IsOptional()
  order?: number;

  @IsString({ message: 'Set note must be a string' })
  @IsOptional()
  note?: string;

  @IsBoolean({ message: 'isCompleted must be a boolean' })
  @IsOptional()
  isCompleted?: boolean;
}

export class CreateWorkoutExerciseGroupDto {
  @IsUUID('all', { message: 'Exercise ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Exercise ID cannot be empty' })
  exerciseId: string;

  @IsString({ message: 'Pinned note must be a string' })
  @IsOptional()
  pinnedNote?: string;

  @IsArray({ message: 'Sets inside exercise must be an array' })
  @ValidateNested({ each: true })
  @Type(() => ExerciseSetItemDto)
  sets: ExerciseSetItemDto[];
}

export class CreateWorkoutDto {
  @IsString({ message: 'Note must be a string' })
  @IsOptional()
  note?: string;

  @IsDateString({}, { message: 'Date must be a valid ISO 8601 date string' })
  @IsOptional()
  date?: string;

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