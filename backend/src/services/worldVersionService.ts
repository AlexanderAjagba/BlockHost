import { randomUUID } from "node:crypto";
import { getR2Config } from "../config/r2";
import { prisma } from "../config/prisma";
import {
  createSignedDownloadUrl,
  createSignedUploadUrl,
  getObjectMetadata,
  R2ObjectNotFoundError,
  type R2ObjectMetadata,
  SIGNED_DOWNLOAD_EXPIRY_SECONDS,
  SIGNED_UPLOAD_EXPIRY_SECONDS,
} from "./r2Service";

export interface CreateWorldVersionUploadUrlInput {
  worldId: string;
  firebaseUid: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface CompleteWorldVersionInput {
  worldId: string;
  firebaseUid: string;
  uploadId: string;
}

export class WorldNotFoundError extends Error {
  constructor() {
    super("World not found.");
    this.name = "WorldNotFoundError";
  }
}

export class InvalidWorldVersionObjectKeyError extends Error {
  constructor() {
    super("objectKey does not belong to the authenticated user and world.");
    this.name = "InvalidWorldVersionObjectKeyError";
  }
}

export class PendingWorldUploadNotFoundError extends Error {
  constructor() {
    super("Pending upload not found.");
    this.name = "PendingWorldUploadNotFoundError";
  }
}

export class UploadedObjectNotFoundError extends Error {
  constructor() {
    super("Uploaded object was not found in R2.");
    this.name = "UploadedObjectNotFoundError";
  }
}

export class UploadedObjectMetadataMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadedObjectMetadataMismatchError";
  }
}

export class WorldVersionNotFoundError extends Error {
  constructor() {
    super("World version not found.");
    this.name = "WorldVersionNotFoundError";
  }
}

const sanitizeFileName = (fileName: string): string => {
  const baseName = fileName.replace(/\\/g, "/").split("/").pop() ?? "";
  const sanitized = baseName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 180);

  return sanitized || "world.zip";
};

const getObjectKeyPrefix = (firebaseUid: string, worldId: string): string => {
  return `users/${encodeURIComponent(firebaseUid)}/worlds/${encodeURIComponent(worldId)}/versions/`;
};

const findOwnedWorld = async (worldId: string, firebaseUid: string) => {
  const world = await prisma.world.findFirst({
    where: {
      id: worldId,
      owner: {
        firebaseUid,
      },
    },
    select: {
      id: true,
      ownerId: true,
    },
  });

  if (!world) {
    throw new WorldNotFoundError();
  }

  return world;
};

const serializeWorldVersion = (version: {
  id: string;
  versionNumber: number;
  fileName: string;
  contentType: string;
  sizeBytes: bigint;
  createdAt: Date;
}) => {
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    fileName: version.fileName,
    contentType: version.contentType,
    sizeBytes: Number(version.sizeBytes),
    createdAt: version.createdAt,
  };
};

export const createWorldVersionUploadUrl = async ({
  worldId,
  firebaseUid,
  fileName,
  contentType,
  sizeBytes,
}: CreateWorldVersionUploadUrlInput) => {
  const world = await findOwnedWorld(worldId, firebaseUid);

  const uploadId = randomUUID();
  const objectKey = `${getObjectKeyPrefix(firebaseUid, world.id)}${uploadId}/${sanitizeFileName(fileName)}`;
  const expiresAt = new Date(Date.now() + SIGNED_UPLOAD_EXPIRY_SECONDS * 1000);
  const uploadUrl = await createSignedUploadUrl({
    objectKey,
    contentType,
  });

  await prisma.pendingWorldUpload.create({
    data: {
      id: uploadId,
      userId: world.ownerId,
      worldId: world.id,
      objectKey,
      fileName,
      contentType,
      sizeBytes: BigInt(sizeBytes),
      expiresAt,
    },
  });

  return {
    uploadId,
    uploadUrl,
    expiresInSeconds: SIGNED_UPLOAD_EXPIRY_SECONDS,
    requiredHeaders: {
      "Content-Type": contentType,
    },
  };
};

