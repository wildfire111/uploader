
export class MoxfieldReauthRequiredError extends Error {
  constructor() {
    super("Moxfield needs to be reconnected. An admin can do this at /admin/moxfield.");
    this.name = "MoxfieldReauthRequiredError";
  }
}

export class MoxfieldRateLimitedError extends Error {
  constructor() {
    super(
      "Moxfield is rate limiting requests. Wait a minute, then click Publish again — it resumes where it stopped."
    );
    this.name = "MoxfieldRateLimitedError";
  }
}

export class MoxfieldContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoxfieldContentError";
  }
}

export class MoxfieldUserAgentMissingError extends Error {
  constructor() {
    super("Moxfield's User-Agent isn't set. An admin can set it under Moxfield Settings.");
    this.name = "MoxfieldUserAgentMissingError";
  }
}
