type ReaderBookLoadSnapshot = {
  author: string | null;
  id: string;
  language: string | null;
  progressCfi: string | null;
  title: string;
};

export function getReaderBookLoadKey(book: ReaderBookLoadSnapshot) {
  return JSON.stringify([
    book.id,
    book.title,
    book.author,
    book.language,
    book.progressCfi,
  ]);
}
