import AppBar from "./AppBar";

/** What shows while a signed-in page loads: the bar stays, the body is just the grid. */
export default function PageShell({ current }: { current: "lienzo" | "estudio" | "calendario" }) {
  return (
    <div className="app">
      <AppBar current={current} />
      <main className="canvas" aria-busy="true" />
    </div>
  );
}
