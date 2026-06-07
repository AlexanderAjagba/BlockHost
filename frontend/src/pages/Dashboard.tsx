import { signOut, type User } from 'firebase/auth';
import { authenticatedRequest } from '../api/apiClient';
import { createWorld, listWorlds, type CreateWorldInput, type WorldMetadata } from '../api/worldApi';
import { auth } from '../config/firebase';
import { bindWorldVersionPanel, updateWorldVersionWorlds } from './dashboard/worldVersionPanel';

interface MeResponse {
  id: string;
  firebaseUid: string;
  email: string | null;
}

const setStatus = (selector: string, message: string, isError = false) => {
  const status = document.querySelector<HTMLParagraphElement>(selector);

  if (!status) {
    return;
  }

  status.textContent = message;
  status.className = `mt-3 text-sm ${isError ? 'text-red-200' : 'text-emerald-200'}`;
};

const loadMe = async () => {
  setStatus('#backend-auth-status', 'Checking backend auth...');

  try {
    const user = await authenticatedRequest<MeResponse>('/api/me');
    setStatus('#backend-auth-status', `Backend verified ${user.email ?? user.firebaseUid}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Backend auth check failed.';
    setStatus('#backend-auth-status', message, true);
  }
};

const formatDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const renderWorlds = (worlds: WorldMetadata[]) => {
  const list = document.querySelector<HTMLDivElement>('#world-list');
  const emptyState = document.querySelector<HTMLParagraphElement>('#world-empty-state');

  if (!list || !emptyState) {
    return;
  }

  list.replaceChildren();
  emptyState.hidden = worlds.length > 0;

  for (const world of worlds) {
    const card = document.createElement('article');
    card.className = 'rounded-lg border border-white/10 bg-slate-900 p-5';
    card.innerHTML = `
      <div class="flex items-start justify-between gap-4">
        <div>
          <h3 class="world-name text-lg font-semibold text-white"></h3>
          <p class="world-version mt-1 text-xs font-medium uppercase text-sky-300"></p>
        </div>
        <time class="world-updated text-right text-xs text-slate-400"></time>
      </div>
      <p class="world-description mt-4 text-sm leading-6 text-slate-300"></p>
    `;

    const name = card.querySelector<HTMLHeadingElement>('.world-name');
    const version = card.querySelector<HTMLParagraphElement>('.world-version');
    const updated = card.querySelector<HTMLTimeElement>('.world-updated');
    const description = card.querySelector<HTMLParagraphElement>('.world-description');

    if (name) {
      name.textContent = world.name;
    }
    if (version) {
      version.textContent = world.minecraftVersion ?? 'Version not set';
    }
    if (updated) {
      updated.dateTime = world.updatedAt;
      updated.textContent = `Updated ${formatDate(world.updatedAt)}`;
    }
    if (description) {
      description.textContent = world.description ?? 'No description';
    }

    list.append(card);
  }
};

const loadWorlds = async () => {
  const loading = document.querySelector<HTMLParagraphElement>('#world-loading');
  const errorState = document.querySelector<HTMLParagraphElement>('#world-error');

  if (loading) {
    loading.hidden = false;
  }
  if (errorState) {
    errorState.hidden = true;
  }

  try {
    const worlds = await listWorlds();
    renderWorlds(worlds);
    await updateWorldVersionWorlds(worlds);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load worlds.';
    if (errorState) {
      errorState.textContent = message;
      errorState.hidden = false;
    }
  } finally {
    if (loading) {
      loading.hidden = true;
    }
  }
};

const getOptionalValue = (formData: FormData, fieldName: string): string | undefined => {
  const value = formData.get(fieldName);

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
};

const bindCreateWorldForm = () => {
  const form = document.querySelector<HTMLFormElement>('#create-world-form');
  const submitButton = document.querySelector<HTMLButtonElement>('#create-world-submit');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const name = getOptionalValue(formData, 'name');

    if (!name) {
      setStatus('#create-world-status', 'World name is required.', true);
      return;
    }

    const input: CreateWorldInput = {
      name,
      description: getOptionalValue(formData, 'description'),
      minecraftVersion: getOptionalValue(formData, 'minecraftVersion'),
    };

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Creating...';
    }
    setStatus('#create-world-status', 'Creating world...');

    try {
      await createWorld(input);
      form.reset();
      setStatus('#create-world-status', 'World created.');
      await loadWorlds();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create world.';
      setStatus('#create-world-status', message, true);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Create world';
      }
    }
  });
};

export const renderDashboard = (root: HTMLElement, user: User) => {
  root.innerHTML = `
    <main class="min-h-screen bg-slate-950 text-white">
      <nav class="border-b border-white/10 bg-slate-900/80">
        <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div class="text-lg font-bold">BlockHost</div>
          <button id="sign-out-button" class="rounded-lg bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-300">Sign out</button>
        </div>
      </nav>

      <section class="mx-auto max-w-5xl px-4 py-10">
        <h1 class="text-3xl font-bold">Dashboard</h1>
        <p id="signed-in-user" class="mt-3 text-sky-100/75"></p>
        <p id="backend-auth-status" class="mt-3 text-sm text-sky-100/75" role="status" aria-live="polite">Checking backend auth...</p>

        <div class="mt-10 grid gap-10 lg:grid-cols-[18rem_1fr]">
          <section aria-labelledby="create-world-heading">
            <h2 id="create-world-heading" class="text-lg font-semibold">Add world</h2>
            <form id="create-world-form" class="mt-4 space-y-4">
              <label class="block text-sm text-slate-200">
                Name
                <input name="name" required class="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white outline-none focus:border-sky-400" />
              </label>
              <label class="block text-sm text-slate-200">
                Description
                <textarea name="description" rows="3" class="mt-1 w-full resize-y rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white outline-none focus:border-sky-400"></textarea>
              </label>
              <label class="block text-sm text-slate-200">
                Minecraft version
                <input name="minecraftVersion" class="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white outline-none focus:border-sky-400" placeholder="1.21.5" />
              </label>
              <button id="create-world-submit" type="submit" class="w-full rounded-lg bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-300 disabled:cursor-wait disabled:opacity-60">Create world</button>
              <p id="create-world-status" class="mt-3 text-sm text-sky-100/75" role="status" aria-live="polite"></p>
            </form>
          </section>

          <section aria-labelledby="world-list-heading">
            <div class="flex items-center justify-between gap-4">
              <h2 id="world-list-heading" class="text-lg font-semibold">Your worlds</h2>
              <button id="refresh-worlds-button" class="text-sm font-medium text-sky-300 hover:text-sky-200">Refresh</button>
            </div>
            <p id="world-loading" class="mt-4 text-sm text-sky-100/75">Loading worlds...</p>
            <p id="world-error" class="mt-4 text-sm text-red-200" role="alert" hidden></p>
            <p id="world-empty-state" class="mt-4 text-sm text-slate-400" hidden>No worlds yet.</p>
            <div id="world-list" class="mt-4 grid gap-4"></div>
          </section>
        </div>

        <section class="mt-12 border-t border-white/10 pt-10" aria-labelledby="backup-heading">
          <h2 id="backup-heading" class="text-xl font-semibold">World backups</h2>
          <div class="mt-5 grid gap-8 lg:grid-cols-[18rem_1fr]">
            <form id="upload-version-form" class="space-y-4">
              <label class="block text-sm text-slate-200">
                World
                <select id="upload-world-select" class="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white outline-none focus:border-sky-400" disabled></select>
              </label>
              <label class="block text-sm text-slate-200">
                ZIP backup
                <input id="world-zip-file" type="file" accept=".zip,application/zip,application/x-zip-compressed" class="mt-1 block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-sky-400 file:px-3 file:py-2 file:font-semibold file:text-slate-950" />
              </label>
              <button id="upload-world-submit" type="submit" class="w-full rounded-lg bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-300 disabled:cursor-wait disabled:opacity-60" disabled>Upload ZIP</button>
              <p id="upload-status" class="mt-3 text-sm text-sky-100/75" role="status" aria-live="polite"></p>
            </form>

            <div>
              <h3 class="text-lg font-semibold">Uploaded versions</h3>
              <p id="version-loading" class="mt-4 text-sm text-sky-100/75" hidden>Loading versions...</p>
              <p id="version-error" class="mt-4 text-sm text-red-200" role="alert" hidden></p>
              <p id="version-empty-state" class="mt-4 text-sm text-slate-400">Select a world to view its versions.</p>
              <div id="version-list" class="mt-3"></div>
            </div>
          </div>
        </section>
      </section>
    </main>
  `;

  const signedInUser = document.querySelector<HTMLParagraphElement>('#signed-in-user');
  if (signedInUser) {
    signedInUser.textContent = `Signed in as ${user.email ?? user.displayName ?? user.uid}`;
  }

  document.querySelector<HTMLButtonElement>('#sign-out-button')?.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = '/';
  });
  document.querySelector<HTMLButtonElement>('#refresh-worlds-button')?.addEventListener('click', () => {
    void loadWorlds();
  });

  bindCreateWorldForm();
  bindWorldVersionPanel();
  void loadMe();
  void loadWorlds();
};
