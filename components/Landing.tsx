import Link from "next/link";
import FeatureMap from "./FeatureMap";
import LandingDrag from "./LandingDrag";

const SIGNUP = "/login?modo=registro";
// The m4pl3 maple leaf, exact path from the brand master (same die-cut sticker as the portfolio).
const LEAF =
  "M528.75 757.5L605 722.5L626.25 706.25C620.95 697.6 618.53 686.47 630 680L650 670L665 672.5L743.75 616.25L717.5 607.5L716.25 601.25L775.75 495L687.5 522.5L680 510L624.5 542.5L666.25 454.5L642.5 462.5L633.75 461.25L632.5 370L532.5 462.5L507.75 453.75L463.75 543.75L450 560L430 552.5Z";

const Handles = () => (
  <>
    <i className="lx-h tl" /><i className="lx-h tr" /><i className="lx-h bl" /><i className="lx-h br" />
  </>
);

const Arrow = () => (
  <svg className="lx-arrow" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Cursor = ({ label, tone, className }: { label: string; tone: "ink" | "rust"; className: string }) => (
  <span className={`lx-cursor ${className}`} data-tone={tone} aria-hidden="true">
    <svg viewBox="0 0 28 32" width="26" height="30"><path d="M3 2 L3 26 L9 20.5 L13 29.5 L17 27.7 L13 18.8 L21.5 18.8 Z" fill="currentColor" stroke="#fff" strokeWidth="2" strokeLinejoin="round" /></svg>
    <i>{label}</i>
  </span>
);

function Win({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`lx-win ${className}`} data-drag tabIndex={0} aria-label={`${title} (arrástrala)`}>
      <div className="lx-win-bar"><i /><i /><i /><span className="mono">{title}</span></div>
      <div className="lx-win-body">{children}</div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="landing">
      <LandingDrag />

      {/* la barra de la propia app */}
      <header className="lx-bar">
        <Link href="/inicio" className="lx-brand">
          <img src="/m4-symbol.svg" alt="" width={26} height={26} />
          Hoja
        </Link>
        <nav className="lx-tabs" aria-label="Secciones">
          <a href="#top" aria-current="page">Inicio</a>
          <a href="#funciones">Qué hace</a>
          <a href="#pasos">Cómo se usa</a>
          <a href="#paraquien">Para quién</a>
        </nav>
        <span className="lx-spacer" />
        <Link href="/login" className="lx-btn lx-line lx-sm">Entrar</Link>
        <Link href={SIGNUP} className="lx-btn lx-ink lx-sm">+ Crear cuenta</Link>
      </header>

      <main id="top">
        {/* ───────── hero: la app, puesta en escena ───────── */}
        <section className="lx-hero lx-canvas">
          <div className="lx-selbox lx-hero-main">
            <Handles />
            <div className="lx-win lx-main">
              <div className="lx-win-bar"><i /><i /><i /><span className="mono">Bienvenida a Hoja</span></div>
              <div className="lx-win-body">
                <p className="mono lx-eyebrow">notas sobre un lienzo</p>
                <h1>
                  Tus apuntes, sobre un <span className="lx-underline">lienzo sin bordes</span>.
                </h1>
                <p className="lx-lead">Escribe, habla y conecta tus ideas. Después estúdialas, agéndalas o conviértelas en un mapa. Para estudiantes, equipos y emprendedores.</p>
                <div className="lx-actions">
                  <Link href={SIGNUP} className="lx-btn lx-ink">Crear mi cuenta <Arrow /></Link>
                  <a href="#funciones" className="lx-btn lx-line">Ver qué hace</a>
                </div>
              </div>
            </div>
          </div>

          <Win title="Fotosíntesis" className="lx-w-b">
            <b>Fotosíntesis</b>
            <p>Convierte luz en energía. Ver <span className="lx-pill">Cloroplastos</span></p>
          </Win>
          <Win title="Cloroplastos" className="lx-w-c">
            <b>Cloroplastos</b>
            <p><span className="lx-tag">↩ 1</span> Donde ocurre todo.</p>
          </Win>
          <svg className="lx-link" viewBox="0 0 120 150" aria-hidden="true">
            <path className="lx-link-path" d="M15 6 C 5 80, 100 50, 96 134" fill="none" stroke="#8c2f1e" strokeWidth="3" strokeDasharray="8 7" strokeLinecap="round" />
            <path d="M96 146 l-9 -16 l18 0 z" fill="#8c2f1e" />
          </svg>
          <Win title="Reunión" className="lx-w-d">
            <span className="lx-rec">● Detener · 0:07</span>
            <p className="lx-task"><i /> Enviar propuesta <span className="lx-pill">vie 30</span></p>
          </Win>
          <Win title="Gastos" className="lx-w-e">
            <table className="lx-table">
              <tbody>
                <tr><td>Renta</td><td>$8,500.00</td></tr>
                <tr><td>Súper</td><td>$1,240.50</td></tr>
              </tbody>
              <tfoot><tr><td>Total</td><td>$9,740.50</td></tr></tfoot>
            </table>
          </Win>

          <span className="lx-sticker lx-butter lx-s1" data-drag tabIndex={0}>datos de ejemplo</span>
          <span className="lx-sticker lx-mint lx-s2" data-drag tabIndex={0}>¡arrástrame!</span>
          <p className="lx-avail">
            <svg className="lx-leaf" viewBox="385 325 435 485" aria-hidden="true">
              <path d={LEAF} fill="none" stroke="#17140F" strokeWidth="82" strokeLinejoin="round" />
              <path d={LEAF} fill="none" stroke="#FFFFFF" strokeWidth="40" strokeLinejoin="round" />
              <path d={LEAF} fill="#8C2F1E" />
            </svg>
            Hecha en Puebla por m4pl3
          </p>
          <Cursor label="tú" tone="ink" className="lx-c1" />
          <Cursor label="IA ✦" tone="rust" className="lx-c2" />
        </section>

        {/* ───────── qué hace: el producto como mapa mental ───────── */}
        <section className="lx-wrap lx-sec" id="funciones">
          <div className="lx-label"><span className="lx-selsm">qué hace<Handles /></span></div>
          <h2 className="lx-title">Un mapa de todo lo que <span className="lx-accent">puedes hacer</span>.</h2>
          <FeatureMap />
        </section>

        {/* ───────── cómo se usa ───────── */}
        <section className="lx-wrap lx-sec" id="pasos">
          <div className="lx-label"><span className="lx-selsm">cómo se usa<Handles /></span></div>
          <h2 className="lx-title">Tres pasos, <span className="lx-accent">una flecha</span> entre cada uno.</h2>
          <div className="lx-steps">
            <div className="lx-step"><span className="lx-num">1</span><div className="lx-win"><div className="lx-win-bar"><i /><i /><i /><span className="mono">escribe o habla</span></div><div className="lx-win-body"><h3>Escribe o habla</h3><p>Una nota, un dictado o una reunión completa. Hoja lo pasa a texto.</p></div></div></div>
            <svg className="lx-step-arrow" viewBox="0 0 120 40" aria-hidden="true"><path d="M2 20 C 40 4, 80 36, 110 20" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="8 7" strokeLinecap="round" /><path d="M116 20 l-16 -9 l0 18 z" fill="var(--accent)" /></svg>
            <div className="lx-step"><span className="lx-num">2</span><div className="lx-win"><div className="lx-win-bar"><i /><i /><i /><span className="mono">conecta</span></div><div className="lx-win-body"><h3>Conecta y ordena</h3><p>Enlaza con [[ ]], separa por libretas y acomoda el lienzo con un botón.</p></div></div></div>
            <svg className="lx-step-arrow" viewBox="0 0 120 40" aria-hidden="true"><path d="M2 20 C 40 36, 80 4, 110 20" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="8 7" strokeLinecap="round" /><path d="M116 20 l-16 -9 l0 18 z" fill="var(--accent)" /></svg>
            <div className="lx-step"><span className="lx-num">3</span><div className="lx-win"><div className="lx-win-bar"><i /><i /><i /><span className="mono">estudia y planea</span></div><div className="lx-win-body"><h3>Estudia y planea</h3><p>Tarjetas de repaso, guías de examen y pendientes con fecha en el calendario.</p></div></div></div>
          </div>
        </section>

        {/* ───────── para quién: notas adhesivas ───────── */}
        <section className="lx-wrap lx-sec" id="paraquien">
          <div className="lx-label"><span className="lx-selsm">para quién<Handles /></span></div>
          <h2 className="lx-title">Hecha para <span className="lx-accent">tres maneras</span> de trabajar.</h2>
          <div className="lx-notes">
            <article className="lx-sticky lx-mint" style={{ "--rot": "-2deg" } as React.CSSProperties}>
              <h3 className="hand">estudiantes</h3>
              <p>Apuntes conectados, mapas mentales y tarjetas. Una libreta por materia y una guía para el examen.</p>
            </article>
            <article className="lx-sticky lx-butter" style={{ "--rot": "1.5deg" } as React.CSSProperties}>
              <h3 className="hand">equipos</h3>
              <p>Graba la reunión y sal con resumen, decisiones y pendientes con fecha, directo al calendario.</p>
            </article>
            <article className="lx-sticky lx-white" style={{ "--rot": "-1deg" } as React.CSSProperties}>
              <h3 className="hand">emprendedores</h3>
              <p>Gastos y clientes en tablas con totales, y tu idea en un lienzo: Lean Canvas, validar una idea, pitch.</p>
            </article>
          </div>
        </section>

        {/* ───────── cierre: tu primera nota ───────── */}
        <section className="lx-wrap lx-close lx-canvas">
          <p className="hand lx-close-hand">el resto se acomoda solo</p>
          <div className="lx-selbox lx-close-box">
            <Handles />
            <div className="lx-win">
              <div className="lx-win-bar"><i /><i /><i /><span className="mono">Tu primera nota</span></div>
              <div className="lx-win-body">
                <h2>Empieza con una nota<span className="lx-caret" aria-hidden="true" /></h2>
                <p>Crea tu cuenta y escribe la primera. También se instala en tu celular como una app.</p>
                <div className="lx-actions">
                  <Link href={SIGNUP} className="lx-btn lx-ink">Crear mi cuenta <Arrow /></Link>
                  <Link href="/login" className="lx-btn lx-line">Ya tengo cuenta</Link>
                </div>
              </div>
            </div>
          </div>
          <p className="lx-small mono">Hoja · un producto de <a href="https://m4pl3.xyz">m4pl3</a> · <a href="https://www.instagram.com/m4pl3.studio/">@m4pl3.studio</a></p>
        </section>
      </main>
    </div>
  );
}
