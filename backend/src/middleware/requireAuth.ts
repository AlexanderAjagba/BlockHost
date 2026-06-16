import type { NextFunction, Request, Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getAuth } from "firebase-admin/auth";
import { getErrorLogSummary } from "../utils/logging";

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
    console.error("Firebase ID token verification failed:", getErrorLogSummary(error));
    res.status(401).json({ error: "Invalid Firebase ID token." });
  }
};
