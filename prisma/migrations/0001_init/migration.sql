-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "coverUrl" TEXT,
    "filePath" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingProgress" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "cfi" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vocabulary" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "exampleSentence" TEXT NOT NULL,
    "contextSentence" TEXT NOT NULL,
    "sourceLanguage" TEXT NOT NULL,
    "targetLanguage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "bookId" TEXT,

    CONSTRAINT "Vocabulary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SRSData" (
    "id" TEXT NOT NULL,
    "vocabularyId" TEXT NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "nextReviewAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt" TIMESTAMP(3),

    CONSTRAINT "SRSData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Book_userId_createdAt_idx" ON "Book"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingProgress_bookId_key" ON "ReadingProgress"("bookId");

-- CreateIndex
CREATE INDEX "Vocabulary_userId_createdAt_idx" ON "Vocabulary"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Vocabulary_bookId_idx" ON "Vocabulary"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "SRSData_vocabularyId_key" ON "SRSData"("vocabularyId");

-- CreateIndex
CREATE INDEX "SRSData_nextReviewAt_idx" ON "SRSData"("nextReviewAt");

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingProgress" ADD CONSTRAINT "ReadingProgress_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vocabulary" ADD CONSTRAINT "Vocabulary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vocabulary" ADD CONSTRAINT "Vocabulary_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SRSData" ADD CONSTRAINT "SRSData_vocabularyId_fkey" FOREIGN KEY ("vocabularyId") REFERENCES "Vocabulary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

