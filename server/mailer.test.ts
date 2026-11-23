import { describe, expect, it } from "vitest";
import {
  describeMailError,
  isCertificateError,
  isSmtpConfigured,
  transportOptions,
} from "./mailer";
import type { SmtpSettings } from "./settingsDb";

const BASE: SmtpSettings = {
  host: "mail.dexels.com",
  port: 587,
  secure: false,
  user: "website@sendrato.com",
  password: "secret",
  from: "website@sendrato.com",
  allowInvalidCert: false,
};

describe("transportOptions", () => {
  it("verifies the server certificate by default", () => {
    const opts = transportOptions(BASE);
    expect(opts.tls.rejectUnauthorized).toBe(true);
    expect(opts.tls.servername).toBe("mail.dexels.com");
    expect(opts.tls).not.toHaveProperty("ciphers");
    expect(opts.auth).toEqual({
      user: "website@sendrato.com",
      pass: "secret",
    });
  });

  it("relaxes verification only when explicitly allowed", () => {
    const opts = transportOptions({ ...BASE, allowInvalidCert: true });
    expect(opts.tls.rejectUnauthorized).toBe(false);
    // Legacy TLS/ciphers, matching what the IMAP poller needs for this host.
    expect(opts.tls).toMatchObject({
      minVersion: "TLSv1",
      ciphers: "DEFAULT:@SECLEVEL=0",
    });
  });

  it("omits auth for an unauthenticated relay", () => {
    const opts = transportOptions({ ...BASE, user: "", password: "" });
    expect(opts).not.toHaveProperty("auth");
  });
});

describe("isCertificateError", () => {
  it("recognises node TLS trust failures", () => {
    expect(
      isCertificateError(
        Object.assign(new Error("x"), { code: "DEPTH_ZERO_SELF_SIGNED_CERT" })
      )
    ).toBe(true);
    expect(isCertificateError(new Error("self-signed certificate"))).toBe(true);
    expect(
      isCertificateError(new Error("unable to verify the first certificate"))
    ).toBe(true);
  });

  it("ignores unrelated failures", () => {
    expect(isCertificateError(new Error("Invalid login: 535"))).toBe(false);
    expect(isCertificateError(new Error("ECONNREFUSED"))).toBe(false);
  });
});

describe("describeMailError", () => {
  it("tells the operator how to accept an untrusted certificate", () => {
    const msg = describeMailError(new Error("self-signed certificate"), BASE);
    expect(msg).toContain("self-signed certificate");
    expect(msg).toContain("mail.dexels.com");
    expect(msg).toContain("Allow self-signed certificate");
  });

  it("does not repeat the hint once the option is on", () => {
    const msg = describeMailError(new Error("self-signed certificate"), {
      ...BASE,
      allowInvalidCert: true,
    });
    expect(msg).toBe("self-signed certificate");
  });

  it("passes other errors through untouched", () => {
    expect(describeMailError(new Error("Invalid login: 535"), BASE)).toBe(
      "Invalid login: 535"
    );
  });
});

describe("isSmtpConfigured", () => {
  it("requires a host and a from address", () => {
    expect(isSmtpConfigured(BASE)).toBe(true);
    expect(isSmtpConfigured({ ...BASE, host: "" })).toBe(false);
    expect(isSmtpConfigured({ ...BASE, from: "" })).toBe(false);
  });
});
