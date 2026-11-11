-- DropForeignKey
ALTER TABLE "Set" DROP CONSTRAINT "Set_templateId_fkey";

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "pinnedNote" TEXT,
ADD COLUMN     "restTime" INTEGER NOT NULL DEFAULT 90;

-- AlterTable
ALTER TABLE "Set" ADD COLUMN     "isCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "note" TEXT,
ALTER COLUMN "workoutId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "note" TEXT;

-- AddForeignKey
ALTER TABLE "Set" ADD CONSTRAINT "Set_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
