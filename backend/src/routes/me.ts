import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { upsertUserFromFirebaseToken } from "../services/userService";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const user = await upsertUserFromFirebaseToken((req as AuthenticatedRequest).user);
    res.json(user);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown user upsert error.";
    console.error("Failed to upsert authenticated user:", message);
    res.status(500).json({ error: "Failed to load authenticated user." });
  }
});

export default router;