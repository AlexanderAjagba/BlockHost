-- CreateTable
CREATE TABLE "PendingWorldUpload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingWorldUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingWorldUpload_objectKey_key" ON "PendingWorldUpload"("objectKey");

-- CreateIndex
CREATE INDEX "PendingWorldUpload_userId_idx" ON "PendingWorldUpload"("userId");

-- CreateIndex
CREATE INDEX "PendingWorldUpload_worldId_idx" ON "PendingWorldUpload"("worldId");

-- CreateIndex
CREATE INDEX "PendingWorldUpload_expiresAt_idx" ON "PendingWorldUpload"("expiresAt");

-- AddForeignKey
ALTER TABLE "PendingWorldUpload" ADD CONSTRAINT "PendingWorldUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingWorldUpload" ADD CONSTRAINT "PendingWorldUpload_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;
