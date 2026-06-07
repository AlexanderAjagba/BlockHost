-- CreateEnum
CREATE TYPE "WorldVersionStatus" AS ENUM ('PENDING', 'UPLOADED', 'FAILED', 'DELETED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "World" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "minecraftVersion" TEXT,
    "lastPlayedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "World_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorldVersion" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "WorldVersionStatus" NOT NULL DEFAULT 'PENDING',
    "r2Bucket" TEXT NOT NULL,
    "r2ObjectKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksumSha256" TEXT,
    "notes" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorldVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "World_ownerId_idx" ON "World"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "World_ownerId_name_key" ON "World"("ownerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "WorldVersion_r2ObjectKey_key" ON "WorldVersion"("r2ObjectKey");

-- CreateIndex
CREATE INDEX "WorldVersion_worldId_idx" ON "WorldVersion"("worldId");

-- CreateIndex
CREATE INDEX "WorldVersion_status_idx" ON "WorldVersion"("status");

-- CreateIndex
CREATE INDEX "WorldVersion_createdAt_idx" ON "WorldVersion"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorldVersion_worldId_versionNumber_key" ON "WorldVersion"("worldId", "versionNumber");

-- AddForeignKey
ALTER TABLE "World" ADD CONSTRAINT "World_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorldVersion" ADD CONSTRAINT "WorldVersion_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;
