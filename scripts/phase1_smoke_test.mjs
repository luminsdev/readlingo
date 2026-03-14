import { randomUUID } from "node:crypto";

const baseUrl = process.env.READLINGO_BASE_URL ?? "http://localhost:3000";
const redirectStatuses = new Set([302, 303, 307, 308]);

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  apply(headers = {}) {
    const cookie = [...this.cookies.entries()]
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");

    return cookie ? { ...headers, cookie } : headers;
  }

  store(response) {
    const setCookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : response.headers.get("set-cookie")
          ? [response.headers.get("set-cookie")]
          : [];

    for (const entry of setCookies) {
      const [pair] = entry.split(";");
      const separatorIndex = pair.indexOf("=");

      if (separatorIndex > 0) {
        const key = pair.slice(0, separatorIndex);
        const value = pair.slice(separatorIndex + 1);
        this.cookies.set(key, value);
      }
    }
  }

  has(name) {
    return this.cookies.has(name);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createMinimalEpubBuffer() {
  return Buffer.from(
    "PK\x03\x04mimetypeapplication/epub+zipMETA-INF/container.xmlOPS/content.opf",
    "latin1",
  );
}

async function request(jar, path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: jar.apply(init.headers ?? {}),
    redirect: "manual",
  });

  jar.store(response);
  return response;
}

async function readJson(response) {
  return response.json().catch(() => null);
}

async function expectRedirect(response, target, context) {
  const location = response.headers.get("location") ?? "";

  assert(
    redirectStatuses.has(response.status),
    `${context}: expected redirect status, received ${response.status}`,
  );
  assert(
    location.includes(target),
    `${context}: expected redirect to include "${target}", received "${location}"`,
  );
}

async function registerUser(email, name = "Phase One") {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      name,
      password: "password123",
    }),
  });

  return {
    response,
    payload: await readJson(response),
  };
}

async function getCsrfToken(jar) {
  const response = await request(jar, "/api/auth/csrf");
  const payload = await readJson(response);

  assert(response.ok, `CSRF token request failed with ${response.status}`);
  assert(payload?.csrfToken, "CSRF token payload is missing csrfToken");

  return payload.csrfToken;
}

