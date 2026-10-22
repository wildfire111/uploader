// keeps password managers from offering to fill a field: autoComplete for the browser, then the
// opt-outs 1Password, LastPass, Bitwarden and Dashlane each read
export const noAutofill = {
  autoComplete: "off",
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
} as const;
