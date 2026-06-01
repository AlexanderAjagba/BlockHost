import { signOut, type User } from 'firebase/auth';
import { auth } from '../config/firebase';

interface MeResponse {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

const renderStatus = (message: string, isError = false) => {
  const status = document.querySelector<HTMLParagraphElement>('#backend-auth-status');

  if (!status) {
    return;
  }

  status.textContent = message;
  status.className = `mt-4 text-sm ${isError ? 'text-red-200' : 'text-emerald-200'}`;
};

const loadMe = async (user: User) => {
  if (!apiBaseUrl) {
    renderStatus('Missing VITE_API_BASE_URL, so the backend auth check could not run.', true);
    return;
  }

  renderStatus('Checking backend auth...');

  try {
    const token = await user.getIdToken();
    const response = await fetch(`${apiBaseUrl}/api/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const data = (await response.json()) as MeResponse;
    renderStatus(`Backend verified Firebase user ${data.email ?? data.uid}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Backend auth check failed.';
    renderStatus(message, true);
  }
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
        <p id="backend-auth-status" class="mt-4 text-sm text-sky-100/75" role="status" aria-live="polite">Checking backend auth...</p>
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

  void loadMe(user);
};
