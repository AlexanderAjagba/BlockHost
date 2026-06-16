import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import {
  completeWorldVersionUpload,
  createWorldVersionDownloadUrl,
  InvalidWorldVersionObjectKeyError,
  listWorldVersions,
  PendingWorldUploadNotFoundError,
  UploadedObjectMetadataMismatchError,
  UploadedObjectNotFoundError,
  WorldNotFoundError,
  WorldVersionNotFoundError,
  type CompleteWorldVersionInput,
} from "../services/worldVersionService";
import { getErrorLogSummary } from "../utils/logging";

const router = Router({ mergeParams: true });

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const getWorldId = (value: string | string[] | undefined): string | null => {
  return typeof value === "string" && value.length > 0 ? value : null;
};

const getVersionId = (value: string | string[] | undefined): string | null => {
  return typeof value === "string" && value.length > 0 ? value : null;
};

const parseCompleteBody = (
  body: unknown,
  worldId: string,
  firebaseUid: string,
): CompleteWorldVersionInput => {
  if (!isPlainObject(body)) {
    throw new Error("Request body must be a JSON object.");
  }

  const { uploadId } = body;

  if (typeof uploadId !== "string" || uploadId.length === 0) {
    throw new Error("uploadId is required and must be a non-empty string.");
  }

  return {
    worldId,
    firebaseUid,
    uploadId,
  };
};

const handleServiceError = (error: unknown, operation: string): { status: number; message: string } => {
  if (error instanceof WorldNotFoundError) {
    return { status: 404, message: error.message };
  }
  if (error instanceof WorldVersionNotFoundError) {
    return { status: 404, message: error.message };
  }
  if (error instanceof InvalidWorldVersionObjectKeyError) {
    return { status: 400, message: error.message };
  }
  if (error instanceof PendingWorldUploadNotFoundError) {
    return { status: 404, message: error.message };
  }
  if (error instanceof UploadedObjectNotFoundError) {
    return { status: 404, message: error.message };
  }
  if (error instanceof UploadedObjectMetadataMismatchError) {
    return { status: 409, message: error.message };
  }

  console.error(`Failed to ${operation}:`, getErrorLogSummary(error));
  return { status: 500, message: `Failed to ${operation}.` };
};

router.get("/", requireAuth, async (req, res) => {
  const worldId = getWorldId(req.params.worldId);

  if (!worldId) {
    res.status(400).json({ error: "worldId is required." });
    return;
  }

  try {
    const versions = await listWorldVersions(worldId, (req as AuthenticatedRequest).user.uid);
    res.json({ versions });
  } catch (error) {
    const result = handleServiceError(error, "list world versions");
    res.status(result.status).json({ error: result.message });
  }
});

router.post("/complete", requireAuth, async (req, res) => {
  const worldId = getWorldId(req.params.worldId);

  if (!worldId) {
    res.status(400).json({ error: "worldId is required." });
    return;
  }

  let input: CompleteWorldVersionInput;

  try {
    input = parseCompleteBody(
      req.body,
      worldId,
      (req as AuthenticatedRequest).user.uid,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid completion payload.";
    res.status(400).json({ error: message });
    return;
  }

  try {
    const version = await completeWorldVersionUpload(input);
    res.status(201).json(version);
  } catch (error) {
    const result = handleServiceError(error, "complete world version upload");
    res.status(result.status).json({ error: result.message });
  }
});

router.post("/:versionId/download-url", requireAuth, async (req, res) => {
  const worldId = getWorldId(req.params.worldId);
  const versionId = getVersionId(req.params.versionId);

  if (!worldId || !versionId) {
    res.status(400).json({ error: "worldId and versionId are required." });
    return;
  }

  try {
    const result = await createWorldVersionDownloadUrl(
      worldId,
      versionId,
      (req as AuthenticatedRequest).user.uid,
    );
    res.json(result);
  } catch (error) {
    const result = handleServiceError(error, "create world version download URL");
    res.status(result.status).json({ error: result.message });
  }
});

export default router;
