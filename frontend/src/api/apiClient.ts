import { auth } from '../config/firebase';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';

const getErrorMessage = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as unknown;

    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string'
    ) {
      return body.error;
    }
  } catch {
    // The response did not contain a JSON error body.
  }

  return `Request failed with status ${response.status}.`;
};

export const authenticatedRequest = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('You must be signed in to continue.');
  }

  if (!apiBaseUrl) {
    throw new Error('Missing VITE_API_BASE_URL.');
  }

  const token = await user.getIdToken();
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);

  if (options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as T;
};
