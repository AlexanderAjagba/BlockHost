declare module 'firebase/app' {
  export function initializeApp(config: Record<string, unknown>): unknown;
}

declare module 'firebase/auth' {
  export const GoogleAuthProvider: {
    PROVIDER_ID: string;
  };

  export class OAuthProvider {
    constructor(providerId: string);
  }

  export function getAuth(app?: unknown): unknown;
}

declare module 'firebase/firestore' {
  export function getFirestore(app?: unknown): unknown;
}

declare module 'firebaseui' {
  const firebaseui: {
    auth: {
      AuthUI: {
        getInstance(): any;
        new (auth: unknown): {
          start(selector: string, config: Record<string, unknown>): void;
        };
      };
    };
  };

  export default firebaseui;
}

declare module 'firebaseui/dist/firebaseui.css';