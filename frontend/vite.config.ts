import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { loadEnv } from "vite";
import { productionCsp, resolveApiConfig } from "./src/api/config.ts";

export default defineConfig(({ command, mode, isPreview }) => {
  const environment = loadEnv(mode, process.cwd(), "VITE_");
  const production = command === "build" || Boolean(isPreview);
  const apiBaseURL = resolveApiConfig({
    apiURL:
      environment.VITE_API_URL ||
      (!production ? "http://localhost:8000" : undefined),
    apiMode: environment.VITE_API_MODE,
    production,
    vercel: process.env.VERCEL === "1",
  });
  return {
    define: { __TASKFLOW_API_BASE_URL__: JSON.stringify(apiBaseURL) },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "taskflow-production-csp",
        transformIndexHtml() {
          return production
            ? [
                {
                  tag: "meta",
                  attrs: {
                    "http-equiv": "Content-Security-Policy",
                    content: productionCsp(apiBaseURL),
                  },
                  injectTo: "head-prepend" as const,
                },
              ]
            : [];
        },
      },
    ],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: { port: 5173, strictPort: true },
    test: {
      pool: "threads",
      maxWorkers: 1,
      testTimeout: 15000,
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      restoreMocks: true,
      clearMocks: true,
      coverage: {
        provider: "v8",
        reporter: ["text", "html"],
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/test/**", "src/locales/**", "src/main.tsx"],
      },
    },
  };
});
