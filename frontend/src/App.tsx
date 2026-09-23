import { FormEvent, useEffect, useState } from "react";

type Health = { status: string; environment: string; ai_provider: string };
type Note = { id: number; title: string; body: string; created_at: string };

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail ?? "Request failed");
  }
  return response.json() as Promise<T>;
}

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("Residents need a faster way to understand permit status updates.");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<Health>("/api/health"), api<Note[]>("/api/notes")])
      .then(([nextHealth, nextNotes]) => {
        setHealth(nextHealth);
        setNotes(nextNotes);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  async function summarize(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ summary: string; provider: string }>("/api/ai/summarize", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setSummary(result.summary);
      const note = await api<Note>("/api/notes", {
        method: "POST",
        body: JSON.stringify({ title: "AI result", body: result.summary }),
      });
      setNotes((current) => [note, ...current]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unexpected error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header>
        <p className="eyebrow">Solo GovTech AI starter</p>
        <h1>Turn a public-service problem into a testable demo.</h1>
        <p className="lede">
          The stack works offline in mock mode, then switches to a real model when credentials arrive.
        </p>
        <span className={health?.status === "ok" ? "status ready" : "status"}>
          {health ? `API ${health.status} · AI ${health.ai_provider}` : "Connecting to API…"}
        </span>
      </header>

      <section className="panel">
        <div>
          <p className="step">01 · AI slice</p>
          <h2>Summarize a service need</h2>
          <p>Replace this demo interaction with the hackathon’s main user outcome.</p>
        </div>
        <form onSubmit={summarize}>
          <label htmlFor="source">Source text</label>
          <textarea id="source" value={text} onChange={(event) => setText(event.target.value)} />
          <button disabled={busy || text.trim().length === 0}>{busy ? "Working…" : "Create summary"}</button>
        </form>
        {error && <p className="error">{error}</p>}
        {summary && <output>{summary}</output>}
      </section>

      <section className="panel history">
        <div>
          <p className="step">02 · Persistence</p>
          <h2>Recent results</h2>
        </div>
        {notes.length === 0 ? (
          <p>No saved results yet.</p>
        ) : (
          <ul>
            {notes.map((note) => (
              <li key={note.id}>
                <strong>{note.title}</strong>
                <span>{note.body}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
