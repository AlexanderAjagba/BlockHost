declare module 'firebaseui' {
  import type { Auth } from 'firebase/auth';

  export namespace auth {
    interface AuthUIError {
      code?: string;
      message?: string;
    }

    interface Config {
      signInFlow?: 'popup' | 'redirect';
      signInOptions: Array<string | Record<string, unknown>>;
      tosUrl?: string;
      privacyPolicyUrl?: string;
      callbacks?: {
        signInSuccessWithAuthResult?: () => boolean;
        signInFailure?: (error: AuthUIError) => Promise<void> | void;
        uiShown?: () => void;
      };
    }

    class AuthUI {
      constructor(auth: Auth);
      static getInstance(): AuthUI | null;
      start(selector: string, config: Config): void;
    }
  }
}

declare module 'firebaseui/dist/firebaseui.css';