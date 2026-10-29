import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Tour from "../components/Tour";

const base = { ready: true, empty: true, forceOpen: false, onClose: vi.fn(), onSample: vi.fn() };
beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
});

describe("Tour", () => {
  it("opens by itself for someone with no notes", () => {
    render(<Tour {...base} />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Bienvenida a Hoja")).toBeTruthy();
  });
  it("stays away once seen, or when there are notes, or while loading", () => {
    localStorage.setItem("hoja:tour:v1", "1");
    const { unmount } = render(<Tour {...base} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    unmount();
    localStorage.clear();
    const a = render(<Tour {...base} empty={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    a.unmount();
    render(<Tour {...base} ready={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("can be reopened on demand even after it was seen", () => {
    localStorage.setItem("hoja:tour:v1", "1");
    render(<Tour {...base} forceOpen />);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
  it("walks the steps, rings the target and can create the sample note", () => {
    const target = document.createElement("button");
    target.setAttribute("data-tour", "new");
    document.body.appendChild(target);
    render(<Tour {...base} />);
    fireEvent.click(screen.getByText("Siguiente"));
    expect(target.classList.contains("tour-hl")).toBe(true);
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByText("Siguiente"));
    expect(target.classList.contains("tour-hl")).toBe(false);
    act(() => fireEvent.click(screen.getByText("Probar con una nota de ejemplo")));
    expect(base.onSample).toHaveBeenCalledOnce();
    expect(base.onClose).toHaveBeenCalled();
    expect(localStorage.getItem("hoja:tour:v1")).toBe("1");
  });
  it("Saltar closes it and remembers", () => {
    render(<Tour {...base} />);
    fireEvent.click(screen.getByText("Saltar"));
    expect(localStorage.getItem("hoja:tour:v1")).toBe("1");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
