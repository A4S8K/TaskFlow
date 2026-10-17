import { z } from "zod";

// Configure before constructing schemas: strict CSP must never trigger Zod's
// Function-constructor feature probe or JIT compilation in the browser.
z.config({ jitless: true });

export { z };
