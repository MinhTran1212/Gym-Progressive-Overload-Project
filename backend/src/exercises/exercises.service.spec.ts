import { jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ExercisesService } from './exercises.service';
import { PrismaService } from '../prisma/prisma.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AsyncMockFn = (...args: any[]) => Promise<any>;

describe('ExercisesService', () => {
  let service: ExercisesService;
  const mockPrismaService = {
    exercise: {
      findMany: jest.fn<AsyncMockFn>(),
      findUnique: jest.fn<AsyncMockFn>(),
      create: jest.fn<AsyncMockFn>(),
      update: jest.fn<AsyncMockFn>(),
      delete: jest.fn<AsyncMockFn>(),
    },
    userExerciseNote: {
      upsert: jest.fn<AsyncMockFn>(),
    },
    set: {
      findMany: jest.fn<AsyncMockFn>(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExercisesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ExercisesService>(ExercisesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should allow a user to update their personal pinnedNote on a system exercise, but forbid deleting the system exercise', async () => {
    const systemExercise = {
      id: 'ex-sys-1',
      name: 'Barbell Bench Press',
      muscleGroup: 'Chest',
      restTime: 120,
      pinnedNote: null,
      userId: null,
      userNotes: [],
    };

    mockPrismaService.exercise.findUnique.mockResolvedValue(systemExercise);
    mockPrismaService.userExerciseNote.upsert.mockResolvedValue({
      userId: 'user-1',
      exerciseId: 'ex-sys-1',
      pinnedNote: 'Seat height 2',
    });

    // Updating only pinnedNote succeeds and upserts UserExerciseNote
    const updated = await service.updateOne(
      'ex-sys-1',
      { pinnedNote: 'Seat height 2' },
      'user-1',
    );
    expect(updated.pinnedNote).toBe('Seat height 2');
    expect(mockPrismaService.userExerciseNote.upsert).toHaveBeenCalled();

    // Deleting a system exercise (userId = null) is forbidden
    await expect(service.deleteOne('ex-sys-1', 'user-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  describe('getProgression', () => {
    const mockExercise = {
      id: 'ex-1',
      name: 'Barbell Bench Press',
      muscleGroup: 'Chest',
      restTime: 120,
      pinnedNote: null,
      userId: null,
      userNotes: [],
    };

    it('should return NO_HISTORY when no sets exist', async () => {
      mockPrismaService.exercise.findUnique.mockResolvedValue(mockExercise);
      mockPrismaService.set.findMany.mockResolvedValue([]);

      const result = await service.getProgression('ex-1', 'user-1');

      expect(result.recommendation.status).toBe('NO_HISTORY');
      expect(result.history).toHaveLength(0);
    });

    it('should calculate Volume, Epley 1RM, and suggest +1 rep when RPE is 8 and reps < 10', async () => {
      mockPrismaService.exercise.findUnique.mockResolvedValue(mockExercise);
      mockPrismaService.set.findMany.mockResolvedValue([
        {
          id: 'set-1',
          workoutId: 'w-1',
          exerciseId: 'ex-1',
          order: 1,
          weight: 80,
          rep: 8,
          rpe: 8,
          isCompleted: true,
          workout: { id: 'w-1', date: new Date('2026-11-10T10:00:00Z') },
        },
        {
          id: 'set-2',
          workoutId: 'w-1',
          exerciseId: 'ex-1',
          order: 2,
          weight: 80,
          rep: 7,
          rpe: 9,
          isCompleted: true,
          workout: { id: 'w-1', date: new Date('2026-11-10T10:00:00Z') },
        },
      ]);

      const result = await service.getProgression('ex-1', 'user-1');

      expect(result.history).toHaveLength(1);
      expect(result.history[0].totalVolume).toBe(1200);
      expect(result.history[0].estimated1RM).toBe(101.33);
      expect(result.recommendation.status).toBe('INCREASE_REPS');
      expect(result.recommendation.suggestedWeight).toBe(80);
      expect(result.recommendation.suggestedReps).toBe(9);
    });

    it('should suggest +2.5kg when RPE <= 7', async () => {
      mockPrismaService.exercise.findUnique.mockResolvedValue(mockExercise);
      mockPrismaService.set.findMany.mockResolvedValue([
        {
          id: 'set-1',
          workoutId: 'w-1',
          exerciseId: 'ex-1',
          order: 1,
          weight: 60,
          rep: 8,
          rpe: 7,
          isCompleted: true,
          workout: { id: 'w-1', date: new Date('2026-11-10T10:00:00Z') },
        },
      ]);

      const result = await service.getProgression('ex-1', 'user-1');

      expect(result.recommendation.status).toBe('INCREASE_WEIGHT');
      expect(result.recommendation.suggestedWeight).toBe(62.5);
      expect(result.recommendation.suggestedReps).toBe(8);
    });
  });
});
