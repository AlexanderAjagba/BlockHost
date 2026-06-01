import * as firebaseui from 'firebaseui';
import 'firebaseui/dist/firebaseui.css';
import { GoogleAuthProvider, OAuthProvider, onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../config/firebase';
import { renderDashboard } from './Dashboard';

const microsoftProvider = new OAuthProvider('microsoft.com');

const showMessage = (message: string, isError = false) => {
  const messageEl = document.querySelector<HTMLParagraphElement>('#auth-message');

  if (!messageEl) {
    return;
  }

  messageEl.textContent = message;
  messageEl.className = `mt-4 min-h-5 text-center text-sm ${isError ? 'text-red-200' : 'text-sky-100/75'}`;
};

const showLoading = (isLoading: boolean) => {
  const loadingEl = document.querySelector<HTMLParagraphElement>('#auth-loading');
  const authContainer = document.querySelector<HTMLDivElement>('#firebaseui-auth-container');

  if (loadingEl) {
    loadingEl.hidden = !isLoading;
  }

  if (authContainer) {
    authContainer.setAttribute('aria-busy', String(isLoading));
  }
};

const goToDashboard = (root: HTMLElement, user: User) => {
  window.history.replaceState({}, '', '/dashboard');
  renderDashboard(root, user);
};

const uiConfig: firebaseui.auth.Config = {
  signInFlow: 'popup',
  signInOptions: [GoogleAuthProvider.PROVIDER_ID, microsoftProvider.providerId],
  tosUrl: '/terms',
  privacyPolicyUrl: '/privacy',
  callbacks: {
    signInSuccessWithAuthResult: () => false,
    signInFailure: async (error) => {
      showLoading(false);
      showMessage(error.message || 'Sign in failed. Please try again.', true);
    },
    uiShown: () => {
      showLoading(false);
    },
  },
};

export const renderSignup = (root: HTMLElement) => {
  root.innerHTML = `
    <main class="min-h-screen bg-gradient-to-br from-slate-950 via-sky-950 to-slate-900 relative overflow-hidden">
      <!-- background blobs -->
      <div class="absolute -top-24 -left-24 w-80 h-80 rounded-full blur-3xl opacity-30 bg-sky-400"></div>
      <div class="absolute -bottom-28 -right-24 w-96 h-96 rounded-full blur-3xl opacity-20 bg-cyan-300"></div>
      <div class="absolute top-28 right-16 w-64 h-64 rounded-full blur-3xl opacity-20 bg-blue-500"></div>
      <div class="absolute -bottom-8 left-10 w-56 h-56 rounded-full blur-3xl opacity-10 bg-emerald-300"></div>

      <div class="flex min-h-screen items-center justify-center px-4 py-12">
        <div class="relative z-10 w-full max-w-md rounded-3xl bg-white/10 backdrop-blur-2xl border border-white/20 shadow-2xl shadow-sky-950/50 p-8">
          <h1 class="text-3xl font-bold text-white text-center">Welcome to BlockHost</h1>
          <p class="mt-3 text-center text-sm leading-6 text-sky-100/75">Back up and manage your Minecraft worlds in the cloud, so you can keep playing across devices.</p>

          <div class="mt-8">
            <style>
              /* Minimal overrides for FirebaseUI to match theme */
              .firebaseui-idp-button {
                background: rgba(56,189,248,0.95) !important; /* sky-400 */
                color: #061126 !important;
                border-radius: 1rem !important;
                min-height: 3rem !important;
                box-shadow: 0 8px 20px rgba(14,165,233,0.12) !important;
                border: 1px solid rgba(255,255,255,0.06) !important;
              }
              .firebaseui-idp-button .firebaseui-idp-text, .firebaseui-idp-button .firebaseui-idp-icon { color: #061126 !important; }
              .firebaseui-card-footer, .firebaseui-tos, .firebaseui-link { color: rgba(203,213,225,0.85) !important; }
            </style>
            <p id="auth-loading" class="text-center text-sm text-sky-100/75">Checking sign-in status...</p>
            <div id="firebaseui-auth-container"></div>
            <p id="auth-message" class="mt-4 min-h-5 text-center text-sm text-sky-100/75" role="status" aria-live="polite"></p>
          </div>
        </div>
      </div>
    </main>
  `;

  showLoading(true);

  const unsubscribe = onAuthStateChanged(
    auth,
    (user) => {
      if (user) {
        unsubscribe();
        goToDashboard(root, user);
        return;
      }

      const ui = firebaseui.auth.AuthUI.getInstance() ?? new firebaseui.auth.AuthUI(auth);
      ui.start('#firebaseui-auth-container', uiConfig);
    },
    (error) => {
      showLoading(false);
      showMessage(error.message, true);
    },
  );
};
