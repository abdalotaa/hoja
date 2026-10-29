type Store = { ready: boolean; pending: boolean; error: boolean };

export default function SyncStatus({ stores, cloud }: { stores: Store[]; cloud: boolean }) {
  const error = stores.some((s) => s.error);
  const ready = stores.every((s) => s.ready);
  const pending = stores.some((s) => s.pending);
  return (
    <span className="mono sync" style={error ? { color: "var(--accent)" } : undefined} role="status">
      {error ? (
        "No se pudo guardar o sincronizar"
      ) : !ready ? (
        "Cargando…"
      ) : pending ? (
        "Guardando…"
      ) : cloud ? (
        "Guardado"
      ) : (
        <>
          Guardado<span className="sync-long"> en este navegador</span>
        </>
      )}
    </span>
  );
}
