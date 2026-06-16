import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { upsertUserFromFirebaseToken } from "../services/userService";
import { getErrorLogSummary } from "../utils/logging";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const user = await upsertUserFromFirebaseToken((req as AuthenticatedRequest).user);
    res.json(user);
  } catch (error) {
    console.error("Failed to upsert authenticated user:", getErrorLogSummary(error));
    res.status(500).json({ error: "Failed to load authenticated user." });
  }
});

export default router;
