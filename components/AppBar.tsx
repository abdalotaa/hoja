import Link from "next/link";
import { ViewTransition } from "react";

const TABS = [
  { id: "lienzo", href: "/", label: "Lienzo" },
  { id: "estudio", href: "/estudio", label: "Estudio" },
  { id: "calendario", href: "/calendario", label: "Calendario" },
] as const;

interface Props {
  current: (typeof TABS)[number]["id"];
  userEmail?: string;
  userName?: string;
  children?: React.ReactNode;
}

/** The top bar shared by every section. It stays put during navigation while the active tab glides. */
export default function AppBar({ current, userEmail, userName, children }: Props) {
  const at = TABS.findIndex((t) => t.id === current);
  return (
    <ViewTransition name="appbar" default="none" share="appbar">
      <header className="bar">
        <div className="brand">
          <img src="/m4-symbol.svg" alt="" width={26} height={26} />
          Hoja
        </div>
        <nav className="tabs" data-tour="tabs" aria-label="Secciones">
          {TABS.map((t, i) => (
            <Link
              key={t.id}
              href={t.href}
              aria-current={i === at ? "page" : undefined}
              // Moving to a section on the right slides the page in from the right, and back the other way.
              transitionTypes={i === at ? [] : [i > at ? "nav-forward" : "nav-back"]}
            >
              {i === at && (
                <ViewTransition name="tab-pill" default="none" share="pill">
                  <span className="tab-pill" aria-hidden="true" />
                </ViewTransition>
              )}
              <span className="tab-label">{t.label}</span>
            </Link>
          ))}
        </nav>
        <span className="spacer" />
        {children}
        {userEmail && (
          <form action="/auth/signout" method="post" className="who-form">
            <span className="who" title={userEmail}>
              {userName || userEmail}
            </span>
            <Link href="/cuenta" className="who-link">
              Mi cuenta
            </Link>
            <button className="btn line" type="submit">
              Salir
            </button>
          </form>
        )}
      </header>
    </ViewTransition>
  );
}
