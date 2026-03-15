-- CreateIndex
CREATE UNIQUE INDEX "Vocabulary_userId_bookId_word_key" ON "Vocabulary"("userId", "bookId", "word");
