import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface TestDecodedToken {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
}

interface TestUser {
  id: string;
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TestWorld {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  minecraftVersion: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TestWorldVersion {
  id: string;
  worldId: string;
  versionNumber: number;
  status: "UPLOADED";
  r2Bucket: string;
  r2ObjectKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: bigint;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface TestPendingWorldUpload {
  id: string;
  userId: string;
  worldId: string;
  objectKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: bigint;
  createdAt: Date;
  expiresAt: Date;
}

interface TestState {
  users: TestUser[];
  worlds: TestWorld[];
  versions: TestWorldVersion[];
  pendingUploads: TestPendingWorldUpload[];
  nextWorldId: number;
  nextVersionId: number;
}

const authMock = vi.hoisted(() => ({
  verifyIdToken: vi.fn<(token: string) => Promise<TestDecodedToken>>(),
}));

const r2Mock = vi.hoisted(() => {
  class MockR2ObjectNotFoundError extends Error {
    constructor() {
      super("R2 object not found.");
      this.name = "R2ObjectNotFoundError";
    }
  }

  return {
    R2ObjectNotFoundError: MockR2ObjectNotFoundError,
    createSignedUploadUrl: vi.fn<(input: { objectKey: string; contentType: string }) => Promise<string>>(),
    createSignedDownloadUrl: vi.fn<(objectKey: string, fileName: string) => Promise<string>>(),
    getObjectMetadata: vi.fn<(objectKey: string) => Promise<{ contentLength?: number; contentType?: string }>>(),
  };
});

const state = vi.hoisted<TestState>(() => ({
  users: [],
  worlds: [],
  versions: [],
  pendingUploads: [],
  nextWorldId: 1,
  nextVersionId: 1,
}));

vi.mock("firebase-admin/app", () => ({
  cert: vi.fn((credential: unknown) => credential),
  getApps: vi.fn(() => []),
  initializeApp: vi.fn((appConfig?: unknown) => appConfig ?? {}),
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: authMock.verifyIdToken,
  })),
}));

vi.mock("../src/config/r2", () => ({
  getR2Config: vi.fn(() => ({
    bucketName: "test-bucket",
    client: {},
  })),
}));

vi.mock("../src/services/r2Service", () => ({
  SIGNED_UPLOAD_EXPIRY_SECONDS: 15 * 60,
  SIGNED_DOWNLOAD_EXPIRY_SECONDS: 15 * 60,
  R2ObjectNotFoundError: r2Mock.R2ObjectNotFoundError,
  createSignedUploadUrl: r2Mock.createSignedUploadUrl,
  createSignedDownloadUrl: r2Mock.createSignedDownloadUrl,
  getObjectMetadata: r2Mock.getObjectMetadata,
}));