export const completeWorldVersionUpload = async ({
  worldId,
  firebaseUid,
  uploadId,
}: CompleteWorldVersionInput) => {
  const world = await findOwnedWorld(worldId, firebaseUid);

  const pendingUpload = await prisma.pendingWorldUpload.findFirst({
    where: {
      id: uploadId,
      worldId: world.id,
      userId: world.ownerId,
      user: {
        firebaseUid,
      },
      world: {
        id: world.id,
        owner: {
          firebaseUid,
        },
      },
    },
    select: {
      id: true,
      objectKey: true,
      fileName: true,
      contentType: true,
      sizeBytes: true,
      expiresAt: true,
    },
  });

  if (!pendingUpload) {
    throw new PendingWorldUploadNotFoundError();
  }

  if (pendingUpload.expiresAt.getTime() <= Date.now()) {
    await prisma.pendingWorldUpload.delete({
      where: {
        id: pendingUpload.id,
      },
    });
    throw new PendingWorldUploadNotFoundError();
  }

  if (!pendingUpload.objectKey.startsWith(getObjectKeyPrefix(firebaseUid, world.id))) {
    throw new InvalidWorldVersionObjectKeyError();
  }

  let objectMetadata: R2ObjectMetadata;

  try {
    objectMetadata = await getObjectMetadata(pendingUpload.objectKey);
  } catch (error) {
    if (error instanceof R2ObjectNotFoundError) {
      throw new UploadedObjectNotFoundError();
    }

    throw error;
  }

  const sizeBytes = Number(pendingUpload.sizeBytes);

  if (objectMetadata.contentLength !== undefined && objectMetadata.contentLength !== sizeBytes) {
    throw new UploadedObjectMetadataMismatchError(
      "Uploaded object size does not match sizeBytes.",
    );
  }

  if (objectMetadata.contentType !== undefined && objectMetadata.contentType !== pendingUpload.contentType) {
    throw new UploadedObjectMetadataMismatchError(
      "Uploaded object content type does not match contentType.",
    );
  }

  const latestVersion = await prisma.worldVersion.findFirst({
    where: {
      worldId: world.id,
    },
    orderBy: {
      versionNumber: "desc",
    },
    select: {
      versionNumber: true,
    },
  });

  const version = await prisma.worldVersion.create({
    data: {
      worldId: world.id,
      versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
      status: "UPLOADED",
      r2Bucket: getR2Config().bucketName,
      r2ObjectKey: pendingUpload.objectKey,
      fileName: pendingUpload.fileName,
      contentType: pendingUpload.contentType,
      sizeBytes: pendingUpload.sizeBytes,
      uploadedAt: new Date(),
    },
    select: {
      id: true,
      versionNumber: true,
      fileName: true,
      contentType: true,
      sizeBytes: true,
      createdAt: true,
    },
  });

  await prisma.pendingWorldUpload.delete({
    where: {
      id: pendingUpload.id,
    },
  });

  return serializeWorldVersion(version);
};

export const listWorldVersions = async (worldId: string, firebaseUid: string) => {
  const world = await findOwnedWorld(worldId, firebaseUid);
  const versions = await prisma.worldVersion.findMany({
    where: {
      worldId: world.id,
    },
    orderBy: {
      versionNumber: "desc",
    },
    select: {
      id: true,
      versionNumber: true,
      fileName: true,
      contentType: true,
      sizeBytes: true,
      createdAt: true,
    },
  });

  return versions.map(serializeWorldVersion);
};

export const createWorldVersionDownloadUrl = async (
  worldId: string,
  versionId: string,
  firebaseUid: string,
) => {
  const version = await prisma.worldVersion.findFirst({
    where: {
      id: versionId,
      world: {
        id: worldId,
        owner: {
          firebaseUid,
        },
      },
    },
    select: {
      fileName: true,
      contentType: true,
      sizeBytes: true,
      r2ObjectKey: true,
    },
  });

  if (!version) {
    throw new WorldVersionNotFoundError();
  }

  const downloadUrl = await createSignedDownloadUrl(
    version.r2ObjectKey,
    version.fileName,
  );

  return {
    downloadUrl,
    expiresInSeconds: SIGNED_DOWNLOAD_EXPIRY_SECONDS,
    fileName: version.fileName,
    contentType: version.contentType,
    sizeBytes: Number(version.sizeBytes),
  };
};
