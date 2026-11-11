import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { CreateWorkoutSetDto } from '../workouts/dto/create-workout-set.dto';
import { WorkoutsService } from '../workouts/workouts.service';

const TEMPLATE_INCLUDE = {
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
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workoutsService: WorkoutsService,
  ) {}

  private normalizeSets(dto: CreateTemplateDto | UpdateTemplateDto) {
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
            isCompleted: false,
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
      isCompleted: false,
    }));
  }

  private async validateExerciseIds(sets: Array<{ exerciseId: string }>) {
    if (sets.length === 0) return;

    const uniqueExerciseIds = [...new Set(sets.map((s) => s.exerciseId))];
    const existingCount = await this.prisma.exercise.count({
      where: {
        id: {
          in: uniqueExerciseIds,
        },
      },
    });

    if (existingCount !== uniqueExerciseIds.length) {
      throw new BadRequestException(
        'One or more exerciseId values do not exist.',
      );
    }
  }

  private async syncPinnedNotes(
    dto: CreateTemplateDto | UpdateTemplateDto,
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

  private formatTemplateResponse(
    template: {
      id: string;
      name: string;
      note: string | null;
      userId?: string | null;
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
        }>;
      }
    >();

    for (const item of template.set) {
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
      });
    }

    return {
      id: template.id,
      name: template.name,
      note: template.note,
      userId: template.userId ?? null,
      createdAt: template.createdAt,
      updateTime: template.updateTime,
      exercises: Array.from(exerciseMap.values()),
      set: template.set.map((s) => ({
        ...s,
        weight:
          s.weight !== null && s.weight !== undefined
            ? Number(s.weight)
            : null,
      })),
    };
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

  async create(createTemplateDto: CreateTemplateDto, userId?: string) {
    const setsToCreate = this.normalizeSets(createTemplateDto);
    await this.validateExerciseIds(setsToCreate);
    await this.syncPinnedNotes(createTemplateDto, userId);

    const template = await this.prisma.template.create({
      data: {
        name: createTemplateDto.name,
        note: createTemplateDto.note,
        ...(userId ? { userId } : {}),
        ...(setsToCreate.length > 0
          ? {
              set: {
                create: setsToCreate,
              },
            }
          : {}),
      },
      include: TEMPLATE_INCLUDE,
    });

    const noteMap = await this.getUserNoteMap(
      userId,
      template.set.map((s) => s.exerciseId),
    );
    return this.formatTemplateResponse(template, noteMap);
  }

  async findAll(userId?: string) {
    const templates = await this.prisma.template.findMany({
      include: TEMPLATE_INCLUDE,
      orderBy: {
        createdAt: 'desc',
      },
    });

    const allExerciseIds = templates.flatMap((t) =>
      t.set.map((s) => s.exerciseId),
    );
    const noteMap = await this.getUserNoteMap(userId, allExerciseIds);

    return templates.map((t) => this.formatTemplateResponse(t, noteMap));
  }

  async findOne(id: string, userId?: string) {
    const template = await this.prisma.template.findUnique({
      where: { id },
      include: TEMPLATE_INCLUDE,
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found.`);
    }

    const noteMap = await this.getUserNoteMap(
      userId,
      template.set.map((s) => s.exerciseId),
    );
    return this.formatTemplateResponse(template, noteMap);
  }

  async update(
    id: string,
    updateTemplateDto: UpdateTemplateDto,
    userId?: string,
  ) {
    const existing = await this.findOne(id, userId);

    if (userId !== undefined && existing.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this template.',
      );
    }

    const hasSetsUpdate =
      updateTemplateDto.set !== undefined ||
      updateTemplateDto.exercises !== undefined;
    const setsToCreate = this.normalizeSets(updateTemplateDto);

    if (hasSetsUpdate) {
      await this.validateExerciseIds(setsToCreate);
      await this.syncPinnedNotes(updateTemplateDto, userId);
    }

    const updatedTemplate = await this.prisma.$transaction(async (tx) => {
      if (hasSetsUpdate) {
        await tx.set.deleteMany({
          where: {
            templateId: id,
            workoutId: null,
          },
        });
      }

      return await tx.template.update({
        where: { id },
        data: {
          ...(updateTemplateDto.name !== undefined
            ? { name: updateTemplateDto.name }
            : {}),
          ...(updateTemplateDto.note !== undefined
            ? { note: updateTemplateDto.note }
            : {}),
          ...(hasSetsUpdate && setsToCreate.length > 0
            ? {
                set: {
                  create: setsToCreate,
                },
              }
            : {}),
        },
        include: TEMPLATE_INCLUDE,
      });
    });

    const noteMap = await this.getUserNoteMap(
      userId,
      updatedTemplate.set.map((s) => s.exerciseId),
    );
    return this.formatTemplateResponse(updatedTemplate, noteMap);
  }

  async remove(id: string, userId?: string) {
    const existing = await this.findOne(id, userId);

    if (userId !== undefined && existing.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this template.',
      );
    }

    return await this.prisma.template.delete({
      where: { id },
    });
  }

  async startWorkout(id: string, userId?: string) {
    const template = await this.findOne(id, userId);

    const clonedSets = template.set.map((s, index) => ({
      exerciseId: s.exerciseId,
      weight:
        s.weight !== null && s.weight !== undefined
          ? Number(s.weight)
          : undefined,
      rep: s.rep ?? undefined,
      rpe: s.rpe ?? undefined,
      order: s.order ?? index + 1,
      note: s.note ?? undefined,
      isCompleted: false,
    }));

    return await this.workoutsService.create(
      {
        note: template.note
          ? `[${template.name}] ${template.note}`
          : `Workout from template: ${template.name}`,
        set: clonedSets,
      },
      userId,
    );
  }
}
