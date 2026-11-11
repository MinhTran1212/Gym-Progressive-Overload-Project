import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { CreateWorkoutSetDto } from './dto/create-workout-set.dto';
import {
  UpdateWorkoutDto,
  UpdateWorkoutSetDto,
} from './dto/update-workout.dto';
import { GetWorkoutsQueryDto } from './dto/get-workouts-query.dto';

const WORKOUT_INCLUDE = {
  set: {
    include: {
      exercise: true,
    },
    orderBy: {
      order: 'asc' as const,
    },
  },
};

@Injectable()
export class WorkoutsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeSets(dto: CreateWorkoutDto | UpdateWorkoutDto) {
    const rawSets: CreateWorkoutSetDto[] = [];

    if (dto.exercises && dto.exercises.length > 0) {
      for (const group of dto.exercises) {
        for (const s of group.sets) {
          rawSets.push({
            exerciseId: group.exerciseId,
            weight: s.weight,
            rep: s.rep,
            rpe: s.rpe,
            order: s.order,
            note: s.note,
            isCompleted: s.isCompleted,
          });
        }
      }
    } else if (dto.set && dto.set.length > 0) {
      rawSets.push(...dto.set);
    }

    return rawSets.map((s, index) => ({
      exerciseId: s.exerciseId,
      weight: s.weight ?? null,
      rep: s.rep ?? null,
      rpe: s.rpe ?? null,
      order: s.order ?? index + 1,
      note: s.note,
      isCompleted: s.isCompleted ?? false,
    }));
  }

  private async syncPinnedNotes(
    dto: CreateWorkoutDto | UpdateWorkoutDto,
    userId?: string,
  ) {
    if (!dto.exercises || dto.exercises.length === 0) return;
    for (const group of dto.exercises) {
      if (group.pinnedNote !== undefined) {
        if (userId) {
          await this.prisma.userExerciseNote.upsert({
            where: {
              userId_exerciseId: {
                userId,
                exerciseId: group.exerciseId,
              },
            },
            update: { pinnedNote: group.pinnedNote },
            create: {
              userId,
              exerciseId: group.exerciseId,
              pinnedNote: group.pinnedNote,
            },
          });
        } else {
          await this.prisma.exercise.update({
            where: { id: group.exerciseId },
            data: { pinnedNote: group.pinnedNote },
          });
        }
      }
    }
  }

  private assertOwnership(
    workout: { userId?: string | null },
    userId?: string,
  ) {
    if (userId !== undefined && workout.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify or delete this workout.',
      );
    }
  }

  private calculateCompletedMetrics(
    sets: Array<{
      weight: unknown;
      rep: number | null;
      isCompleted: boolean;
    }>,
  ) {
    const completedSets = sets.filter((s) => s.isCompleted);
    const totalSets = completedSets.length;
    const totalVolume = Number(
      completedSets
        .reduce((sum, s) => sum + Number(s.weight ?? 0) * (s.rep ?? 0), 0)
        .toFixed(2),
    );
    return { totalSets, totalVolume };
  }

  private async recalculateIfFinished(workoutId: string) {
    const workout = await this.prisma.workout.findUnique({
      where: { id: workoutId },
      include: WORKOUT_INCLUDE,
    });

    if (!workout || !workout.isFinished) {
      return workout;
    }

    const { totalSets, totalVolume } = this.calculateCompletedMetrics(
      workout.set,
    );

    // Recalculate totalVolume & totalSets, while keeping totalTime and endTime unchanged
    return await this.prisma.workout.update({
      where: { id: workoutId },
      data: {
        totalSets,
        totalVolume,
      },
      include: WORKOUT_INCLUDE,
    });
  }

  private async getUserNoteMap(
    userId: string | undefined,
    exerciseIds: string[],
  ): Promise<Map<string, string> | undefined> {
    if (!userId || exerciseIds.length === 0) return undefined;
    const notes = await this.prisma.userExerciseNote.findMany({
      where: {
        userId,
        exerciseId: { in: [...new Set(exerciseIds)] },
      },
    });
    return new Map(notes.map((n) => [n.exerciseId, n.pinnedNote]));
  }

  private formatWorkoutResponse(
    workout: {
      id: string;
      note: string | null;
      userId?: string | null;
      isFinished?: boolean;
      endTime?: Date | null;
      totalTime?: number;
      totalVolume?: unknown;
      totalSets?: number;
      date: Date;
      createdAt: Date;
      updateTime: Date;
      set: Array<{
        id: string;
        weight: unknown;
        rpe: number | null;
        rep: number | null;
        order: number;
        note: string | null;
        isCompleted: boolean;
        exerciseId: string;
        createdAt: Date;
        exercise: {
          id: string;
          name: string;
          muscleGroup: string;
          restTime: number;
          pinnedNote: string | null;
        };
      }>;
    },
    userNoteMap?: Map<string, string>,
  ) {
    const exerciseMap = new Map<
      string,
      {
        exerciseId: string;
        name: string;
        muscleGroup: string;
        restTime: number;
        pinnedNote: string | null;
        sets: Array<{
          id: string;
          order: number;
          weight: number | null;
          rep: number | null;
          rpe: number | null;
          note: string | null;
          isCompleted: boolean;
          createdAt: Date;
        }>;
      }
    >();

    for (const item of workout.set) {
      let group = exerciseMap.get(item.exerciseId);
      if (!group) {
        const personalNote = userNoteMap?.get(item.exercise.id);
        group = {
          exerciseId: item.exercise.id,
          name: item.exercise.name,
          muscleGroup: item.exercise.muscleGroup,
          restTime: item.exercise.restTime,
          pinnedNote:
            personalNote !== undefined
              ? personalNote
              : item.exercise.pinnedNote,
          sets: [],
        };
        exerciseMap.set(item.exerciseId, group);
      }

      group.sets.push({
        id: item.id,
        order: item.order,
        weight:
          item.weight !== null && item.weight !== undefined
            ? Number(item.weight)
            : null,
        rep: item.rep,
        rpe: item.rpe,
        note: item.note,
        isCompleted: item.isCompleted,
        createdAt: item.createdAt,
      });
    }

    const isFinished = Boolean(workout.isFinished);
    const { totalSets: liveSetsCount, totalVolume: liveVolume } =
      this.calculateCompletedMetrics(workout.set);
    const liveElapsedSeconds = Math.max(
      0,
      Math.floor((Date.now() - workout.createdAt.getTime()) / 1000),
    );

    return {
      id: workout.id,
      note: workout.note,
      userId: workout.userId ?? null,
      isFinished,
      endTime: workout.endTime ?? null,
      totalTime: isFinished ? (workout.totalTime ?? 0) : liveElapsedSeconds,
      totalVolume: isFinished ? Number(workout.totalVolume ?? 0) : liveVolume,
      totalSets: isFinished ? (workout.totalSets ?? 0) : liveSetsCount,
      date: workout.date,
      createdAt: workout.createdAt,
      updateTime: workout.updateTime,
      exercises: Array.from(exerciseMap.values()),
      set: workout.set.map((s) => ({
        ...s,
        weight:
          s.weight !== null && s.weight !== undefined
            ? Number(s.weight)
            : null,
      })),
    };
  }

  async create(createWorkoutDto: CreateWorkoutDto, userId?: string) {
    const setsToCreate = this.normalizeSets(createWorkoutDto);
    await this.syncPinnedNotes(createWorkoutDto, userId);

    const workout = await this.prisma.workout.create({
      data: {
        note: createWorkoutDto.note,
        ...(userId ? { userId } : {}),
        ...(createWorkoutDto.date
          ? { date: new Date(createWorkoutDto.date) }
          : {}),
        ...(setsToCreate.length > 0
          ? {
              set: {
                create: setsToCreate,
              },
            }
          : {}),
      },
      include: WORKOUT_INCLUDE,
    });

    const noteMap = await this.getUserNoteMap(
      userId,
      workout.set.map((s) => s.exerciseId),
    );
    return this.formatWorkoutResponse(workout, noteMap);
  }

  async findAll(query?: GetWorkoutsQueryDto, userId?: string) {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 10;
    const skip = (page - 1) * limit;
    const whereClause = query?.userId ? { userId: query.userId } : {};

    const [workouts, total] = await Promise.all([
      this.prisma.workout.findMany({
        where: whereClause,
        include: WORKOUT_INCLUDE,
        orderBy: {
          date: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.workout.count({ where: whereClause }),
    ]);

    const allExerciseIds = workouts.flatMap((w) =>
      w.set.map((s) => s.exerciseId),
    );
    const noteMap = await this.getUserNoteMap(userId, allExerciseIds);

    return {
      data: workouts.map((workout) =>
        this.formatWorkoutResponse(workout, noteMap),
      ),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId?: string) {
    const workout = await this.prisma.workout.findUnique({
      where: { id },
      include: WORKOUT_INCLUDE,
    });

    if (!workout) {
      throw new NotFoundException(`Workout with ID ${id} is not found.`);
    }

    const noteMap = await this.getUserNoteMap(
      userId,
      workout.set.map((s) => s.exerciseId),
    );
    return this.formatWorkoutResponse(workout, noteMap);
  }

  async update(
    id: string,
    updateWorkoutDto: UpdateWorkoutDto,
    userId?: string,
  ) {
    const existing = await this.findOne(id, userId);
    this.assertOwnership(existing, userId);

    const hasSetsUpdate =
      updateWorkoutDto.set !== undefined ||
      updateWorkoutDto.exercises !== undefined;
    const setsToCreate = this.normalizeSets(updateWorkoutDto);

    const updatedWorkout = await this.prisma.$transaction(async (tx) => {
      if (hasSetsUpdate) {
        await tx.set.deleteMany({
          where: { workoutId: id },
        });
      }

      const recalculatedMetrics =
        existing.isFinished && hasSetsUpdate
          ? this.calculateCompletedMetrics(setsToCreate)
          : undefined;

      return await tx.workout.update({
        where: { id },
        data: {
          ...(updateWorkoutDto.note !== undefined
            ? { note: updateWorkoutDto.note }
            : {}),
          ...(updateWorkoutDto.date !== undefined
            ? { date: new Date(updateWorkoutDto.date) }
            : {}),
          ...(recalculatedMetrics
            ? {
                totalSets: recalculatedMetrics.totalSets,
                totalVolume: recalculatedMetrics.totalVolume,
              }
            : {}),
          ...(hasSetsUpdate && setsToCreate.length > 0
            ? {
                set: {
                  create: setsToCreate,
                },
              }
            : {}),
        },
        include: WORKOUT_INCLUDE,
      });
    });

    await this.syncPinnedNotes(updateWorkoutDto, userId);

    const noteMap = await this.getUserNoteMap(
      userId,
      updatedWorkout.set.map((s) => s.exerciseId),
    );
    return this.formatWorkoutResponse(updatedWorkout, noteMap);
  }

  async finishWorkout(id: string, userId?: string) {
    const workout = await this.prisma.workout.findUnique({
      where: { id },
      include: WORKOUT_INCLUDE,
    });

    if (!workout) {
      throw new NotFoundException(`Workout with ID ${id} is not found.`);
    }

    this.assertOwnership(workout, userId);

    if (workout.isFinished) {
      throw new BadRequestException(
        `Workout with ID ${id} is already finished.`,
      );
    }

    const { totalSets, totalVolume } = this.calculateCompletedMetrics(
      workout.set,
    );

    const endTime = new Date();
    const totalTime = Math.max(
      0,
      Math.floor((endTime.getTime() - workout.createdAt.getTime()) / 1000),
    );

    const finishedWorkout = await this.prisma.workout.update({
      where: { id },
      data: {
        isFinished: true,
        endTime,
        totalTime,
        totalVolume,
        totalSets,
      },
      include: WORKOUT_INCLUDE,
    });

    const noteMap = await this.getUserNoteMap(
      userId,
      finishedWorkout.set.map((s) => s.exerciseId),
    );
    return this.formatWorkoutResponse(finishedWorkout, noteMap);
  }

  async addSet(
    workoutId: string,
    createSetDto: CreateWorkoutSetDto,
    userId?: string,
  ) {
    const workout = await this.findOne(workoutId, userId);
    this.assertOwnership(workout, userId);

    const nextOrder =
      createSetDto.order ??
      (workout.set.length > 0
        ? Math.max(...workout.set.map((s) => s.order)) + 1
        : 1);

    const createdSet = await this.prisma.set.create({
      data: {
        workoutId,
        exerciseId: createSetDto.exerciseId,
        weight: createSetDto.weight,
        rep: createSetDto.rep,
        rpe: createSetDto.rpe,
        order: nextOrder,
        note: createSetDto.note,
        isCompleted: createSetDto.isCompleted ?? false,
      },
      include: {
        exercise: true,
      },
    });

    if (workout.isFinished) {
      await this.recalculateIfFinished(workoutId);
    }

    return {
      ...createdSet,
      weight:
        createdSet.weight !== null && createdSet.weight !== undefined
          ? Number(createdSet.weight)
          : null,
      restTimer: {
        shouldStart: createdSet.isCompleted,
        durationSeconds: createdSet.exercise.restTime,
        canSkip: true,
      },
    };
  }

  async updateSet(
    workoutId: string,
    setId: string,
    updateSetDto: UpdateWorkoutSetDto,
    userId?: string,
  ) {
    const workout = await this.findOne(workoutId, userId);
    this.assertOwnership(workout, userId);

    const existingSet = await this.prisma.set.findFirst({
      where: {
        id: setId,
        workoutId,
      },
    });

    if (!existingSet) {
      throw new NotFoundException(
        `Set with ID ${setId} not found in workout ${workoutId}.`,
      );
    }

    const updatedSet = await this.prisma.set.update({
      where: { id: setId },
      data: {
        ...(updateSetDto.exerciseId !== undefined
          ? { exerciseId: updateSetDto.exerciseId }
          : {}),
        ...(updateSetDto.weight !== undefined
          ? { weight: updateSetDto.weight }
          : {}),
        ...(updateSetDto.rep !== undefined ? { rep: updateSetDto.rep } : {}),
        ...(updateSetDto.rpe !== undefined ? { rpe: updateSetDto.rpe } : {}),
        ...(updateSetDto.order !== undefined
          ? { order: updateSetDto.order }
          : {}),
        ...(updateSetDto.note !== undefined ? { note: updateSetDto.note } : {}),
        ...(updateSetDto.isCompleted !== undefined
          ? { isCompleted: updateSetDto.isCompleted }
          : {}),
      },
      include: {
        exercise: true,
      },
    });

    if (workout.isFinished) {
      await this.recalculateIfFinished(workoutId);
    }

    return {
      ...updatedSet,
      weight:
        updatedSet.weight !== null && updatedSet.weight !== undefined
          ? Number(updatedSet.weight)
          : null,
      restTimer: {
        shouldStart: Boolean(updateSetDto.isCompleted),
        durationSeconds: updatedSet.exercise.restTime,
        canSkip: true,
      },
    };
  }

  async removeSet(workoutId: string, setId: string, userId?: string) {
    const workout = await this.findOne(workoutId, userId);
    this.assertOwnership(workout, userId);

    const existingSet = await this.prisma.set.findFirst({
      where: {
        id: setId,
        workoutId,
      },
    });

    if (!existingSet) {
      throw new NotFoundException(
        `Set with ID ${setId} not found in workout ${workoutId}.`,
      );
    }

    const deletedSet = await this.prisma.set.delete({
      where: { id: setId },
    });

    if (workout.isFinished) {
      await this.recalculateIfFinished(workoutId);
    }

    return deletedSet;
  }

  async remove(id: string, userId?: string) {
    const workout = await this.findOne(id, userId);
    this.assertOwnership(workout, userId);

    return await this.prisma.workout.delete({
      where: { id },
    });
  }
}