vi.mock("../src/config/prisma", () => {
  const selectRecord = <T extends object>(
    record: T,
    select?: Record<string, boolean>,
  ): Record<string, unknown> => {
    if (!select) {
      return { ...record };
    }

    const output: Record<string, unknown> = {};
    for (const [key, enabled] of Object.entries(select)) {
      if (enabled) {
        output[key] = record[key as keyof T];
      }
    }
    return output;
  };

  const findUserByFirebaseUid = (firebaseUid: string): TestUser | undefined => {
    return state.users.find((user) => user.firebaseUid === firebaseUid);
  };

  const findWorldOwner = (world: TestWorld): TestUser | undefined => {
    return state.users.find((user) => user.id === world.ownerId);
  };

  return {
    prisma: {
      user: {
        upsert: async (args: {
          where: { firebaseUid: string };
          create: {
            firebaseUid: string;
            email: string | null;
            displayName: string | null;
            photoUrl: string | null;
          };
          update: {
            email: string | null;
            displayName: string | null;
            photoUrl: string | null;
          };
        }) => {
          const existingUser = findUserByFirebaseUid(args.where.firebaseUid);
          if (existingUser) {
            existingUser.email = args.update.email;
            existingUser.displayName = args.update.displayName;
            existingUser.photoUrl = args.update.photoUrl;
            existingUser.updatedAt = new Date();
            return { ...existingUser };
          }

          const user: TestUser = {
            id: `user-db-${args.create.firebaseUid}`,
            firebaseUid: args.create.firebaseUid,
            email: args.create.email,
            displayName: args.create.displayName,
            photoUrl: args.create.photoUrl,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          state.users.push(user);
          return { ...user };
        },
        findUnique: async (args: {
          where: { firebaseUid: string };
          select?: Record<string, boolean>;
        }) => {
          const user = findUserByFirebaseUid(args.where.firebaseUid);
          return user ? selectRecord(user, args.select) : null;
        },
      },
      world: {
        findMany: async (args: {
          where: { ownerId: string };
          select?: Record<string, boolean>;
        }) => {
          return state.worlds
            .filter((world) => world.ownerId === args.where.ownerId)
            .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
            .map((world) => selectRecord(world, args.select));
        },
        findFirst: async (args: {
          where: {
            id: string;
            owner?: {
              firebaseUid: string;
            };
          };
          select?: Record<string, boolean>;
        }) => {
          const world = state.worlds.find((candidate) => {
            if (candidate.id !== args.where.id) {
              return false;
            }

            if (!args.where.owner) {
              return true;
            }

            return findWorldOwner(candidate)?.firebaseUid === args.where.owner.firebaseUid;
          });

          return world ? selectRecord(world, args.select) : null;
        },
        create: async (args: {
          data: {
            ownerId: string;
            name: string;
            description: string | null;
            minecraftVersion: string | null;
          };
          select?: Record<string, boolean>;
        }) => {
          const duplicate = state.worlds.some((world) => {
            return world.ownerId === args.data.ownerId && world.name === args.data.name;
          });

          if (duplicate) {
            throw { code: "P2002" };
          }

          const now = new Date();
          const world: TestWorld = {
            id: `world-${state.nextWorldId}`,
            ownerId: args.data.ownerId,
            name: args.data.name,
            description: args.data.description,
            minecraftVersion: args.data.minecraftVersion,
            createdAt: now,
            updatedAt: now,
          };
          state.nextWorldId += 1;
          state.worlds.push(world);
          return selectRecord(world, args.select);
        },
      },
      worldVersion: {
        findFirst: async (args: {
          where:
            | { worldId: string }
            | {
                id: string;
                world: {
                  id: string;
                  owner: {
                    firebaseUid: string;
                  };
                };
              };
          orderBy?: { versionNumber: "desc" };
          select?: Record<string, boolean>;
        }) => {
          if ("worldId" in args.where) {
            const versions = state.versions
              .filter((version) => version.worldId === args.where.worldId)
              .sort((left, right) => right.versionNumber - left.versionNumber);
            const version = versions[0];
            return version ? selectRecord(version, args.select) : null;
          }

          const version = state.versions.find((candidate) => {
            if (candidate.id !== args.where.id || candidate.worldId !== args.where.world.id) {
              return false;
            }

            const world = state.worlds.find((candidateWorld) => {
              return candidateWorld.id === candidate.worldId;
            });

            return world ? findWorldOwner(world)?.firebaseUid === args.where.world.owner.firebaseUid : false;
          });

          return version ? selectRecord(version, args.select) : null;
        },
        create: async (args: {
          data: {
            worldId: string;
            versionNumber: number;
            status: "UPLOADED";
            r2Bucket: string;
            r2ObjectKey: string;
            fileName: string;
            contentType: string;
            sizeBytes: bigint;
            uploadedAt: Date;
          };
          select?: Record<string, boolean>;
        }) => {
          const now = new Date();
          const version: TestWorldVersion = {
            id: `version-${state.nextVersionId}`,
            worldId: args.data.worldId,
            versionNumber: args.data.versionNumber,
            status: args.data.status,
            r2Bucket: args.data.r2Bucket,
            r2ObjectKey: args.data.r2ObjectKey,
            fileName: args.data.fileName,
            contentType: args.data.contentType,
            sizeBytes: args.data.sizeBytes,
            uploadedAt: args.data.uploadedAt,
            createdAt: now,
            updatedAt: now,
          };
          state.nextVersionId += 1;
          state.versions.push(version);
          return selectRecord(version, args.select);
        },
        findMany: async (args: {
          where: { worldId: string };
          orderBy: { versionNumber: "desc" };
          select?: Record<string, boolean>;
        }) => {
          return state.versions
            .filter((version) => version.worldId === args.where.worldId)
            .sort((left, right) => right.versionNumber - left.versionNumber)
            .map((version) => selectRecord(version, args.select));
        },
      },
      pendingWorldUpload: {
        create: async (args: {
          data: {
            id: string;
            userId: string;
            worldId: string;
            objectKey: string;
            fileName: string;
            contentType: string;
            sizeBytes: bigint;
            expiresAt: Date;
          };
        }) => {
          const now = new Date();
          const pendingUpload: TestPendingWorldUpload = {
            id: args.data.id,
            userId: args.data.userId,
            worldId: args.data.worldId,
            objectKey: args.data.objectKey,
            fileName: args.data.fileName,
            contentType: args.data.contentType,
            sizeBytes: args.data.sizeBytes,
            createdAt: now,
            expiresAt: args.data.expiresAt,
          };
          state.pendingUploads.push(pendingUpload);
          return { ...pendingUpload };
        },
        findFirst: async (args: {
          where: {
            id: string;
            worldId: string;
            userId: string;
            user: {
              firebaseUid: string;
            };
            world: {
              id: string;
              owner: {
                firebaseUid: string;
              };
            };
          };
          select?: Record<string, boolean>;
        }) => {
          const pendingUpload = state.pendingUploads.find((candidate) => {
            if (
              candidate.id !== args.where.id ||
              candidate.worldId !== args.where.worldId ||
              candidate.userId !== args.where.userId
            ) {
              return false;
            }

            const user = state.users.find((candidateUser) => candidateUser.id === candidate.userId);
            const world = state.worlds.find((candidateWorld) => candidateWorld.id === candidate.worldId);

            return (
              user?.firebaseUid === args.where.user.firebaseUid &&
              world?.id === args.where.world.id &&
              findWorldOwner(world)?.firebaseUid === args.where.world.owner.firebaseUid
            );
          });

          return pendingUpload ? selectRecord(pendingUpload, args.select) : null;
        },
        delete: async (args: { where: { id: string } }) => {
          const index = state.pendingUploads.findIndex((pendingUpload) => {
            return pendingUpload.id === args.where.id;
          });

          if (index === -1) {
            throw new Error("Pending upload not found.");
          }

          const [deleted] = state.pendingUploads.splice(index, 1);
          return deleted ? { ...deleted } : null;
        },
      },
    },
  };
});

const { app } = await import("../src/app");

const tokenForUserOne = "valid-user-one";
const tokenForUserTwo = "valid-user-two";

const decodedUserOne: TestDecodedToken = {
  uid: "firebase-user-1",
  email: "one@example.com",
  name: "User One",
  picture: "https://example.com/one.png",
};

const decodedUserTwo: TestDecodedToken = {
  uid: "firebase-user-2",
  email: "two@example.com",
  name: "User Two",
  picture: "https://example.com/two.png",
};

const authHeader = (token: string): string => {
  return `Bearer ${token}`;
};

const seedUser = (token: TestDecodedToken): TestUser => {
  const user: TestUser = {
    id: `user-db-${token.uid}`,
    firebaseUid: token.uid,
    email: token.email ?? null,
    displayName: token.name ?? null,
    photoUrl: token.picture ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  state.users.push(user);
  return user;
};

const seedWorld = (
  ownerId: string,
  overrides: Partial<Omit<TestWorld, "ownerId">> = {},
): TestWorld => {
  const now = new Date();
  const world: TestWorld = {
    id: overrides.id ?? `world-${state.nextWorldId}`,
    ownerId,
    name: overrides.name ?? `World ${state.nextWorldId}`,
    description: overrides.description ?? null,
    minecraftVersion: overrides.minecraftVersion ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
  state.nextWorldId += 1;
  state.worlds.push(world);
  return world;
};

const seedVersion = (
  worldId: string,
  overrides: Partial<Omit<TestWorldVersion, "worldId">> = {},
): TestWorldVersion => {
  const now = new Date();
  const version: TestWorldVersion = {
    id: overrides.id ?? `version-${state.nextVersionId}`,
    worldId,
    versionNumber: overrides.versionNumber ?? state.nextVersionId,
    status: "UPLOADED",
    r2Bucket: overrides.r2Bucket ?? "test-bucket",
    r2ObjectKey: overrides.r2ObjectKey ?? `users/firebase-user-1/worlds/${worldId}/versions/key/world.zip`,
    fileName: overrides.fileName ?? "world.zip",
    contentType: overrides.contentType ?? "application/zip",
    sizeBytes: overrides.sizeBytes ?? BigInt(123),
    uploadedAt: overrides.uploadedAt ?? now,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
  state.nextVersionId += 1;
  state.versions.push(version);
  return version;
};

const seedPendingUpload = (
  userId: string,
  worldId: string,
  overrides: Partial<Omit<TestPendingWorldUpload, "userId" | "worldId">> = {},
): TestPendingWorldUpload => {
  const now = new Date();
  const pendingUpload: TestPendingWorldUpload = {
    id: overrides.id ?? "pending-upload-1",
    userId,
    worldId,
    objectKey: overrides.objectKey ?? `users/firebase-user-1/worlds/${worldId}/versions/pending-upload-1/world.zip`,
    fileName: overrides.fileName ?? "world.zip",
    contentType: overrides.contentType ?? "application/zip",
    sizeBytes: overrides.sizeBytes ?? BigInt(123),
    createdAt: overrides.createdAt ?? now,
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 15 * 60 * 1000),
  };
  state.pendingUploads.push(pendingUpload);
  return pendingUpload;
};

beforeEach(() => {
  vi.clearAllMocks();

  state.users = [];
  state.worlds = [];
  state.versions = [];
  state.pendingUploads = [];
  state.nextWorldId = 1;
  state.nextVersionId = 1;

  authMock.verifyIdToken.mockImplementation(async (token) => {
    if (token === tokenForUserOne) {
      return decodedUserOne;
    }
    if (token === tokenForUserTwo) {
      return decodedUserTwo;
    }
    throw new Error("Invalid token.");
  });

  r2Mock.createSignedUploadUrl.mockResolvedValue("https://signed-upload.example.com/world.zip");
  r2Mock.createSignedDownloadUrl.mockResolvedValue("https://signed-download.example.com/world.zip");
  r2Mock.getObjectMetadata.mockResolvedValue({
    contentLength: 123,
    contentType: "application/zip",
  });
});

describe("auth middleware", () => {
  it("rejects missing Authorization headers on protected routes", async () => {
    const response = await request(app).get("/api/worlds");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Missing or invalid Authorization header." });
  });

  it("rejects malformed Bearer tokens on protected routes", async () => {
    const response = await request(app)
      .get("/api/worlds")
      .set("Authorization", authHeader("not-valid"));

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Invalid Firebase ID token." });
  });

  it("ignores request-body identity fields when creating worlds", async () => {
    const userOne = seedUser(decodedUserOne);
    seedUser(decodedUserTwo);

    const response = await request(app)
      .post("/api/worlds")
      .set("Authorization", authHeader(tokenForUserOne))
      .send({
        name: "Body Identity Test",
        ownerId: "user-db-firebase-user-2",
        userId: "user-db-firebase-user-2",
        firebaseUid: "firebase-user-2",
      });

    expect(response.status).toBe(201);
    expect(state.worlds[0]?.ownerId).toBe(userOne.id);
  });
});

describe("world routes", () => {
  it("returns only worlds owned by the verified Firebase user", async () => {
    const userOne = seedUser(decodedUserOne);
    const userTwo = seedUser(decodedUserTwo);
    const worldOne = seedWorld(userOne.id, { id: "world-owned", name: "Owned" });
    seedWorld(userTwo.id, { id: "world-other", name: "Other" });

    const response = await request(app)
      .get("/api/worlds")
      .set("Authorization", authHeader(tokenForUserOne));

    expect(response.status).toBe(200);
    expect(response.body.worlds).toHaveLength(1);
    expect(response.body.worlds[0]).toMatchObject({
      id: worldOne.id,
      name: worldOne.name,
    });
  });

  it("creates worlds for the verified Firebase UID", async () => {
    const userOne = seedUser(decodedUserOne);

    const response = await request(app)
      .post("/api/worlds")
      .set("Authorization", authHeader(tokenForUserOne))
      .send({
        name: "Fresh World",
        description: "A test world",
        minecraftVersion: "1.21.5",
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: "Fresh World",
      description: "A test world",
      minecraftVersion: "1.21.5",
    });
    expect(state.worlds[0]?.ownerId).toBe(userOne.id);
  });

  it("returns 409 for duplicate world names for the same user", async () => {
    const userOne = seedUser(decodedUserOne);
    seedWorld(userOne.id, { name: "Duplicate World" });

    const response = await request(app)
      .post("/api/worlds")
      .set("Authorization", authHeader(tokenForUserOne))
      .send({ name: "Duplicate World" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "A world with this name already exists." });
  });

  it.each([
    [{ name: "" }, "name is required and must be a non-empty string."],
    [{ name: "World", description: 123 }, "description must be a string when provided."],
    [{ name: "World", minecraftVersion: 123 }, "minecraftVersion must be a string when provided."],
  ])("returns clean 400 JSON for invalid world payloads", async (body, message) => {
    seedUser(decodedUserOne);

    const response = await request(app)
      .post("/api/worlds")
      .set("Authorization", authHeader(tokenForUserOne))
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: message });
  });
});

describe("upload URL route", () => {
  it("requires auth middleware", async () => {
    const response = await request(app)
      .post("/api/worlds/world-1/versions/upload-url")
      .send({
        fileName: "world.zip",
        contentType: "application/zip",
        sizeBytes: 123,
      });

    expect(response.status).toBe(401);
  });

  it.each([
    [{ fileName: "", contentType: "application/zip", sizeBytes: 123 }, "fileName is required and must be a non-empty string."],
    [{ fileName: "world.zip", contentType: "text/plain", sizeBytes: 123 }, "contentType must be application/zip or application/x-zip-compressed."],
    [{ fileName: "world.zip", contentType: "application/zip", sizeBytes: 0 }, "sizeBytes must be a positive integer no larger than 2147483648."],
    [{ fileName: "world.zip", contentType: "application/zip", sizeBytes: 2.5 }, "sizeBytes must be a positive integer no larger than 2147483648."],
  ])("returns clean 400 JSON for invalid upload payloads", async (body, message) => {
    const userOne = seedUser(decodedUserOne);
    const world = seedWorld(userOne.id);

    const response = await request(app)
      .post(`/api/worlds/${world.id}/versions/upload-url`)
      .set("Authorization", authHeader(tokenForUserOne))
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: message });
  });

  it.each(["application/zip", "application/x-zip-compressed"])(
    "keeps the allowed ZIP content type %s",
    async (contentType) => {
      const userOne = seedUser(decodedUserOne);
      const world = seedWorld(userOne.id);

      const response = await request(app)
        .post(`/api/worlds/${world.id}/versions/upload-url`)
        .set("Authorization", authHeader(tokenForUserOne))
        .send({
          fileName: "world.zip",
          contentType,
          sizeBytes: 123,
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        uploadId: expect.any(String),
        uploadUrl: "https://signed-upload.example.com/world.zip",
        expiresInSeconds: 900,
        requiredHeaders: {
          "Content-Type": contentType,
        },
      });
      expect(response.body).not.toHaveProperty("objectKey");
      expect(response.body).not.toHaveProperty("r2Bucket");
      expect(JSON.stringify(response.body)).not.toContain("test-bucket");
      expect(JSON.stringify(response.body)).not.toContain("users/");
      expect(JSON.stringify(response.body)).not.toContain("secret");
      expect(state.pendingUploads).toHaveLength(1);
    },
  );
});

