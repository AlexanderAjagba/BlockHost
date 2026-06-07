import type { DecodedIdToken } from "firebase-admin/auth";
import { prisma } from "../config/prisma";

export const upsertUserFromFirebaseToken = async (decodedToken: DecodedIdToken) => {
  const email = decodedToken.email ?? null;
  const displayName = decodedToken.name ?? null;
  const photoUrl = decodedToken.picture ?? null;

  return prisma.user.upsert({
    where: {
      firebaseUid: decodedToken.uid,
    },
    create: {
      firebaseUid: decodedToken.uid,
      email,
      displayName,
      photoUrl,
    },
    update: {
      email,
      displayName,
      photoUrl,
    },
  });
};