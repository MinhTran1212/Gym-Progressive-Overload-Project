import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateExerciseDto {
  @IsString({ message: 'Exercise name must be a string' })
  @IsNotEmpty({ message: 'Exercise name cannot be empty' })
  name: string;

  @IsString({ message: 'Muscle group must be a string' })
  @IsNotEmpty({ message: 'Muscle group cannot be empty' })
  muscleGroup: string;

  @IsInt({ message: 'Rest time must be an integer (in seconds)' })
  @Min(0, { message: 'Rest time cannot be negative' })
  @IsOptional()
  restTime?: number;

  @IsString({ message: 'Pinned note must be a string' })
  @IsOptional()
  pinnedNote?: string;
}

