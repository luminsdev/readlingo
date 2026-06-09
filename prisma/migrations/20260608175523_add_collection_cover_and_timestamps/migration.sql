-- AlterTable
ALTER TABLE "BookCollection" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "coverBookId" TEXT;

-- CreateIndex
CREATE INDEX "BookCollection_collectionId_createdAt_idx" ON "BookCollection"("collectionId", "createdAt");

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_coverBookId_fkey" FOREIGN KEY ("coverBookId") REFERENCES "Book"("id") ON DELETE SET NULL ON UPDATE CASCADE;
