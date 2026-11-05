import { beforeEach, describe, expect, it } from "vitest";
import { captureAttribution, parseAttribution, readAttribution } from "../lib/attribution";

beforeEach(() => localStorage.clear());

describe("attribution", () => {
  it("keeps only the utm parameters it knows", () => {
    expect(parseAttribution("?utm_source=instagram&utm_campaign=hoja-09&x=1&utm_term=nope")).toEqual({
      utm_source: "instagram",
      utm_campaign: "hoja-09",
    });
  });

  it("saves the campaign on the first visit and returns it later", () => {
    captureAttribution("?utm_source=instagram&utm_campaign=hoja-09");
    expect(readAttribution()).toEqual({ utm_source: "instagram", utm_campaign: "hoja-09" });
  });

  it("does not replace the first campaign with a later one", () => {
    captureAttribution("?utm_campaign=hoja-09");
    captureAttribution("?utm_campaign=hoja-01");
    expect(readAttribution()).toEqual({ utm_campaign: "hoja-09" });
  });

  it("stores nothing for a visit without campaign parameters", () => {
    captureAttribution("?modo=registro");
    expect(readAttribution()).toEqual({});
  });

  it("cuts very long values", () => {
    const long = "a".repeat(200);
    expect(parseAttribution(`?utm_campaign=${long}`).utm_campaign).toHaveLength(80);
  });
});
