import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Landing from "../components/Landing";

afterEach(cleanup);

describe("Landing", () => {
  it("sends people to sign up or sign in", () => {
    render(<Landing />);
    const signup = screen.getAllByRole("link", { name: /crear (mi )?cuenta/i });
    expect(signup.length).toBeGreaterThanOrEqual(2);
    signup.forEach((a) => expect(a.getAttribute("href")).toBe("/login?modo=registro"));
    expect(screen.getAllByRole("link", { name: /^Entrar$/ })[0].getAttribute("href")).toBe("/login");
  });

  it("shows the app on stage: a headline, draggable example notes and labelled example data", () => {
    render(<Landing />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/lienzo sin bordes/);
    expect(screen.getByLabelText(/Fotosíntesis \(arrástrala\)/)).toBeTruthy();
    expect(screen.getByText(/datos de ejemplo/i)).toBeTruthy();
  });

  it("explains the features as a map: picking a branch opens its note", () => {
    render(<Landing />);
    expect(screen.getByRole("heading", { name: "Un lienzo sin bordes" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reuniones" }));
    expect(screen.getByRole("heading", { name: "Reuniones que terminan en pendientes" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reuniones" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("doesn't promise prices or numbers", () => {
    const { container } = render(<Landing />);
    expect(container.textContent).not.toMatch(/gratis|\$\s?\d+\s*\/|por mes|usuarios/i);
  });
});
