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
let isUploading = false;

type UploadPhase =
  | 'idle'
  | 'validating'
  | 'requesting-url'
  | 'uploading'
  | 'completing'
  | 'complete'
  | 'failed';

const uploadPhaseText: Record<UploadPhase, string> = {
  idle: '',
  validating: 'Validating ZIP backup...',
  'requesting-url': 'Preparing secure upload session...',
  uploading: 'Uploading ZIP backup...',
  completing: 'Finishing backup verification...',
  complete: 'Backup uploaded.',
  failed: 'Upload failed.',
};

const setStatus = (message: string, isError = false) => {
  const status = document.querySelector<HTMLParagraphElement>('#upload-status');
  if (!status) return;

  status.textContent = message;
  status.className = `mt-3 text-sm ${isError ? 'text-red-200' : 'text-emerald-200'}`;
};

const setDownloadStatus = (message: string, isError = false) => {
  const status = document.querySelector<HTMLParagraphElement>('#download-status');
  if (!status) return;

  status.textContent = message;
  status.hidden = message.length === 0;
  status.className = `mt-4 text-sm ${isError ? 'text-red-200' : 'text-emerald-200'}`;
};

const setUploadPhase = (phase: UploadPhase, detail?: string) => {
  const message = detail ?? uploadPhaseText[phase];
  setStatus(message, phase === 'failed');
};

const setUploadProgress = (percent: number) => {
  const wrapper = document.querySelector<HTMLDivElement>('#upload-progress-wrap');
  const bar = document.querySelector<HTMLDivElement>('#upload-progress-bar');
  if (!wrapper || !bar) return;

  wrapper.hidden = false;
  bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
};

const resetUploadProgress = () => {
  const wrapper = document.querySelector<HTMLDivElement>('#upload-progress-wrap');
  const bar = document.querySelector<HTMLDivElement>('#upload-progress-bar');
  if (!wrapper || !bar) return;

  wrapper.hidden = true;
  bar.style.width = '0%';
};

const getFriendlyUploadError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : '';

  if (
    message.includes('Choose a ZIP') ||
    message.includes('must end with .zip') ||
    message.includes('ZIP content type') ||
    message.includes('contentType must be')
  ) {
    return 'Please choose a .zip Minecraft world backup.';
  }
  if (message.includes('2 GB') || message.includes('2147483648')) {
    return 'This file is too large. Maximum size is 2 GB.';
  }
  if (message.includes('empty')) {
    return 'This ZIP backup is empty. Please choose a valid backup file.';
  }
  if (message.includes('Pending upload not found')) {
    return 'The upload session expired. Please try again.';
  }
  if (message.includes('Uploaded object was not found') || message.includes('does not match')) {
    return 'The uploaded ZIP could not be verified. Please try again.';
  }
  if (message.includes('Failed to fetch') || message.includes('Network error')) {
    return 'Network error. Please check your connection and try again.';
  }
  if (message.includes('Upload failed with status')) {
    return 'The ZIP upload failed. Please try again.';
  }

  return message || 'Upload failed. Please try again.';
};

const getFriendlyDownloadError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : '';

  if (message.includes('World version not found')) {
    return 'This backup is no longer available.';
  }
  if (message.includes('Failed to fetch') || message.includes('Network error')) {
    return 'Network error. Please check your connection and try again.';
  }

  return message || 'Could not prepare the download. Please try again.';
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
  emptyState.textContent = selectedWorldId
    ? 'No backups yet for this world. Upload a ZIP backup and it will appear here.'
    : 'Select a world to view its backups.';

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
      setDownloadStatus('Preparing secure download...');

      try {
        const result = await requestWorldVersionDownloadUrl(selectedWorldId, version.id);
        setDownloadStatus(`Download ready: ${result.fileName}`);
        window.location.href = result.downloadUrl;
      } catch (error) {
        setDownloadStatus(getFriendlyDownloadError(error), true);
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
  setDownloadStatus('');

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
    if (errorState) {
      errorState.textContent = getFriendlyDownloadError(error);
      errorState.hidden = false;
    }
  } finally {
    if (loading) loading.hidden = true;
  }
};

const validateZipFile = (file: File | undefined): WorldVersionUploadInput => {
  if (!file) throw new Error('Please choose a .zip Minecraft world backup.');
  if (!file.name.toLowerCase().endsWith('.zip')) throw new Error('Please choose a .zip Minecraft world backup.');
  if (file.type && !ALLOWED_ZIP_CONTENT_TYPES.has(file.type)) {
    throw new Error('Please choose a .zip Minecraft world backup.');
  }
  if (file.size <= 0) throw new Error('This ZIP backup is empty. Please choose a valid backup file.');
  if (file.size > MAX_WORLD_UPLOAD_SIZE_BYTES) throw new Error('This file is too large. Maximum size is 2 GB.');

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
  if (uploadButton) uploadButton.disabled = worlds.length === 0 || isUploading;

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

    if (isUploading) {
      return;
    }

    if (!selectedWorldId) {
      setStatus('Select a world before uploading.', true);
      return;
    }

    const file = fileInput?.files?.[0];
    let input: WorldVersionUploadInput;

    try {
      setUploadPhase('validating');
      input = validateZipFile(file);
    } catch (error) {
      setUploadPhase('failed', getFriendlyUploadError(error));
      return;
    }
    if (!file) return;

    isUploading = true;
    resetUploadProgress();

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Uploading...';
    }
    if (fileInput) fileInput.disabled = true;
    if (selector) selector.disabled = true;

    try {
      setUploadPhase('requesting-url');
      const signedUpload = await requestWorldVersionUploadUrl(selectedWorldId, input);

      setUploadPhase('uploading', 'Uploading ZIP backup... 0%');
      await uploadFileToSignedUrl(
        signedUpload.uploadUrl,
        file,
        signedUpload.requiredHeaders,
        ({ percent }) => {
          setUploadProgress(percent);
          setUploadPhase('uploading', `Uploading ZIP backup... ${percent}%`);
        },
      );

      setUploadPhase('completing');
      await completeWorldVersionUpload(selectedWorldId, {
        uploadId: signedUpload.uploadId,
      });

      if (fileInput) fileInput.value = '';
      setUploadProgress(100);
      setUploadPhase('complete');
      await loadVersions();
    } catch (error) {
      setUploadPhase('failed', getFriendlyUploadError(error));
    } finally {
      isUploading = false;
      if (submitButton) {
        submitButton.disabled = !selectedWorldId;
        submitButton.textContent = 'Upload ZIP';
      }
      if (fileInput) fileInput.disabled = false;
      if (selector) selector.disabled = !selectedWorldId;
    }
  });
};
