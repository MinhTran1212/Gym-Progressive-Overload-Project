import {
  IsNotEmpty,
  IsInt,
  IsNumber,
  IsUUID,
  IsOptional,
  IsString,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

export class CreateWorkoutSetDto {
  @IsUUID('all', { message: 'Exercise ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Exercise ID cannot be empty' })
  exerciseId: string;

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

