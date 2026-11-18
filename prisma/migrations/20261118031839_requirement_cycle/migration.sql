-- AlterTable
ALTER TABLE "Requirement" ADD COLUMN     "carriedFromCycleId" TEXT,
ADD COLUMN     "cycleId" TEXT;

-- CreateIndex
CREATE INDEX "Requirement_cycleId_idx" ON "Requirement"("cycleId");

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_carriedFromCycleId_fkey" FOREIGN KEY ("carriedFromCycleId") REFERENCES "Cycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
