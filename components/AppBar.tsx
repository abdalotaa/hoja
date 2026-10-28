import Link from "next/link";

interface Props {
  current: "lienzo" | "estudio";
  userEmail?: string;
  children?: React.ReactNode;
}

/** The top bar shared by the canvas and the study page. */
export default function AppBar({ current, userEmail, children }: Props) {
  return (
    <header className="bar">
      <div className="brand">
        <img src="/m4-symbol.svg" alt="" width={26} height={26} />
        Hoja
      </div>
      <nav className="tabs" aria-label="Secciones">
        <Link href="/" aria-current={current === "lienzo" ? "page" : undefined}>
          Lienzo
        </Link>
        <Link href="/estudio" aria-current={current === "estudio" ? "page" : undefined}>
          Estudio
        </Link>
      </nav>
      <span className="spacer" />
      {children}
      {userEmail && (
        <form action="/auth/signout" method="post" className="who-form">
          <span className="who" title={userEmail}>
            {userEmail}
          </span>
          <button className="btn line" type="submit">
            Salir
          </button>
        </form>
      )}
    </header>
  );
}
