import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Admin from "../components/Admin";
import SuggestionDialog from "../components/SuggestionDialog";
import { isAdmin, loadAdmin, percent, type Metrics, type Suggestion } from "../lib/admin";

const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ getBrowserClient: () => ({ rpc }) }));

const metrics: Metrics = {
  users: { total: 40, last7: 12, last30: 31, withNotes: 30, active7: 9 },
  content: { notes: 210, tables: 8, nodes: 55, notebooks: 14, links: 60, cards: 120, events: 7, shares: 3 },
  ai: { uses: 88, people: 11 },
  daily: [
    { day: "2026-11-04", count: 3 },
    { day: "2026-11-05", count: 6 },
  ],
  campaigns: [
    { name: "hoja-09", count: 18 },
    { name: "sin campaña", count: 22 },
  ],
  sources: [{ name: "instagram", count: 18 }],
  suggestions: { nueva: 1, vista: 0, hecha: 1 },
};
const suggestions: Suggestion[] = [
  { id: "a", kind: "idea", message: "Quiero modo oscuro", status: "nueva", created_at: "2026-11-05T15:00:00Z", email: "ana@correo.com" },
  { id: "b", kind: "problema", message: "No carga el calendario", status: "hecha", created_at: "2026-11-04T15:00:00Z", email: "luis@correo.com" },
];

beforeEach(() => rpc.mockReset());
afterEach(cleanup);

describe("percent", () => {
  it("rounds and never divides by zero", () => {
    expect(percent(30, 40)).toBe(75);
    expect(percent(1, 0)).toBe(0);
  });
});

describe("admin helpers", () => {
  it("isAdmin is true only when the database says so", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await isAdmin({ rpc } as never)).toBe(true);
    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await isAdmin({ rpc } as never)).toBe(false);
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    expect(await isAdmin({ rpc } as never)).toBe(false);
  });

  it("loadAdmin returns null for people who are not admins", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    expect(await loadAdmin({ rpc } as never)).toBeNull();
  });

  it("loadAdmin returns the numbers and the suggestions", async () => {
    rpc.mockImplementation(async (name: string) => ({ data: name === "admin_metrics" ? metrics : suggestions, error: null }));
    const data = await loadAdmin({ rpc } as never);
    expect(data?.metrics.users.total).toBe(40);
    expect(data?.suggestions).toHaveLength(2);
  });
});

describe("Admin panel", () => {
  it("shows the key numbers and where accounts come from", () => {
    render(<Admin metrics={metrics} suggestions={suggestions} />);
    expect(screen.getByText("75%")).toBeTruthy();
    expect(screen.getByText("hoja-09")).toBeTruthy();
    expect(screen.getByText("instagram")).toBeTruthy();
    expect(screen.getByText("40")).toBeTruthy();
  });

  it("lists new suggestions first and lets the admin change their status", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    render(<Admin metrics={metrics} suggestions={suggestions} />);
    expect(screen.getByText("Quiero modo oscuro")).toBeTruthy();
    expect(screen.queryByText("No carga el calendario")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "vista" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("admin_set_suggestion_status", { p_id: "a", p_status: "vista" }));
    fireEvent.click(screen.getByRole("button", { name: "todas" }));
    expect(screen.getByText("No carga el calendario")).toBeTruthy();
  });
});

describe("SuggestionDialog", () => {
  it("sends the suggestion and thanks the person", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    render(<SuggestionDialog onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Algo falla" }));
    fireEvent.change(screen.getByLabelText("Tu sugerencia"), { target: { value: "Se traba el zoom" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("send_suggestion", { p_kind: "problema", p_message: "Se traba el zoom" }));
    expect(await screen.findByRole("status")).toBeTruthy();
  });

  it("does not send an empty message", () => {
    render(<SuggestionDialog onClose={() => {}} />);
    expect((screen.getByRole("button", { name: "Enviar" }) as HTMLButtonElement).disabled).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("explains when the daily limit is reached", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    render(<SuggestionDialog onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("Tu sugerencia"), { target: { value: "Otra idea más" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/límite de hoy/);
  });
});
