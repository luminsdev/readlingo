import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type R2EnvName =
  | "R2_ACCOUNT_ID"
  | "R2_ACCESS_KEY_ID"
  | "R2_SECRET_ACCESS_KEY"
  | "R2_BUCKET_NAME"
  | "R2_ENDPOINT";

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint: string;
};

let r2Client: S3Client | null = null;
let r2Config: R2Config | null = null;

function getRequiredR2Env(name: R2EnvName) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required Cloudflare R2 environment variable: ${name}`,
    );
  }

  return value;
}

function getR2Config() {
  if (r2Config) {
    return r2Config;
  }

  r2Config = {
    accountId: getRequiredR2Env("R2_ACCOUNT_ID"),
    accessKeyId: getRequiredR2Env("R2_ACCESS_KEY_ID"),
    secretAccessKey: getRequiredR2Env("R2_SECRET_ACCESS_KEY"),
    bucketName: getRequiredR2Env("R2_BUCKET_NAME"),
    endpoint: getRequiredR2Env("R2_ENDPOINT"),
  };

  return r2Config;
}

function getR2Client() {
  if (r2Client) {
    return r2Client;
  }

  const config = getR2Config();

  r2Client = new S3Client({
    endpoint: config.endpoint,
    region: "auto",
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return r2Client;
}

function createMissingObjectError() {
  const error = new Error("Stored EPUB file not found.") as Error & {
    code: string;
  };

  error.code = "ENOENT";

  return error;
}

export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
) {
  const client = getR2Client();
  const { bucketName } = getR2Config();

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function downloadFromR2(key: string) {
  const client = getR2Client();
  const { bucketName } = getR2Config();

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
    );

    if (!response.Body) {
      throw createMissingObjectError();
    }

    return Buffer.from(await response.Body.transformToByteArray());
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "NoSuchKey" ||
        error.name === "NotFound" ||
        ("$metadata" in error &&
          typeof error.$metadata === "object" &&
          error.$metadata !== null &&
          "httpStatusCode" in error.$metadata &&
          error.$metadata.httpStatusCode === 404))
    ) {
      throw createMissingObjectError();
    }

    throw error;
  }
}

export async function deleteFromR2(key: string) {
  const client = getR2Client();
  const { bucketName } = getR2Config();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );
}

export async function getR2SignedUrl(key: string, expiresIn = 60 * 60) {
  const client = getR2Client();
  const { bucketName } = getR2Config();

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
    { expiresIn },
  );
}
