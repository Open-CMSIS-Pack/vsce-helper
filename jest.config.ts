import type { Config } from "jest";

const config: Config = {
    verbose: true,
    preset: "ts-jest",
    testEnvironment: "node",
    extensionsToTreatAsEsm: ['.ts'],
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    }
};


export default config;
