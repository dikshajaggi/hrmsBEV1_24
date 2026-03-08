-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'NOT_SPECIFIED');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "gender" "Gender" NOT NULL DEFAULT 'NOT_SPECIFIED';
