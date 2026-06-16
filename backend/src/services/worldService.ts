import type { DecodedIdToken } from "firebase-admin/auth";
import { prisma } from "../config/prisma";
import { upsertUserFromFirebaseToken } from "./userService";

export interface CreateWorldInput {
  name: string;
  description?: string | null;
  minecraftVersion?: string | null;
}

export class WorldNameConflictError extends Error {
  constructor() {
    super("A world with this name already exists.");
    this.name = "WorldNameConflictError";
  }
}

const isPrismaUniqueConstraintError = (error: unknown): boolean => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
};

const worldSelect = {
  id: true,
  name: true,
  description: true,
  minecraftVersion: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const listWorldsForFirebaseUser = async (firebaseUid: string) => {
  const user = await prisma.user.findUnique({
    where: {
      firebaseUid,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    return [];
  }

  return prisma.world.findMany({
    where: {
      ownerId: user.id,
    },
    select: worldSelect,
    orderBy: {
      updatedAt: "desc",
    },
  });
};

export const createWorldForFirebaseUser = async (decodedToken: DecodedIdToken, input: CreateWorldInput) => {
  const user = await upsertUserFromFirebaseToken(decodedToken);

  try {
    return await prisma.world.create({
      data: {
        ownerId: user.id,
        name: input.name,
        description: input.description ?? null,
        minecraftVersion: input.minecraftVersion ?? null,
      },
      select: worldSelect,
    });
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      throw new WorldNameConflictError();
    }

    throw error;
  }
};
