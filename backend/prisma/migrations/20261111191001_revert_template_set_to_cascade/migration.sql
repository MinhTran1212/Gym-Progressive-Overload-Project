-- DropForeignKey
ALTER TABLE "Set" DROP CONSTRAINT "Set_templateId_fkey";

-- AddForeignKey
ALTER TABLE "Set" ADD CONSTRAINT "Set_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
