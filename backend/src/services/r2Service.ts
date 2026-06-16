import { GetObjectCommand, HeadObjectCommand, NotFound, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Config } from "../config/r2";

export const SIGNED_UPLOAD_EXPIRY_SECONDS = 15 * 60;
export const SIGNED_DOWNLOAD_EXPIRY_SECONDS = 15 * 60;

interface CreateSignedUploadUrlInput {
  objectKey: string;
  contentType: string;
}

export interface R2ObjectMetadata {
  contentLength?: number;
  contentType?: string;
}

export class R2ObjectNotFoundError extends Error {
  constructor() {
    super("R2 object not found.");
    this.name = "R2ObjectNotFoundError";
  }
}

export const createSignedUploadUrl = async ({
  objectKey,
  contentType,
}: CreateSignedUploadUrlInput): Promise<string> => {
  const { bucketName, client } = getR2Config();
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, {
    expiresIn: SIGNED_UPLOAD_EXPIRY_SECONDS,
  });
};

export const getObjectMetadata = async (objectKey: string): Promise<R2ObjectMetadata> => {
  const { bucketName, client } = getR2Config();

  try {
    const result = await client.send(
      new HeadObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
      }),
    );

    return {
      contentLength: result.ContentLength,
      contentType: result.ContentType,
    };
  } catch (error) {
    if (
      error instanceof NotFound ||
      (typeof error === "object" &&
        error !== null &&
        "$metadata" in error &&
        typeof error.$metadata === "object" &&
        error.$metadata !== null &&
        "httpStatusCode" in error.$metadata &&
        error.$metadata.httpStatusCode === 404)
    ) {
      throw new R2ObjectNotFoundError();
    }

    throw error;
  }
};

export const createSignedDownloadUrl = async (
  objectKey: string,
  fileName: string,
): Promise<string> => {
  const { bucketName, client } = getR2Config();
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    ResponseContentDisposition: `attachment; filename="${fileName.replace(/["\\]/g, "_")}"`,
  });

  return getSignedUrl(client, command, {
    expiresIn: SIGNED_DOWNLOAD_EXPIRY_SECONDS,
  });
};
