import { auth, db } from "./config/firebase";

const root = document.querySelector<HTMLDivElement>("#app");

if (root) {
  root.innerHTML = `
    <main style="font-family: ui-sans-serif, system-ui, -apple-system; padding: 2rem;">
      <h1>BlockHost Frontend</h1>
      <p>Firebase initialized. Auth and Firestore are ready to use.</p>
    </main>
  `;
}

console.log("Firebase auth:", auth);
console.log("Firebase db:", db);
