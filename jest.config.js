/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  // only run tests in ./src
  testPathIgnorePatterns: ["/node_modules/", "/build/"],
}
