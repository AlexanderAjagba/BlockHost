import { authenticatedRequest } from './apiClient';

export interface WorldMetadata {
  id: string;
  name: string;
  description: string | null;
  minecraftVersion: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorldInput {
  name: string;
  description?: string;
  minecraftVersion?: string;
}

interface ListWorldsResponse {
  worlds: WorldMetadata[];
}

export const listWorlds = async (): Promise<WorldMetadata[]> => {
  const response = await authenticatedRequest<ListWorldsResponse>('/api/worlds');
  return response.worlds;
};

export const createWorld = async (input: CreateWorldInput): Promise<WorldMetadata> => {
  return authenticatedRequest<WorldMetadata>('/api/worlds', {
    method: 'POST',
    body: JSON.stringify(input),
  });
};
