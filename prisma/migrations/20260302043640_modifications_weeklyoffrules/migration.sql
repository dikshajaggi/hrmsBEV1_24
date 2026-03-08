/*
  Warnings:

  - A unique constraint covering the columns `[dayOfWeek]` on the table `WeeklyOffRule` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "WeeklyOffRule" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyOffRule_dayOfWeek_key" ON "WeeklyOffRule"("dayOfWeek");

-- CreateIndex
CREATE INDEX "WeeklyOffRule_isActive_idx" ON "WeeklyOffRule"("isActive");
