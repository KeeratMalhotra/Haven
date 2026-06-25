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
  },
  testMatch: ["**/__tests__/**/*.test.(ts|tsx)"],
};

module.exports = config;