async function signIn(email, password = "password123") {
  const jar = new CookieJar();
  const csrfToken = await getCsrfToken(jar);
  const body = new URLSearchParams({
    callbackUrl: `${baseUrl}/library`,
    csrfToken,
    email,
    password,
  });

  const response = await request(jar, "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  return { jar, response };
}

async function uploadBook(jar, fileName, type = "application/epub+zip") {
  const form = new FormData();
  const fileContents =
    type === "application/epub+zip"
      ? createMinimalEpubBuffer()
      : Buffer.from("dummy-epub");

  form.set("file", new File([fileContents], fileName, { type }));

  const response = await request(jar, "/api/books", {
    method: "POST",
    body: form,
  });

  return {
    response,
    payload: await readJson(response),
  };
}

async function fetchBooks(jar) {
  const response = await request(jar, "/api/books");

  return {
    response,
    payload: await readJson(response),
  };
}

async function fetchPage(jar, path) {
  const response = await request(jar, path);

  return {
    response,
    html: await response.text(),
  };
}

async function deleteBook(jar, bookId) {
  const response = await request(jar, `/api/books/${bookId}`, {
    method: "DELETE",
  });

  return {
    response,
    payload: await readJson(response),
  };
}

function logPass(message) {
  console.log(`PASS ${message}`);
}

async function main() {
  const anonymousJar = new CookieJar();
  const anonymousLibrary = await request(anonymousJar, "/library");
  await expectRedirect(anonymousLibrary, "/login", "anonymous library access");
  logPass("unauthenticated users are redirected away from /library");

  const user1Email = `phase1-${randomUUID()}@example.com`;
  const user2Email = `phase1-${randomUUID()}@example.com`;

  const registration = await registerUser(user1Email);
  assert(
    registration.response.status === 201,
    `expected first registration to succeed, received ${registration.response.status}`,
  );
  logPass("a new user can register");

  const duplicateRegistration = await registerUser(user1Email);
  assert(
    duplicateRegistration.response.status === 409,
    `expected duplicate registration to fail with 409, received ${duplicateRegistration.response.status}`,
  );
  assert(
    duplicateRegistration.payload?.error ===
      "An account already exists for that email.",
    "duplicate registration did not return the expected error copy",
  );
  logPass("duplicate registration returns a clear auth error");

  const failedLogin = await signIn(user1Email, "wrongpass");
  await expectRedirect(
    failedLogin.response,
    "error=CredentialsSignin",
    "failed credentials login",
  );
  logPass("invalid credentials redirect with a clear auth error state");

  const auth1 = await signIn(user1Email);
  await expectRedirect(auth1.response, "/library", "successful user 1 login");
  assert(
    auth1.jar.has("authjs.session-token"),
    "successful login did not set an auth session token",
  );
  logPass("a registered user can sign in");

  const authenticatedLoginPage = await request(auth1.jar, "/login");
  await expectRedirect(
    authenticatedLoginPage,
    "/library",
    "authenticated login page access",
  );
  logPass("authenticated users are redirected away from auth pages");

  const validUpload = await uploadBook(auth1.jar, "phase1-smoke.epub");
  assert(
    validUpload.response.status === 201,
    `expected valid upload to succeed, received ${validUpload.response.status}`,
  );
  const uploadedBook = validUpload.payload?.book;
  assert(uploadedBook?.id, "valid upload did not return a persisted book");
  logPass("a signed-in user can upload a valid EPUB");

  const invalidUpload = await uploadBook(
    auth1.jar,
    "phase1-smoke.txt",
    "text/plain",
  );
  assert(
    invalidUpload.response.status === 400,
    `expected invalid upload to fail with 400, received ${invalidUpload.response.status}`,
  );
  assert(
    invalidUpload.payload?.error ===
      "Only EPUB files are supported for uploads.",
    "invalid upload did not return the expected validation error",
  );
  logPass("invalid uploads fail safely with a clear error");

  const user1Books = await fetchBooks(auth1.jar);
  assert(user1Books.response.ok, "user 1 book listing failed");
  assert(
    user1Books.payload?.books?.some((book) => book.id === uploadedBook.id),
    "uploaded book did not appear in the authenticated API listing",
  );
  logPass("uploaded books appear in the authenticated library API");

  const libraryPage = await fetchPage(auth1.jar, "/library");
  assert(libraryPage.response.ok, "library page did not render for user 1");
  assert(
    libraryPage.html.includes(uploadedBook.title),
    "library page did not render the uploaded book title",
  );
  for (const marker of [
    "xl:grid-cols-[360px_minmax(0,1fr)]",
    "md:grid-cols-2",
    "xl:grid-cols-3",
  ]) {
    assert(
      libraryPage.html.includes(marker),
      `library page is missing responsive layout marker ${marker}`,
    );
  }
  logPass(
    "library page renders the uploaded book with responsive layout markers",
  );

  const registration2 = await registerUser(user2Email, "Phase Two");
  assert(
    registration2.response.status === 201,
    `expected second user registration to succeed, received ${registration2.response.status}`,
  );

  const auth2 = await signIn(user2Email);
  await expectRedirect(auth2.response, "/library", "successful user 2 login");

  const user2Books = await fetchBooks(auth2.jar);
  assert(user2Books.response.ok, "user 2 book listing failed");
  assert(
    Array.isArray(user2Books.payload?.books) &&
      user2Books.payload.books.length === 0,
    "user 2 should not see user 1 books",
  );
  logPass("users only see their own books");

  const forbiddenDelete = await deleteBook(auth2.jar, uploadedBook.id);
  assert(
    forbiddenDelete.response.status === 404,
    `expected cross-user delete to fail with 404, received ${forbiddenDelete.response.status}`,
  );
  logPass("users cannot delete another user's book");

  const deleteResult = await deleteBook(auth1.jar, uploadedBook.id);
  assert(
    deleteResult.response.status === 204,
    `expected owner delete to succeed with 204, received ${deleteResult.response.status}`,
  );

  const postDeleteBooks = await fetchBooks(auth1.jar);
  assert(postDeleteBooks.response.ok, "post-delete listing failed");
  assert(
    Array.isArray(postDeleteBooks.payload?.books) &&
      !postDeleteBooks.payload.books.some(
        (book) => book.id === uploadedBook.id,
      ),
    "deleted book still appears in the library listing",
  );
  logPass("owners can delete their uploaded books");

  console.log("\nPhase 1 smoke test passed.");
}

main().catch((error) => {
  console.error(`\nPhase 1 smoke test failed: ${error.message}`);
  process.exitCode = 1;
});
