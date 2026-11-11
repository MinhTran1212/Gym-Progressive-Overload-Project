import { jest } from '@jest/globals';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkoutsService } from './workouts.service';
import { PrismaService } from '../prisma/prisma.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AsyncMockFn = (...args: any[]) => Promise<any>;

describe('WorkoutsService', () => {
  let service: WorkoutsService;

  const mockPrismaService = {
    workout: {
      create: jest.fn<AsyncMockFn>(),
      findMany: jest.fn<AsyncMockFn>(),
      findUnique: jest.fn<AsyncMockFn>(),
      update: jest.fn<AsyncMockFn>(),
      delete: jest.fn<AsyncMockFn>(),
      count: jest.fn<AsyncMockFn>(),
    },
    set: {
      create: jest.fn<AsyncMockFn>(),
      findFirst: jest.fn<AsyncMockFn>(),
      update: jest.fn<AsyncMockFn>(),
      delete: jest.fn<AsyncMockFn>(),
      deleteMany: jest.fn<AsyncMockFn>(),
    },
    userExerciseNote: {
      findMany: jest.fn<AsyncMockFn>(),
      upsert: jest.fn<AsyncMockFn>(),
    },
    exercise: {
      update: jest.fn<AsyncMockFn>(),
    },
    $transaction: jest.fn<AsyncMockFn>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrismaService.userExerciseNote.findMany.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkoutsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<WorkoutsService>(WorkoutsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a workout with grouped exercises and format the response', async () => {
    const now = new Date();
    mockPrismaService.workout.create.mockResolvedValue({
      id: 'w-1',
      note: 'Push Day',
      userId: 'user-1',
      isFinished: false,
      endTime: null,
      totalTime: 0,
      totalVolume: 0,
      totalSets: 0,
      date: now,
      createdAt: now,
      updateTime: now,
      set: [
        {
          id: 's-1',
          weight: 80,
          rep: 8,
          rpe: 8,
          order: 1,
          note: null,
          isCompleted: true,
          exerciseId: 'ex-1',
          createdAt: now,
          exercise: {
            id: 'ex-1',
            name: 'Bench Press',
            muscleGroup: 'Chest',
            restTime: 120,
            pinnedNote: null,
          },
        },
      ],
    });

    const result = await service.create(
      {
        note: 'Push Day',
        exercises: [
          {
            exerciseId: 'ex-1',
            sets: [{ weight: 80, rep: 8, rpe: 8, isCompleted: true }],
          },
        ],
      },
      'user-1',
    );

    expect(result.id).toBe('w-1');
    expect(result.userId).toBe('user-1');
    expect(result.isFinished).toBe(false);
    expect(result.totalVolume).toBe(640);
    expect(result.totalSets).toBe(1);
    expect(result.exercises).toHaveLength(1);
    expect(result.exercises[0].name).toBe('Bench Press');
    expect(result.exercises[0].sets[0].weight).toBe(80);
  });

  it('should allow viewing another user workout, but throw ForbiddenException when trying to delete it', async () => {
    const now = new Date();
    mockPrismaService.workout.findUnique.mockResolvedValue({
      id: 'w-owner-1',
      note: 'Owner 1 Workout',
      userId: 'user-1',
      isFinished: true,
      endTime: now,
      totalTime: 1800,
      totalVolume: 800,
      totalSets: 1,
      date: now,
      createdAt: now,
      updateTime: now,
      set: [],
    });

    // user-2 can view user-1's workout
    const viewed = await service.findOne('w-owner-1', 'user-2');
    expect(viewed.id).toBe('w-owner-1');

    // user-2 cannot delete user-1's workout
    await expect(service.remove('w-owner-1', 'user-2')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should recalculate totalVolume & totalSets while keeping totalTime unchanged when removing a set from a finished workout', async () => {
    const now = new Date();
    mockPrismaService.workout.findUnique
      .mockResolvedValueOnce({
        id: 'w-1',
        note: 'Finished Push Day',
        userId: 'user-1',
        isFinished: true,
        endTime: now,
        totalTime: 3600,
        totalVolume: 1440,
        totalSets: 2,
        date: now,
        createdAt: now,
        updateTime: now,
        set: [
          {
            id: 's-1',
            weight: 80,
            rep: 10,
            rpe: 8,
            order: 1,
            note: null,
            isCompleted: true,
            exerciseId: 'ex-1',
            createdAt: now,
            exercise: {
              id: 'ex-1',
              name: 'Bench Press',
              muscleGroup: 'Chest',
              restTime: 120,
              pinnedNote: null,
            },
          },
          {
            id: 's-2',
            weight: 80,
            rep: 8,
            rpe: 9,
            order: 2,
            note: null,
            isCompleted: true,
            exerciseId: 'ex-1',
            createdAt: now,
            exercise: {
              id: 'ex-1',
              name: 'Bench Press',
              muscleGroup: 'Chest',
              restTime: 120,
              pinnedNote: null,
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        id: 'w-1',
        note: 'Finished Push Day',
        userId: 'user-1',
        isFinished: true,
        endTime: now,
        totalTime: 3600,
        totalVolume: 1440,
        totalSets: 2,
        date: now,
        createdAt: now,
        updateTime: now,
        set: [
          {
            id: 's-1',
            weight: 80,
            rep: 10,
            rpe: 8,
            order: 1,
            note: null,
            isCompleted: true,
            exerciseId: 'ex-1',
            createdAt: now,
            exercise: {
              id: 'ex-1',
              name: 'Bench Press',
              muscleGroup: 'Chest',
              restTime: 120,
              pinnedNote: null,
            },
          },
        ],
      });

    mockPrismaService.set.findFirst.mockResolvedValue({
      id: 's-2',
      workoutId: 'w-1',
    });
    mockPrismaService.set.delete.mockResolvedValue({ id: 's-2' });
    mockPrismaService.workout.update.mockResolvedValue({});

    await service.removeSet('w-1', 's-2', 'user-1');

    // Verifyworkout.update was called with recalculated totalSets=1, totalVolume=800, and NO change to totalTime
    expect(mockPrismaService.workout.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'w-1' },
        data: {
          totalSets: 1,
          totalVolume: 800,
        },
      }),
    );
  });

  it('should finalize totalVolume, totalSets (completed only), and totalTime when finishWorkout is called', async () => {
    const createdAt = new Date(Date.now() - 3600 * 1000);
    const mockSets = [
      {
        id: 's-1',
        weight: 80,
        rep: 10,
        rpe: 8,
        order: 1,
        note: null,
        isCompleted: true,
        exerciseId: 'ex-1',
        createdAt,
        exercise: {
          id: 'ex-1',
          name: 'Bench Press',
          muscleGroup: 'Chest',
          restTime: 120,
          pinnedNote: null,
        },
      },
      {
        id: 's-2',
        weight: 80,
        rep: 8,
        rpe: 9,
        order: 2,
        note: null,
        isCompleted: false,
        exerciseId: 'ex-1',
        createdAt,
        exercise: {
          id: 'ex-1',
          name: 'Bench Press',
          muscleGroup: 'Chest',
          restTime: 120,
          pinnedNote: null,
        },
      },
    ];

    mockPrismaService.workout.findUnique.mockResolvedValue({
      id: 'w-1',
      note: 'Push Day',
      userId: 'user-1',
      isFinished: false,
      endTime: null,
      totalTime: 0,
      totalVolume: 0,
      totalSets: 0,
      date: createdAt,
      createdAt,
      updateTime: createdAt,
      set: mockSets,
    });

    mockPrismaService.workout.update.mockImplementation(async (args: any) => ({
      id: 'w-1',
      note: 'Push Day',
      userId: 'user-1',
      isFinished: args.data.isFinished,
      endTime: args.data.endTime,
      totalTime: args.data.totalTime,
      totalVolume: args.data.totalVolume,
      totalSets: args.data.totalSets,
      date: createdAt,
      createdAt,
      updateTime: new Date(),
      set: mockSets,
    }));

    const result = await service.finishWorkout('w-1', 'user-1');

    expect(result.isFinished).toBe(true);
    expect(result.totalSets).toBe(1);
    expect(result.totalVolume).toBe(800);
    expect(result.totalTime).toBeGreaterThanOrEqual(3600);
  });

  it('should throw BadRequestException if workout is already finished', async () => {
    const now = new Date();
    mockPrismaService.workout.findUnique.mockResolvedValue({
      id: 'w-1',
      note: 'Push Day',
      userId: 'user-1',
      isFinished: true,
      endTime: now,
      totalTime: 3600,
      totalVolume: 1440,
      totalSets: 2,
      date: now,
      createdAt: now,
      updateTime: now,
      set: [],
    });

    await expect(service.finishWorkout('w-1', 'user-1')).rejects.toThrow(
      BadRequestException,
    );
  });
});
