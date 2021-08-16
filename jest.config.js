module.exports = {
    verbose: true,
    collectCoverage: true,
    collectCoverageFrom: [
        'src/**/*.{js,jsx,ts,tsx}',
    ],
    coveragePathIgnorePatterns: [],
    testEnvironment: 'jsdom',
    testEnvironmentOptions: {
        resources: 'usable',
        runScripts: 'dangerously',
    },
    testMatch: [
        '<rootDir>/test/**/*.{js,jsx,ts,tsx}',
    ],
    testPathIgnorePatterns: [
        '/_.*(?<!.test.[jt]sx?)$',
    ],
    transform: {
        '\\.([tj]sx?)$': 'ts-jest',
    },
    transformIgnorePatterns: [
        '/node_modules/',
    ],
    setupFilesAfterEnv: [
        '<rootDir>/test/_setup.js',
    ],
}
