"use client";

import { Extension } from "@tiptap/core";
import { Markdown } from "@tiptap/markdown";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";
import Suggestion from "@tiptap/suggestion";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Note } from "@/lib/notes";
import { SCHEME, legacyToMarkdown } from "@/lib/wiki";

interface Item {
  id: string | null;
  title: string;
  create?: boolean;
}

interface Popup {
  items: Item[];
  index: number;
  rect: DOMRect | null;
  pick: (item: Item) => void;
}

const plain = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

interface WikiOptions {
  getNotes: () => Note[];
  selfId: string;
  onCreate: (title: string) => string;
  onPopup: (p: Popup | null) => void;
}

/** Typing "[[" opens a list of notes; picking one inserts a link to it (or creates the note). */
const WikiSuggest = Extension.create<WikiOptions>({
  name: "wikiSuggest",
  addOptions() {
    return { getNotes: () => [], selfId: "", onCreate: () => "", onPopup: () => undefined };
  },
  addProseMirrorPlugins() {
    const opts = this.options;
    let index = 0;
    let current: { items: Item[]; command: (i: Item) => void; rect: (() => DOMRect | null) | null } | null = null;
    const publish = () =>
      current &&
      opts.onPopup({ items: current.items, index, rect: current.rect?.() ?? null, pick: current.command });

    return [
      Suggestion<Item>({
        editor: this.editor,
        char: "[[",
        allowSpaces: true,
        allowedPrefixes: null,
        items: ({ query }) => {
          const q = plain(query);
          const list: Item[] = opts
            .getNotes()
            .filter((n) => n.kind !== "node" && n.id !== opts.selfId && n.title.trim())
            .filter((n) => !q || plain(n.title).includes(q))
            .slice(0, 6)
            .map((n) => ({ id: n.id, title: n.title.trim() }));
          const exact = list.some((n) => plain(n.title) === q);
          if (query.trim() && !exact) list.push({ id: null, title: query.trim(), create: true });
          return list;
        },
        command: ({ editor, range, props }) => {
          const id = props.id ?? opts.onCreate(props.title);
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              { type: "text", text: props.title, marks: [{ type: "link", attrs: { href: `${SCHEME}${id}` } }] },
              { type: "text", text: " " },
            ])
            .run();
        },
        render: () => ({
          onStart: (p) => {
            index = 0;
            current = { items: p.items, command: p.command, rect: p.clientRect ?? null };
            publish();
          },
          onUpdate: (p) => {
            index = Math.min(index, Math.max(0, p.items.length - 1));
            current = { items: p.items, command: p.command, rect: p.clientRect ?? null };
            publish();
          },
          onKeyDown: ({ event }) => {
            if (!current || current.items.length === 0) return false;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              const n = current.items.length;
              index = (index + (event.key === "ArrowDown" ? 1 : n - 1)) % n;
              publish();
              return true;
            }
            if (event.key === "Enter" || event.key === "Tab") {
              current.command(current.items[index]);
              return true;
            }
            return false;
          },
          onExit: () => {
            current = null;
            opts.onPopup(null);
          },
        }),
      }),
    ];
  },
});

interface Props {
  note: Note;
  notes: Note[];
  onChange: (text: string) => void;
  onOpenNote: (id: string) => void;
  onCreateNote: (title: string) => string;
}

export default function DocEditor({ note, notes, onChange, onOpenNote, onCreateNote }: Props) {
  const [popup, setPopup] = useState<Popup | null>(null);
  const notesRef = useRef(notes);
  const emitted = useRef(note.text);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<(() => string) | null>(null);
  const cb = useRef({ onChange, onOpenNote, onCreateNote });

  useEffect(() => {
    notesRef.current = notes;
    cb.current = { onChange, onOpenNote, onCreateNote };
  });

  const emit = () => {
    if (!latest.current) return;
    const md = latest.current().trim();
    emitted.current = md;
    cb.current.onChange(md);
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          autolink: false,
          isAllowedUri: (url, ctx) => url.startsWith(SCHEME) || ctx.defaultValidate(url),
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Escribe tus apuntes… usa [[ para enlazar otra nota" }),
      Markdown,
      WikiSuggest.configure({
        getNotes: () => notesRef.current,
        selfId: note.id,
        onCreate: (title) => cb.current.onCreateNote(title),
        onPopup: setPopup,
      }),
    ],
    content: legacyToMarkdown(note.text),
    contentType: "markdown",
    editorProps: {
      attributes: { class: "doc-prose", "aria-label": "Contenido de la nota" },
      handleClick: (_view, _pos, event) => {
        const href = (event.target as HTMLElement).closest("a")?.getAttribute("href");
        if (href?.startsWith(SCHEME)) {
          event.preventDefault();
          cb.current.onOpenNote(href.slice(SCHEME.length));
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      latest.current = () => ed.getMarkdown();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(emit, 300);
    },
  });

  // Save what is pending when the editor goes away (switching notes, closing the panel).
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        emit();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // If the text changed from outside (an AI action), show it.
  useEffect(() => {
    if (!editor || note.text === emitted.current) return;
    emitted.current = note.text;
    editor.commands.setContent(legacyToMarkdown(note.text), { contentType: "markdown", emitUpdate: false });
  }, [note.text, editor]);

  if (!editor) return <div className="doc-loading mono">cargando editor…</div>;

  const btn = (label: string, title: string, active: boolean, run: () => void) => (
    <button type="button" className="tag" aria-pressed={active} title={title} onMouseDown={(e) => e.preventDefault()} onClick={run}>
      {label}
    </button>
  );

  return (
    <div className="doc-editor">
      <div className="doc-toolbar" role="toolbar" aria-label="Formato">
        {btn("B", "Negrita", editor.isActive("bold"), () => editor.chain().focus().toggleBold().run())}
        {btn("I", "Cursiva", editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run())}
        {btn("H1", "Título", editor.isActive("heading", { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run())}
        {btn("H2", "Subtítulo", editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
        {btn("• Lista", "Lista", editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run())}
        {btn("☐ Tareas", "Lista de tareas", editor.isActive("taskList"), () => editor.chain().focus().toggleTaskList().run())}
        {btn("❝", "Cita", editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run())}
        {btn("[[ ]] Enlazar", "Enlazar con otra nota", false, () => editor.chain().focus().insertContent("[[").run())}
      </div>
      <EditorContent editor={editor} className="doc-content" />
      {popup && popup.rect && createPortal(
        <ul className="wiki-pop" role="listbox" style={{ left: popup.rect.left, top: popup.rect.bottom + 6 }}>
          {popup.items.map((it, i) => (
            <li key={it.id ?? `new-${it.title}`}>
              <button
                role="option"
                aria-selected={i === popup.index}
                data-active={i === popup.index}
                onMouseDown={(e) => {
                  e.preventDefault();
                  popup.pick(it);
                }}
              >
                {it.create ? <>Crear nota «{it.title}»</> : it.title}
              </button>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}
