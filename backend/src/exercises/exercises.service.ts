import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';

@Injectable()
export class ExercisesService {
  constructor(private readonly prisma: PrismaService) {}

  private attachUserNote<
    T extends {
      id: string;
      pinnedNote: string | null;
      userNotes?: Array<{ pinnedNote: string }>;
    },
  >(exercise: T) {
    const personalNote = exercise.userNotes?.[0]?.pinnedNote;
    const { userNotes: _unused, ...rest } = exercise;
    return {
      ...rest,
      pinnedNote: personalNote !== undefined ? personalNote : rest.pinnedNote,
    };
  }

  async findAll(userId?: string) {
    const exercises = await this.prisma.exercise.findMany(
      userId
        ? {
            include: {
              userNotes: {
                where: { userId },
                select: { pinnedNote: true },
              },
            },
          }
        : undefined,
    );

    return exercises.map((ex) => this.attachUserNote(ex));
  }

  async findOne(id: string, userId?: string) {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id },
      ...(userId
        ? {
            include: {
              userNotes: {
                where: { userId },
                select: { pinnedNote: true },
              },
            },
          }
        : {}),
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${id} not found`);
    }

    return this.attachUserNote(exercise);
  }

  async create(createExerciseDto: CreateExerciseDto, userId?: string) {
    const created = await this.prisma.exercise.create({
      data: {
        name: createExerciseDto.name,
        muscleGroup: createExerciseDto.muscleGroup,
        ...(createExerciseDto.restTime !== undefined
          ? { restTime: createExerciseDto.restTime }
          : {}),
        pinnedNote: createExerciseDto.pinnedNote,
        ...(userId ? { userId } : {}),
      },
    });

    if (userId && createExerciseDto.pinnedNote !== undefined) {
      await this.prisma.userExerciseNote.upsert({
        where: {
          userId_exerciseId: {
            userId,
            exerciseId: created.id,
          },
        },
        update: { pinnedNote: createExerciseDto.pinnedNote },
        create: {
          userId,
          exerciseId: created.id,
          pinnedNote: createExerciseDto.pinnedNote,
        },
      });
    }

    return created;
  }

  async findByMuscle(muscleGroup: string, userId?: string) {
    const exercises = await this.prisma.exercise.findMany({
      where: {
        muscleGroup: {
          equals: muscleGroup,
          mode: 'insensitive',
        },
      },
      ...(userId
        ? {
            include: {
              userNotes: {
                where: { userId },
                select: { pinnedNote: true },
              },
            },
          }
        : {}),
    });

    return exercises.map((ex) => this.attachUserNote(ex));
  }

  async deleteOne(id: string, userId?: string) {
    const exercise = await this.findOne(id, userId);

    if (userId !== undefined && exercise.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this exercise.',
      );
    }

    return await this.prisma.exercise.delete({
      where: { id },
    });
  }

  async updateOne(
    id: string,
    updateExerciseDto: UpdateExerciseDto,
    userId?: string,
  ) {
    const exercise = await this.findOne(id, userId);

    const hasCoreFieldUpdates =
      updateExerciseDto.name !== undefined ||
      updateExerciseDto.muscleGroup !== undefined ||
      updateExerciseDto.restTime !== undefined;

    if (
      hasCoreFieldUpdates &&
      userId !== undefined &&
      exercise.userId !== userId
    ) {
      throw new ForbiddenException(
        'You can only modify core fields (name, muscleGroup, restTime) of exercises you created.',
      );
    }

    if (userId && updateExerciseDto.pinnedNote !== undefined) {
      await this.prisma.userExerciseNote.upsert({
        where: {
          userId_exerciseId: {
            userId,
            exerciseId: id,
          },
        },
        update: { pinnedNote: updateExerciseDto.pinnedNote },
        create: {
          userId,
          exerciseId: id,
          pinnedNote: updateExerciseDto.pinnedNote,
        },
      });
    }

    if (hasCoreFieldUpdates || !userId) {
      const updated = await this.prisma.exercise.update({
        where: { id },
        data: {
          ...(updateExerciseDto.name !== undefined
            ? { name: updateExerciseDto.name }
            : {}),
          ...(updateExerciseDto.muscleGroup !== undefined
            ? { muscleGroup: updateExerciseDto.muscleGroup }
            : {}),
          ...(updateExerciseDto.restTime !== undefined
            ? { restTime: updateExerciseDto.restTime }
            : {}),
          ...(!userId && updateExerciseDto.pinnedNote !== undefined
            ? { pinnedNote: updateExerciseDto.pinnedNote }
            : {}),
        },
      });
      return {
        ...updated,
        pinnedNote:
          updateExerciseDto.pinnedNote !== undefined
            ? updateExerciseDto.pinnedNote
            : exercise.pinnedNote,
      };
    }

    return {
      ...exercise,
      pinnedNote:
        updateExerciseDto.pinnedNote !== undefined
          ? updateExerciseDto.pinnedNote
          : exercise.pinnedNote,
    };
  }

  async getProgression(id: string, userId?: string) {
    const exercise = await this.findOne(id, userId);

    const sets = await this.prisma.set.findMany({
      where: {
        exerciseId: id,
        workoutId: { not: null },
        ...(userId ? { workout: { userId } } : {}),
      },
      include: {
        workout: true,
      },
      orderBy: [{ workout: { date: 'desc' } }, { order: 'asc' }],
    });

    const sessionMap = new Map<
      string,
      {
        workoutId: string;
        date: Date;
        sets: Array<{
          id: string;
          order: number;
          weight: number;
          rep: number;
          rpe: number;
          isCompleted: boolean;
          estimated1RM: number;
          volume: number;
        }>;
      }
    >();

    for (const item of sets) {
      if (!item.workoutId || !item.workout) continue;
      if (item.weight === null || item.rep === null || item.rep <= 0) continue;

      let session = sessionMap.get(item.workoutId);
      if (!session) {
        session = {
          workoutId: item.workoutId,
          date: item.workout.date,
          sets: [],
        };
        sessionMap.set(item.workoutId, session);
      }

      const weight = Number(item.weight);
      const rep = item.rep;
      const rpe = item.rpe ?? 8;
      const estimated1RM = Number((weight * (1 + rep / 30)).toFixed(2));
      const volume = Number((weight * rep).toFixed(2));

      session.sets.push({
        id: item.id,
        order: item.order,
        weight,
        rep,
        rpe,
        isCompleted: item.isCompleted,
        estimated1RM,
        volume,
      });
    }

    const history = Array.from(sessionMap.values()).map((session) => {
      const completedSets = session.sets.filter((s) => s.isCompleted);
      const activeSets =
        completedSets.length > 0 ? completedSets : session.sets;

      const totalVolume = Number(
        activeSets.reduce((sum, s) => sum + s.volume, 0).toFixed(2),
      );

      const bestSet = activeSets.reduce((best, current) => {
        if (current.estimated1RM > best.estimated1RM) return current;
        if (
          current.estimated1RM === best.estimated1RM &&
          current.weight > best.weight
        ) {
          return current;
        }
        return best;
      }, activeSets[0]);

      return {
        workoutId: session.workoutId,
        date: session.date,
        totalSets: activeSets.length,
        totalVolume,
        estimated1RM: bestSet.estimated1RM,
        bestSet,
        sets: session.sets,
      };
    });

    if (history.length === 0) {
      return {
        exercise,
        recommendation: {
          status: 'NO_HISTORY' as const,
          suggestedWeight: null,
          suggestedReps: 8,
          targetRpe: 8,
          reason:
            'No workout history found for this exercise. Start with a comfortable working weight for 8 reps at RPE 8.',
        },
        history: [],
      };
    }

    const latestSession = history[0];
    const best = latestSession.bestSet;

    let recommendation: {
      status: 'INCREASE_WEIGHT' | 'INCREASE_REPS' | 'MAINTAIN';
      suggestedWeight: number;
      suggestedReps: number;
      targetRpe: number;
      reason: string;
    };

    if (best.rpe <= 7) {
      const nextWeight = Number((best.weight + 2.5).toFixed(2));
      recommendation = {
        status: 'INCREASE_WEIGHT',
        suggestedWeight: nextWeight,
        suggestedReps: best.rep,
        targetRpe: 8,
        reason: `Last best set (${best.weight}kg x ${best.rep} @ RPE ${best.rpe}) had plenty of reps in reserve. Increase weight by +2.5kg.`,
      };
    } else if (best.rpe <= 9) {
      if (best.rep < 10) {
        recommendation = {
          status: 'INCREASE_REPS',
          suggestedWeight: best.weight,
          suggestedReps: best.rep + 1,
          targetRpe: best.rpe,
          reason: `Last best set (${best.weight}kg x ${best.rep} @ RPE ${best.rpe}) is in the optimal progression zone. Add +1 rep before increasing weight.`,
        };
      } else {
        const nextWeight = Number((best.weight + 2.5).toFixed(2));
        recommendation = {
          status: 'INCREASE_WEIGHT',
          suggestedWeight: nextWeight,
          suggestedReps: 8,
          targetRpe: 8,
          reason: `Reached ${best.rep} reps at ${best.weight}kg (RPE ${best.rpe}). Increase weight by +2.5kg and reset rep target to 8.`,
        };
      }
    } else {
      recommendation = {
        status: 'MAINTAIN',
        suggestedWeight: best.weight,
        suggestedReps: best.rep,
        targetRpe: 9,
        reason: `Last best set (${best.weight}kg x ${best.rep}) reached RPE 10 (near failure). Maintain weight and reps to consolidate strength and improve technique.`,
      };
    }

    return {
      exercise,
      recommendation,
      history,
    };
  }
}
