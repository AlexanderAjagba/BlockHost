import type { WorldMetadata } from '../../api/worldApi';
import {
  completeWorldVersionUpload,
  listWorldVersions,
  requestWorldVersionDownloadUrl,
  requestWorldVersionUploadUrl,
  uploadFileToSignedUrl,
  type WorldVersionMetadata,
  type WorldVersionUploadInput,
} from '../../api/worldVersionApi';

const MAX_WORLD_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024 * 1024;
const ALLOWED_ZIP_CONTENT_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
]);
let selectedWorldId = '';

const setStatus = (message: string, isError = false) => {
  const status = document.querySelector<HTMLParagraphElement>('#upload-status');
  if (!status) return;

  status.textContent = message;
  status.className = `mt-3 text-sm ${isError ? 'text-red-200' : 'text-emerald-200'}`;
};

const formatDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const formatBytes = (value: number): string => {
  if (value < 1024) return `${value} B`;

  const units = ['KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = -1;

  do {
    size /= 1024;
    unitIndex += 1;
  } while (size >= 1024 && unitIndex < units.length - 1);

  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
};

const renderVersions = (versions: WorldVersionMetadata[]) => {
  const list = document.querySelector<HTMLDivElement>('#version-list');
  const emptyState = document.querySelector<HTMLParagraphElement>('#version-empty-state');
  if (!list || !emptyState) return;

  list.replaceChildren();
  emptyState.hidden = versions.length > 0;

  for (const version of versions) {
    const item = document.createElement('article');
    item.className = 'flex flex-wrap items-center justify-between gap-3 border-b border-white/10 py-3 last:border-b-0';
    item.innerHTML = `
      <div>
        <p class="version-title text-sm font-semibold text-white"></p>
        <p class="version-file mt-1 text-xs text-slate-400"></p>
      </div>
      <div class="flex items-center gap-4">
        <div class="text-right">
        <p class="version-size text-sm text-slate-200"></p>
        <time class="version-date mt-1 block text-xs text-slate-400"></time>
        </div>
        <button class="version-download rounded-md border border-sky-400/50 px-3 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-400/10 disabled:cursor-wait disabled:opacity-60">Download</button>
      </div>
    `;

    const title = item.querySelector<HTMLParagraphElement>('.version-title');
    const fileName = item.querySelector<HTMLParagraphElement>('.version-file');
    const size = item.querySelector<HTMLParagraphElement>('.version-size');
    const date = item.querySelector<HTMLTimeElement>('.version-date');
    const downloadButton = item.querySelector<HTMLButtonElement>('.version-download');

    if (title) title.textContent = `Version ${version.versionNumber}`;
    if (fileName) fileName.textContent = version.fileName;
    if (size) size.textContent = formatBytes(version.sizeBytes);
    if (date) {
      date.dateTime = version.createdAt;
      date.textContent = formatDate(version.createdAt);
    }
    downloadButton?.addEventListener('click', async () => {
      if (!selectedWorldId) return;

      downloadButton.disabled = true;
      downloadButton.textContent = 'Preparing...';
      setStatus('Requesting secure download URL...');

      try {
        const result = await requestWorldVersionDownloadUrl(selectedWorldId, version.id);
        setStatus(`Download ready: ${result.fileName}`);
        window.location.href = result.downloadUrl;
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Failed to prepare download.', true);
      } finally {
        downloadButton.disabled = false;
        downloadButton.textContent = 'Download';
      }
    });

    list.append(item);
  }
};

const loadVersions = async () => {
  const loading = document.querySelector<HTMLParagraphElement>('#version-loading');
  const errorState = document.querySelector<HTMLParagraphElement>('#version-error');

  if (!selectedWorldId) {
    renderVersions([]);
    if (loading) loading.hidden = true;
    return;
  }

  if (loading) loading.hidden = false;
  if (errorState) errorState.hidden = true;

  try {
    renderVersions(await listWorldVersions(selectedWorldId));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load world versions.';
    if (errorState) {
      errorState.textContent = message;
      errorState.hidden = false;
    }
  } finally {
    if (loading) loading.hidden = true;
  }
};

const validateZipFile = (file: File | undefined): WorldVersionUploadInput => {
  if (!file) throw new Error('Choose a ZIP file to upload.');
  if (!file.name.toLowerCase().endsWith('.zip')) throw new Error('The selected file must end with .zip.');
  if (file.type && !ALLOWED_ZIP_CONTENT_TYPES.has(file.type)) {
    throw new Error('The selected file must use a ZIP content type.');
  }
  if (file.size <= 0) throw new Error('The selected ZIP file is empty.');
  if (file.size > MAX_WORLD_UPLOAD_SIZE_BYTES) throw new Error('The selected ZIP file must be 2 GB or smaller.');

  return {
    fileName: file.name,
    contentType: file.type || 'application/zip',
    sizeBytes: file.size,
  };
};

export const updateWorldVersionWorlds = async (worlds: WorldMetadata[]): Promise<void> => {
  const selector = document.querySelector<HTMLSelectElement>('#upload-world-select');
  if (!selector) return;

  const previousSelection = selectedWorldId;
  selector.replaceChildren();

  for (const world of worlds) {
    const option = document.createElement('option');
    option.value = world.id;
    option.textContent = world.name;
    selector.append(option);
  }

  selectedWorldId = worlds.some((world) => world.id === previousSelection)
    ? previousSelection
    : worlds[0]?.id ?? '';
  selector.value = selectedWorldId;
  selector.disabled = worlds.length === 0;

  const uploadButton = document.querySelector<HTMLButtonElement>('#upload-world-submit');
  if (uploadButton) uploadButton.disabled = worlds.length === 0;

  await loadVersions();
};

export const bindWorldVersionPanel = () => {
  const selector = document.querySelector<HTMLSelectElement>('#upload-world-select');
  const form = document.querySelector<HTMLFormElement>('#upload-version-form');
  const fileInput = document.querySelector<HTMLInputElement>('#world-zip-file');
  const submitButton = document.querySelector<HTMLButtonElement>('#upload-world-submit');

  selector?.addEventListener('change', () => {
    selectedWorldId = selector.value;
    void loadVersions();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!selectedWorldId) {
      setStatus('Select a world before uploading.', true);
      return;
    }

    const file = fileInput?.files?.[0];
    let input: WorldVersionUploadInput;

    try {
      input = validateZipFile(file);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Invalid ZIP file.', true);
      return;
    }
    if (!file) return;

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Uploading...';
    }

    try {
      setStatus('Requesting secure upload URL...');
      const signedUpload = await requestWorldVersionUploadUrl(selectedWorldId, input);

      setStatus('Uploading ZIP directly to R2...');
      await uploadFileToSignedUrl(signedUpload.uploadUrl, file, signedUpload.requiredHeaders);

      setStatus('Verifying upload...');
      await completeWorldVersionUpload(selectedWorldId, {
        ...input,
        objectKey: signedUpload.objectKey,
      });

      if (fileInput) fileInput.value = '';
      setStatus('World version uploaded.');
      await loadVersions();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'World version upload failed.', true);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Upload ZIP';
      }
    }
  });
};
