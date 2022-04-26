
// "eslintConfig": {
//   "extends": "@hayeslv",
//   "ignorePatterns": ["auto-imports.d.ts"],
//   "rules": {}
// }
const { defineConfig } = require("eslint-define-config");

module.exports = defineConfig({
  extends: "@hayeslv",
  rules: {
    "@typescript-eslint/no-inferrable-types": "off",
  },
});
