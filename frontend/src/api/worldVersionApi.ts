import { authenticatedRequest } from './apiClient';

export interface WorldVersionMetadata {
  id: string;
  versionNumber: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface WorldVersionUploadInput {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface CompleteWorldVersionUploadInput {
  uploadId: string;
}

export interface WorldVersionUploadUrl {
  uploadId: string;
  uploadUrl: string;
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

export interface UploadProgress {
  loadedBytes: number;
  totalBytes: number;
  percent: number;
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
  onProgress?: (progress: UploadProgress) => void,
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open('PUT', uploadUrl);

    for (const [name, value] of Object.entries(requiredHeaders)) {
      request.setRequestHeader(name, value);
    }

    request.upload.addEventListener('progress', (event) => {
      const totalBytes = event.lengthComputable ? event.total : file.size;
      const loadedBytes = event.loaded;
      const percent = totalBytes > 0 ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : 0;

      onProgress?.({
        loadedBytes,
        totalBytes,
        percent,
      });
    });

    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.({
          loadedBytes: file.size,
          totalBytes: file.size,
          percent: 100,
        });
        resolve();
        return;
      }

      reject(new Error(`Upload failed with status ${request.status}.`));
    });

    request.addEventListener('error', () => {
      reject(new Error('Network error. Please check your connection and try again.'));
    });

    request.addEventListener('abort', () => {
      reject(new Error('Upload was canceled.'));
    });

    request.send(file);
  });
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