describe("complete upload route", () => {
  it("returns 404 for cross-user world access", async () => {
    const userOne = seedUser(decodedUserOne);
    seedUser(decodedUserTwo);
    const world = seedWorld(userOne.id);

    const response = await request(app)
      .post(`/api/worlds/${world.id}/versions/complete`)
      .set("Authorization", authHeader(tokenForUserTwo))
      .send({
        uploadId: "pending-upload-1",
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "World not found." });
  });

  it("handles failed R2 HeadObject verification with clean JSON", async () => {
    const userOne = seedUser(decodedUserOne);
    const world = seedWorld(userOne.id);
    const pendingUpload = seedPendingUpload(userOne.id, world.id);
    r2Mock.getObjectMetadata.mockRejectedValueOnce(new r2Mock.R2ObjectNotFoundError());

    const response = await request(app)
      .post(`/api/worlds/${world.id}/versions/complete`)
      .set("Authorization", authHeader(tokenForUserOne))
      .send({
        uploadId: pendingUpload.id,
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Uploaded object was not found in R2." });
    expect(JSON.stringify(response.body)).not.toContain("users/firebase-user-1");
    expect(state.versions).toHaveLength(0);
    expect(state.pendingUploads).toHaveLength(1);
  });

  it("creates version metadata only after ownership and R2 metadata checks pass", async () => {
    const userOne = seedUser(decodedUserOne);
    const world = seedWorld(userOne.id);
    const pendingUpload = seedPendingUpload(userOne.id, world.id);

    const response = await request(app)
      .post(`/api/worlds/${world.id}/versions/complete`)
      .set("Authorization", authHeader(tokenForUserOne))
      .send({
        uploadId: pendingUpload.id,
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      versionNumber: 1,
      fileName: "world.zip",
      contentType: "application/zip",
      sizeBytes: 123,
    });
    expect(response.body).not.toHaveProperty("objectKey");
    expect(r2Mock.getObjectMetadata).toHaveBeenCalledOnce();
    expect(state.versions).toHaveLength(1);
    expect(state.pendingUploads).toHaveLength(0);
  });

  it("returns 404 for invalid upload IDs", async () => {
    const userOne = seedUser(decodedUserOne);
    const world = seedWorld(userOne.id);

    const response = await request(app)
      .post(`/api/worlds/${world.id}/versions/complete`)
      .set("Authorization", authHeader(tokenForUserOne))
      .send({
        uploadId: "not-real",
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Pending upload not found." });
    expect(r2Mock.getObjectMetadata).not.toHaveBeenCalled();
  });

  it("returns 404 for cross-user upload IDs", async () => {
    const userOne = seedUser(decodedUserOne);
    const userTwo = seedUser(decodedUserTwo);
    const worldOne = seedWorld(userOne.id);
    const worldTwo = seedWorld(userTwo.id);
    const pendingUpload = seedPendingUpload(userOne.id, worldOne.id);

    const response = await request(app)
      .post(`/api/worlds/${worldTwo.id}/versions/complete`)
      .set("Authorization", authHeader(tokenForUserTwo))
      .send({
        uploadId: pendingUpload.id,
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Pending upload not found." });
    expect(r2Mock.getObjectMetadata).not.toHaveBeenCalled();
  });

  it("does not allow completed uploads to be reused", async () => {
    const userOne = seedUser(decodedUserOne);
    const world = seedWorld(userOne.id);
    const pendingUpload = seedPendingUpload(userOne.id, world.id);

    const firstResponse = await request(app)
      .post(`/api/worlds/${world.id}/versions/complete`)
      .set("Authorization", authHeader(tokenForUserOne))
      .send({
        uploadId: pendingUpload.id,
      });
    const secondResponse = await request(app)
      .post(`/api/worlds/${world.id}/versions/complete`)
      .set("Authorization", authHeader(tokenForUserOne))
      .send({
        uploadId: pendingUpload.id,
      });

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(404);
    expect(secondResponse.body).toEqual({ error: "Pending upload not found." });
    expect(state.versions).toHaveLength(1);
  });

  it("returns a clean 404 for expired pending uploads", async () => {
    const userOne = seedUser(decodedUserOne);
    const world = seedWorld(userOne.id);
    const pendingUpload = seedPendingUpload(userOne.id, world.id, {
      expiresAt: new Date(Date.now() - 1000),
    });

    const response = await request(app)
      .post(`/api/worlds/${world.id}/versions/complete`)
      .set("Authorization", authHeader(tokenForUserOne))
      .send({
        uploadId: pendingUpload.id,
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Pending upload not found." });
    expect(r2Mock.getObjectMetadata).not.toHaveBeenCalled();
    expect(state.pendingUploads).toHaveLength(0);
  });
});

describe("version listing and download", () => {
  it("lists versions only for worlds owned by the verified user", async () => {
    const userOne = seedUser(decodedUserOne);
    const userTwo = seedUser(decodedUserTwo);
    const ownedWorld = seedWorld(userOne.id, { id: "owned-world" });
    const otherWorld = seedWorld(userTwo.id, { id: "other-world" });
    seedVersion(ownedWorld.id, { id: "owned-version", versionNumber: 2 });
    seedVersion(otherWorld.id, { id: "other-version", versionNumber: 1 });

    const response = await request(app)
      .get(`/api/worlds/${ownedWorld.id}/versions`)
      .set("Authorization", authHeader(tokenForUserOne));

    expect(response.status).toBe(200);
    expect(response.body.versions).toHaveLength(1);
    expect(response.body.versions[0]).toMatchObject({
      id: "owned-version",
      versionNumber: 2,
    });
    expect(response.body.versions[0]).not.toHaveProperty("objectKey");
  });

  it("returns 404 for cross-user version listing", async () => {
    const userOne = seedUser(decodedUserOne);
    seedUser(decodedUserTwo);
    const world = seedWorld(userOne.id);

    const response = await request(app)
      .get(`/api/worlds/${world.id}/versions`)
      .set("Authorization", authHeader(tokenForUserTwo));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "World not found." });
  });

  it("returns 404 for cross-user download URL access", async () => {
    const userOne = seedUser(decodedUserOne);
    seedUser(decodedUserTwo);
    const world = seedWorld(userOne.id);
    const version = seedVersion(world.id, { id: "version-owned" });

    const response = await request(app)
      .post(`/api/worlds/${world.id}/versions/${version.id}/download-url`)
      .set("Authorization", authHeader(tokenForUserTwo));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "World version not found." });
  });

  it("returns short-lived signed download URLs without internal object keys", async () => {
    const userOne = seedUser(decodedUserOne);
    const world = seedWorld(userOne.id);
    const version = seedVersion(world.id, {
      id: "version-download",
      fileName: "download.zip",
      contentType: "application/zip",
      sizeBytes: BigInt(456),
      r2ObjectKey: `users/firebase-user-1/worlds/${world.id}/versions/key/download.zip`,
    });

    const response = await request(app)
      .post(`/api/worlds/${world.id}/versions/${version.id}/download-url`)
      .set("Authorization", authHeader(tokenForUserOne));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      downloadUrl: "https://signed-download.example.com/world.zip",
      expiresInSeconds: 900,
      fileName: "download.zip",
      contentType: "application/zip",
      sizeBytes: 456,
    });
    expect(response.body).not.toHaveProperty("objectKey");
    expect(response.body.expiresInSeconds).toBeLessThanOrEqual(15 * 60);
  });
});
