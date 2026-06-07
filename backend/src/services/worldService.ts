import type { DecodedIdToken } from "firebase-admin/auth";
import { prisma } from "../config/prisma";
import { upsertUserFromFirebaseToken } from "./userService";

export interface CreateWorldInput {
  name: string;
  description?: string | null;
  minecraftVersion?: string | null;
}

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

  return prisma.world.create({
    data: {
      ownerId: user.id,
      name: input.name,
      description: input.description ?? null,
      minecraftVersion: input.minecraftVersion ?? null,
    },
    select: worldSelect,
  });
};