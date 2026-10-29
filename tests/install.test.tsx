import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InstallTip from "../components/InstallTip";

function media(matches: (q: string) => boolean) {
  window.matchMedia = ((q: string) => ({
    matches: matches(q), media: q, addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}
const phone = (q: string) => q.includes("pointer: coarse");
const base = { ready: true, forceOpen: false, onClose: vi.fn() };

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("InstallTip", () => {
  it("shows a few seconds after the tour on a phone that hasn't installed Hoja", () => {
    localStorage.setItem("hoja:tour:v1", "1");
    media(phone);
    render(<InstallTip {...base} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => void vi.advanceTimersByTime(6100));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
  it("stays away before the tour is done, on desktop, once dismissed, or when already installed", () => {
    media(phone);
    const a = render(<InstallTip {...base} />);
    act(() => void vi.advanceTimersByTime(7000));
    expect(screen.queryByRole("dialog")).toBeNull(); // tour not seen
    a.unmount();

    localStorage.setItem("hoja:tour:v1", "1");
    media(() => false);
    const b = render(<InstallTip {...base} />);
    act(() => void vi.advanceTimersByTime(7000));
    expect(screen.queryByRole("dialog")).toBeNull(); // not a phone
    b.unmount();

    media(phone);
    localStorage.setItem("hoja:install:v1", "1");
    const c = render(<InstallTip {...base} />);
    act(() => void vi.advanceTimersByTime(7000));
    expect(screen.queryByRole("dialog")).toBeNull(); // dismissed
    c.unmount();

    localStorage.clear();
    localStorage.setItem("hoja:tour:v1", "1");
    media((q) => phone(q) || q.includes("standalone"));
    render(<InstallTip {...base} />);
    act(() => void vi.advanceTimersByTime(7000));
    expect(screen.queryByRole("dialog")).toBeNull(); // already installed
  });
  it("opens on demand and remembers when it is closed", () => {
    media(() => false);
    render(<InstallTip {...base} forceOpen />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByText("Entendido"));
    expect(localStorage.getItem("hoja:install:v1")).toBe("1");
    expect(base.onClose).toHaveBeenCalled();
  });
});
