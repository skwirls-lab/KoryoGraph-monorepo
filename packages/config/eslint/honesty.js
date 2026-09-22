/**
 * Honesty rules (KORYOGRAPH-BUILD.md Appendix B.3).
 * The prototype must never simulate the product: no mock/fake data constants, no placeholder ids,
 * no raw HTML injection, no getSession() for authorization, no console logging in app code.
 *
 * @type {import("eslint").Linter.Config[]}
 */
const restricted = [
  {
    selector: "Identifier[name=/^(MOCK|FAKE|DUMMY|PLACEHOLDER)_/]",
    message: "Honesty rule: no MOCK_/FAKE_/DUMMY_/PLACEHOLDER_ data. Read the real database.",
  },
  {
    selector: "Literal[value='placeholder-id']",
    message: "Honesty rule: no placeholder ids.",
  },
  {
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message: "Raw HTML injection is not allowed.",
  },
];

export const honesty = [
  {
    rules: {
      "no-restricted-syntax": ["error", ...restricted],
      "no-console": "error",
    },
  },
  {
    files: ["**/src/server/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...restricted,
        {
          selector: "CallExpression[callee.property.name='getSession']",
          message: "Authorize with supabase.auth.getUser(), never getSession().",
        },
      ],
    },
  },
  {
    files: ["scripts/**", "**/scripts/**", "tests/**", "**/*.test.ts", "**/*.spec.ts"],
    rules: { "no-console": "off" },
  },
];

export default honesty;
