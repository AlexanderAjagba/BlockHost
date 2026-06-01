import type { NextFunction, Request, Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getAuth } from "firebase-admin/auth";

export interface AuthenticatedRequest extends Request {
  user: DecodedIdToken;
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authorization = req.header("Authorization");
  const [scheme, token] = authorization?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ error: "Missing or invalid Authorization header." });
    return;
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    (req as AuthenticatedRequest).user = decodedToken;
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Firebase token verification error.";
    console.error("Firebase ID token verification failed:", message);
    res.status(401).json({ error: "Invalid Firebase ID token." });
  }
};