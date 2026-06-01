import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";

const router = Router();

router.get("/", requireAuth, (req, res) => {
  const { uid, email, name, picture } = (req as AuthenticatedRequest).user;

  res.json({
    uid,
    email,
    name,
    picture,
  });
});

export default router;
