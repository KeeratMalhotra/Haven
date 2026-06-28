/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jsdom",
  setupFiles: ["<rootDir>/jest.setup.js"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
          module: "esnext",
          moduleResolution: "bundler",
          esModuleInterop: true,
          allowJs: true,
          strict: true,
          noEmit: true,
          isolatedModules: true,
          resolveJsonModule: true,
          target: "ES2017",
          lib: ["dom", "dom.iterable", "esnext"],
          skipLibCheck: true,
          paths: {
            "@/*": ["./*"],
          },
        },
      },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "\\.glsl$": "<rootDir>/__mocks__/fileMock.js",
    // react-markdown / remark-gfm ship as native ESM that ts-jest does not
    // transform; map them to local stubs so component tests can import them.
    "^react-markdown$": "<rootDir>/__mocks__/react-markdown.tsx",
    "^remark-gfm$": "<rootDir>/__mocks__/remark-gfm.js",
  },
  testMatch: ["**/__tests__/**/*.test.(ts|tsx)"],
};

module.exports = config;
