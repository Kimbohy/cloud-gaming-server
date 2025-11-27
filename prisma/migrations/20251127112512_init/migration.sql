-- CreateEnum
CREATE TYPE "ConsoleType" AS ENUM ('GBA');

-- CreateTable
CREATE TABLE "Roms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "console" "ConsoleType" NOT NULL DEFAULT 'GBA',
    "filePath" TEXT NOT NULL,
    "imagePath" TEXT,
    "description" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Roms_pkey" PRIMARY KEY ("id")
);
