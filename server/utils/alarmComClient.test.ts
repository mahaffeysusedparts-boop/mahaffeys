import { describe, expect, it } from "vitest";
import {
  applySetCookieLine,
  applySetCookieLines,
  authFailureMessage,
  cookieHeader,
  parseCamerasResponse,
  parseClipsResponse,
  parseIdentityResponse,
  unwrapAdcPayload,
  type AdcCookieJar,
} from "./alarmComClient";

describe("alarm.com cookie jar", () => {
  it("stores cookies from set-cookie lines", () => {
    const jar: AdcCookieJar = {};
    applySetCookieLine(jar, "afg=abc123; Path=/; HttpOnly");
    applySetCookieLine(jar, "adcSession=xyz; Path=/; Secure; HttpOnly");
    expect(jar).toEqual({ afg: "abc123", adcSession: "xyz" });
    expect(cookieHeader(jar)).toBe("afg=abc123; adcSession=xyz");
  });

  it("overwrites updated cookies and keeps values containing =", () => {
    const jar: AdcCookieJar = { afg: "old" };
    applySetCookieLine(jar, "afg=new=value; Path=/");
    expect(jar.afg).toBe("new=value");
  });

  it("drops cookies expired via Max-Age=0, past Expires, or empty value", () => {
    const jar: AdcCookieJar = { keep: "1", maxAge: "1", expired: "1", empty: "1" };
    applySetCookieLines(jar, [
      "maxAge=1; Path=/; Max-Age=0",
      `expired=1; Path=/; Expires=Wed, 21 Oct 2015 07:28:00 GMT`,
      "empty=; Path=/",
    ]);
    expect(jar).toEqual({ keep: "1" });
    expect(cookieHeader(jar)).toBe("keep=1");
  });

  it("ignores blank names", () => {
    const jar: AdcCookieJar = {};
    applySetCookieLine(jar, "=weird; Path=/");
    expect(jar).toEqual({});
  });
});

describe("alarm.com payload unwrapping", () => {
  it("unwraps result/data envelopes", () => {
    expect(unwrapAdcPayload({ result: { ok: true } })).toEqual({ ok: true });
    expect(unwrapAdcPayload({ data: [1, 2] })).toEqual([1, 2]);
    expect(unwrapAdcPayload({ plain: true })).toEqual({ plain: true });
    expect(unwrapAdcPayload(null)).toBeNull();
  });
});

describe("alarm.com identity probe parsing", () => {
  it("detects a required two-factor challenge with device id", () => {
    const probe = parseIdentityResponse({
      result: {
        twoFactorAuthenticationRequired: true,
        twoFactorType: 1,
        deviceId: "device-77",
      },
    });
    expect(probe.requiresTwoFactor).toBe(true);
    expect(probe.twoFactorType).toBe(1);
    expect(probe.deviceId).toBe("device-77");
    expect(probe.captchaRequired).toBe(false);
  });

  it("treats new-device challenges as two-factor too", () => {
    const probe = parseIdentityResponse({ newDeviceTwoFactorRequired: true });
    expect(probe.requiresTwoFactor).toBe(true);
  });

  it("extracts the first error message from the errors array", () => {
    const probe = parseIdentityResponse({
      errors: [{ message: "Invalid username or password" }, { message: "second" }],
    });
    expect(probe.message).toBe("Invalid username or password");
    expect(probe.requiresTwoFactor).toBe(false);
  });

  it("flags captcha challenges", () => {
    const probe = parseIdentityResponse({ captchaRequired: true });
    expect(probe.captchaRequired).toBe(true);
  });

  it("tolerates non-object payloads", () => {
    expect(parseIdentityResponse(null)).toEqual({ requiresTwoFactor: false, captchaRequired: false });
  });
});

describe("alarm.com camera list parsing", () => {
  it("reads a plain array of devices", () => {
    const cameras = parseCamerasResponse([
      { id: 101, name: "Building Front 1" },
      { id: "102", name: "Lobby", location: "Main office" },
      { id: 103, name: "Scale LPR", location: { name: "Scale house", description: "east side" } },
    ]);
    expect(cameras).toHaveLength(3);
    expect(cameras[0]).toEqual({ deviceId: "101", name: "Building Front 1", location: undefined });
    expect(cameras[1].location).toBe("Main office");
    expect(cameras[2].location).toBe("Scale house");
  });

  it("reads cameras nested in a data envelope", () => {
    const cameras = parseCamerasResponse({ data: [{ id: 5, name: "Warehouse" }] });
    expect(cameras[0].deviceId).toBe("5");
  });

  it("falls back to a display name when only an id exists", () => {
    const cameras = parseCamerasResponse([{ id: 9 }]);
    expect(cameras[0].name).toBe("Alarm.com camera 9");
  });

  it("returns [] when nothing looks like a camera list", () => {
    expect(parseCamerasResponse({ unrelated: { deep: 1 } })).toEqual([]);
    expect(parseCamerasResponse([])).toEqual([]);
  });
});

describe("alarm.com clips parsing", () => {
  it("maps media items with a signed video url", () => {
    const clips = parseClipsResponse({
      data: [
        {
          id: "clip-1",
          name: "Front motion",
          startTime: "2025-01-02T03:04:05Z",
          duration: 30,
          url: "https://cdn.alarm.com/media/clip-1.mp4?sig=abc",
        },
        { id: "clip-2", downloadUrl: "https://cdn.alarm.com/media/clip-2.mp4", cameraId: 101 },
      ],
    });
    expect(clips).toHaveLength(2);
    expect(clips[0].videoUrl).toContain("clip-1.mp4");
    expect(clips[0].durationSeconds).toBe(30);
    expect(clips[1].deviceId).toBe("101");
  });

  it("ignores items without an http(s) video url", () => {
    const clips = parseClipsResponse([{ id: "no-url" }, { id: "bad", url: "javascript:alert(1)" }]);
    expect(clips).toEqual([]);
  });
});

describe("alarm.com auth failure explanations", () => {
  it("surfaces alarm.com's own JSON error message verbatim", () => {
    const json = { errors: [{ message: "Invalid username or password." }] };
    const response = new Response(JSON.stringify(json), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
    expect(authFailureMessage(response, json, "Alarm.com rejected the sign-in")).toBe("Invalid username or password.");
  });

  it("blames Cloudflare bot protection for HTML 403 instead of the password", () => {
    const response = new Response("<html><title>Just a moment…</title></html>", {
      status: 403,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
    const message = authFailureMessage(response, null, "Alarm.com rejected the sign-in");
    expect(message).toContain("bot protection");
    expect(message).toContain("403");
    expect(message).not.toContain("password");
  });

  it("keeps the HTTP status visible when the API returns no message (endpoint drift)", () => {
    const response = new Response("{}", { status: 404, headers: { "content-type": "application/json" } });
    expect(authFailureMessage(response, {}, "Alarm.com rejected the sign-in")).toBe("Alarm.com rejected the sign-in (HTTP 404)");
  });

  it("explains rate limiting on a bare 429", () => {
    const response = new Response("{}", { status: 429, headers: { "content-type": "application/json" } });
    expect(authFailureMessage(response, {}, "Alarm.com rejected the sign-in")).toContain("rate limiting");
  });
});
