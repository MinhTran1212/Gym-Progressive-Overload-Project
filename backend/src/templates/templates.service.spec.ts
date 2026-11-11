import { jest } from '@jest/globals';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TemplatesService } from './templates.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkoutsService } from '../workouts/workouts.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AsyncMockFn = (...args: any[]) => Promise<any>;

describe('TemplatesService', () => {
  let service: TemplatesService;

  const mockPrismaService = {
    template: {
      create: jest.fn<AsyncMockFn>(),
      findMany: jest.fn<AsyncMockFn>(),
      findUnique: jest.fn<AsyncMockFn>(),
      update: jest.fn<AsyncMockFn>(),
      delete: jest.fn<AsyncMockFn>(),
    },
    exercise: {
      count: jest.fn<AsyncMockFn>(),
      update: jest.fn<AsyncMockFn>(),
    },
    userExerciseNote: {
      findMany: jest.fn<AsyncMockFn>(),
      upsert: jest.fn<AsyncMockFn>(),
    },
    set: {
      deleteMany: jest.fn<AsyncMockFn>(),
    },
    $transaction: jest.fn<AsyncMockFn>(),
  };

  const mockWorkoutsService = {
    create: jest.fn<AsyncMockFn>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrismaService.userExerciseNote.findMany.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplatesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: WorkoutsService,
          useValue: mockWorkoutsService,
        },
      ],
    }).compile();

    service = module.get<TemplatesService>(TemplatesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw BadRequestException when creating a template with non-existent exerciseId', async () => {
    mockPrismaService.exercise.count.mockResolvedValue(0);

    await expect(
      service.create({
        name: 'Push Day',
        set: [
          {
            exerciseId: 'non-existent-id',
            weight: 60,
            rep: 8,
            rpe: 8,
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should allow viewing another user template, but throw ForbiddenException when trying to delete it', async () => {
    const now = new Date();
    mockPrismaService.template.findUnique.mockResolvedValue({
      id: 'tpl-1',
      name: 'User 1 Template',
      note: null,
      userId: 'user-1',
      createdAt: now,
      updateTime: now,
      set: [],
    });

    // user-2 can view user-1's template
    const viewed = await service.findOne('tpl-1', 'user-2');
    expect(viewed.id).toBe('tpl-1');

    // user-2 cannot delete user-1's template
    await expect(service.remove('tpl-1', 'user-2')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should clone template sets into a new workout owned by the current user when startWorkout is called', async () => {
    const now = new Date();
    mockPrismaService.template.findUnique.mockResolvedValue({
      id: 'tpl-1',
      name: 'Upper Body A',
      note: 'Heavy compound focus',
      userId: 'user-1',
      createdAt: now,
      updateTime: now,
      set: [
        {
          id: 'ts-1',
          weight: 70,
          rep: 8,
          rpe: 8,
          order: 1,
          note: 'Warmup properly',
          isCompleted: false,
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

    mockWorkoutsService.create.mockResolvedValue({
      id: 'w-new',
      userId: 'user-2',
      note: '[Upper Body A] Heavy compound focus',
    });

    const result = await service.startWorkout('tpl-1', 'user-2');

    expect(mockWorkoutsService.create).toHaveBeenCalledWith(
      {
        note: '[Upper Body A] Heavy compound focus',
        set: [
          {
            exerciseId: 'ex-1',
            weight: 70,
            rep: 8,
            rpe: 8,
            order: 1,
            note: 'Warmup properly',
            isCompleted: false,
          },
        ],
      },
      'user-2',
    );
    expect(result.id).toBe('w-new');
  });
});
