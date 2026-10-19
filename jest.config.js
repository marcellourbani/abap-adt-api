// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

module.exports = {
    // An array of file extensions your modules use
    moduleFileExtensions: ["ts", "tsx", "js"],

    // The paths to modules that run some code to configure or set up the testing environment before each test
    setupFiles: ["<rootDir>/setenv.js"],

    // The test environment that will be used for testing
    testEnvironment: "node",

    // The glob patterns Jest uses to detect test files
    testMatch: ["**/__tests__/*.+(ts|tsx|js)", "**/*.test.ts"],

    // A map from regular expressions to paths to transformers
    // effect is ESM only: jest loads it through require(esm), which needs
    // --experimental-vm-modules (set by the npm test script)
    // 151002: ts-jest wants isolatedModules with module nodenext, the emitted CommonJS is the same
    transform: {
        "\\.(ts|tsx)$": ["ts-jest", { tsconfig: "tsconfig.json", diagnostics: { ignoreCodes: [151002] } }]
    },
    testTimeout: 10000,
    transformIgnorePatterns: ["/node_modules/"]
}
