import { authenticatedRequest } from './apiClient';

export interface WorldVersionMetadata {
  id: string;
  versionNumber: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  objectKey: string;
  createdAt: string;
}

export interface WorldVersionUploadInput {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface CompleteWorldVersionUploadInput extends WorldVersionUploadInput {
  objectKey: string;
}

export interface WorldVersionUploadUrl {
  uploadUrl: string;
  objectKey: string;
  expiresInSeconds: number;
  requiredHeaders: Record<string, string>;
}

export interface WorldVersionDownloadUrl {
  downloadUrl: string;
  expiresInSeconds: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

interface ListWorldVersionsResponse {
  versions: WorldVersionMetadata[];
}

export const requestWorldVersionUploadUrl = async (
  worldId: string,
  input: WorldVersionUploadInput,
): Promise<WorldVersionUploadUrl> => {
  return authenticatedRequest<WorldVersionUploadUrl>(
    `/api/worlds/${encodeURIComponent(worldId)}/versions/upload-url`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
};

export const completeWorldVersionUpload = async (
  worldId: string,
  input: CompleteWorldVersionUploadInput,
): Promise<WorldVersionMetadata> => {
  return authenticatedRequest<WorldVersionMetadata>(
    `/api/worlds/${encodeURIComponent(worldId)}/versions/complete`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
};

export const listWorldVersions = async (worldId: string): Promise<WorldVersionMetadata[]> => {
  const response = await authenticatedRequest<ListWorldVersionsResponse>(
    `/api/worlds/${encodeURIComponent(worldId)}/versions`,
  );
  return response.versions;
};

export const uploadFileToSignedUrl = async (
  uploadUrl: string,
  file: File,
  requiredHeaders: Record<string, string>,
): Promise<void> => {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: requiredHeaders,
  });

  if (!response.ok) {
    throw new Error(`R2 upload failed with status ${response.status}.`);
  }
};

export const requestWorldVersionDownloadUrl = async (
  worldId: string,
  versionId: string,
): Promise<WorldVersionDownloadUrl> => {
  return authenticatedRequest<WorldVersionDownloadUrl>(
    `/api/worlds/${encodeURIComponent(worldId)}/versions/${encodeURIComponent(versionId)}/download-url`,
    {
      method: 'POST',
    },
  );
};
