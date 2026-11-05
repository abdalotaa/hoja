import { describe, expect, it } from "vitest";
import { plainAnswer } from "../lib/ai";

describe("plainAnswer", () => {
  it("turns a written \\n into a real line break", () => {
    expect(plainAnswer("Hola\\n\\nMundo\\nfin")).toBe("Hola\n\nMundo\nfin");
  });

  it("leaves real line breaks and normal text alone", () => {
    expect(plainAnswer("Una línea\nOtra")).toBe("Una línea\nOtra");
  });

  it("does not stack more than one blank line", () => {
    expect(plainAnswer("a\\n\\n\\n\\nb")).toBe("a\n\nb");
  });
});
