import firebaseui from 'firebaseui';
import 'firebaseui/dist/firebaseui.css';
import { GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { auth } from '../config/firebase';

const uiConfig = {
  signInFlow: 'popup',
  signInSuccessUrl: '/dashboard',
  signInOptions: [GoogleAuthProvider.PROVIDER_ID, 'microsoft.com'],
  tosUrl: '/terms',
  privacyPolicyUrl: '/privacy',
};

export const renderSignup = (root: HTMLElement) => {
  root.innerHTML = `
    <main class="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-8 text-slate-100">
      <section class="w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur">
        <div class="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div class="flex flex-col justify-between bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-600 p-10 text-white">
            <div>
              <p class="text-sm font-semibold uppercase tracking-[0.3em] text-white/80">BlockHost</p>
              <h1 class="mt-6 max-w-md text-4xl font-semibold leading-tight">
                Sign in with FirebaseUI instead of a custom password form.
              </h1>
              <p class="mt-4 max-w-md text-base text-white/85">
                Pick a provider and let Firebase handle the auth flow.
              </p>
            </div>
            <p class="mt-12 text-sm text-white/70">
              Sign-in will take you to the dashboard after success.
            </p>
          </div>
          <div class="bg-slate-950/80 p-8 sm:p-10">
            <div class="mx-auto flex w-full max-w-md flex-col">
              <div id="firebaseui-auth-container"></div>
            </div>
          </div>
        </div>
      </section>
    </main>
  `;

  const firebaseuiAny = firebaseui as any;
  const existingUi = firebaseuiAny.auth.AuthUI.getInstance();
  const ui = existingUi ?? new firebaseuiAny.auth.AuthUI(auth);

  ui.start('#firebaseui-auth-container', uiConfig);
};