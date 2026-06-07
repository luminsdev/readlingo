-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookCollection" (
    "bookId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BookCollection_pkey" PRIMARY KEY ("bookId","collectionId")
);

-- CreateIndex
CREATE INDEX "Collection_userId_order_idx" ON "Collection"("userId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_userId_normalizedName_key" ON "Collection"("userId", "normalizedName");

-- CreateIndex
CREATE INDEX "BookCollection_collectionId_order_idx" ON "BookCollection"("collectionId", "order");

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCollection" ADD CONSTRAINT "BookCollection_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCollection" ADD CONSTRAINT "BookCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
