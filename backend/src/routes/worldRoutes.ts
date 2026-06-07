import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { createWorldForFirebaseUser, listWorldsForFirebaseUser, type CreateWorldInput } from "../services/worldService";
import {
  createWorldVersionUploadUrl,
  WorldNotFoundError,
} from "../services/worldVersionService";
import worldVersionRoutes from "./worldVersionRoutes";

const router = Router();
const MAX_WORLD_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024 * 1024;
const ALLOWED_ZIP_CONTENT_TYPES = new Set([
  "application/zip",
  "application/x-zip-compressed",
]);

interface UploadUrlInput {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const parseOptionalString = (value: unknown, fieldName: string): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string when provided.`);
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
};

const parseCreateWorldBody = (body: unknown): CreateWorldInput => {
  if (!isPlainObject(body)) {
    throw new Error("Request body must be a JSON object.");
  }

  const { name, description, minecraftVersion } = body;

  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error("name is required and must be a non-empty string.");
  }

  return {
    name: name.trim(),
    description: parseOptionalString(description, "description"),
    minecraftVersion: parseOptionalString(minecraftVersion, "minecraftVersion"),
  };
};

const parseUploadUrlBody = (body: unknown): UploadUrlInput => {
  if (!isPlainObject(body)) {
    throw new Error("Request body must be a JSON object.");
  }

  const { fileName, contentType, sizeBytes } = body;

  if (typeof fileName !== "string" || fileName.trim().length === 0) {
    throw new Error("fileName is required and must be a non-empty string.");
  }

  if (typeof contentType !== "string" || !ALLOWED_ZIP_CONTENT_TYPES.has(contentType)) {
    throw new Error("contentType must be application/zip or application/x-zip-compressed.");
  }

  if (
    typeof sizeBytes !== "number" ||
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes <= 0 ||
    sizeBytes > MAX_WORLD_UPLOAD_SIZE_BYTES
  ) {
    throw new Error(`sizeBytes must be a positive integer no larger than ${MAX_WORLD_UPLOAD_SIZE_BYTES}.`);
  }

  return {
    fileName: fileName.trim(),
    contentType,
    sizeBytes,
  };
};

router.get("/", requireAuth, async (req, res) => {
  try {
    const worlds = await listWorldsForFirebaseUser((req as AuthenticatedRequest).user.uid);
    res.json({ worlds });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown world list error.";
    console.error("Failed to list worlds:", message);
    res.status(500).json({ error: "Failed to list worlds." });
  }
});

router.post("/", requireAuth, async (req, res) => {
  let input: CreateWorldInput;

  try {
    input = parseCreateWorldBody(req.body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid world payload.";
    res.status(400).json({ error: message });
    return;
  }

  try {
    const world = await createWorldForFirebaseUser((req as AuthenticatedRequest).user, input);
    res.status(201).json(world);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown world create error.";
    console.error("Failed to create world:", message);
    res.status(500).json({ error: "Failed to create world." });
  }
});

router.post("/:worldId/versions/upload-url", requireAuth, async (req, res) => {
  const worldId = req.params.worldId;

  if (typeof worldId !== "string" || worldId.length === 0) {
    res.status(400).json({ error: "worldId is required." });
    return;
  }

  let input: UploadUrlInput;

  try {
    input = parseUploadUrlBody(req.body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid upload URL payload.";
    res.status(400).json({ error: message });
    return;
  }

  try {
    const result = await createWorldVersionUploadUrl({
      worldId,
      firebaseUid: (req as AuthenticatedRequest).user.uid,
      fileName: input.fileName,
      contentType: input.contentType,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof WorldNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }

    const message = error instanceof Error ? error.message : "Unknown signed upload URL error.";
    console.error("Failed to create signed upload URL:", message);
    res.status(500).json({ error: "Failed to create signed upload URL." });
  }
});

router.use("/:worldId/versions", worldVersionRoutes);

export default router;
