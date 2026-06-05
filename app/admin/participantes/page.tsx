"use client";

import { Pencil, RefreshCw, Save, Trash2, X, UsersRound } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type Profile = {
  id: string;
  auth_email: string;
  display_name: string;
  phone: string | null;
  role: "admin" | "participant";
  paid: boolean;
};

const initialForm = {
  displayName: "",
  authEmail: "",
  phone: "",
  password: "",
  role: "participant",
  paid: false
};

export default function ParticipantesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadProfiles() {
    setLoading(true);
    setMessage("");

    const res = await fetch("/api/admin/participants", {
      cache: "no-store"
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "No se pudieron cargar los participantes.");
      return;
    }
    setProfiles(data.profiles ?? []);
  }

  useEffect(() => {
    loadProfiles();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const res = await fetch("/api/admin/participants", {
      method: editingId ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: editingId ?? undefined,
        displayName: form.displayName,
        authEmail: form.authEmail,
        phone: form.phone || null,
        password: form.password || undefined,
        role: form.role,
        paid: form.paid
      })
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(data.error ?? "No se pudo guardar.");
      return;
    }

    setMessage(editingId ? `Actualizado: ${data.profile.display_name}` : `Guardado: ${data.profile.display_name}`);
    setForm(initialForm);
    setEditingId(null);
    await loadProfiles();
  }

  function editProfile(profile: Profile) {
    setEditingId(profile.id);
    setMessage("");
    setForm({
      displayName: profile.display_name,
      authEmail: profile.auth_email,
      phone: profile.phone ?? "",
      password: "",
      role: profile.role,
      paid: Boolean(profile.paid)
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(initialForm);
    setMessage("");
  }

  async function deleteProfile(profile: Profile) {
    if (!window.confirm(`Eliminar a ${profile.display_name}? Se borran tambien sus apuestas.`)) return;
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/admin/participants", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: profile.id })
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "No se pudo eliminar.");
      return;
    }
    setMessage(`Eliminado: ${profile.display_name}`);
    if (editingId === profile.id) cancelEdit();
    await loadProfiles();
  }

  return (
    <div className="grid gap-6">
      <section className="panel p-6">
        <div className="flex items-start gap-3">
          <UsersRound className="mt-1 h-6 w-6 text-grass" />
          <div>
            <h1 className="text-3xl font-black">Participantes</h1>
            <p className="mt-2 text-ink/70">Carga y edita apodo, WhatsApp, rol y estado de pago de cada jugador.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <form className="panel grid gap-4 p-5" onSubmit={submit}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">{editingId ? "Editar participante" : "Nuevo participante"}</h2>
            {editingId && (
              <button className="btn secondary min-h-9 px-3" onClick={cancelEdit} type="button">
                <X className="h-4 w-4" />
                Cancelar
              </button>
            )}
          </div>
          <label className="grid gap-1 text-sm font-bold">
            Nombre
            <input
              className="field"
              required
              value={form.displayName}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              placeholder="Marcos"
            />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Auth interno opcional
            <input
              className="field"
              disabled={Boolean(editingId)}
              type="email"
              value={form.authEmail}
              onChange={(event) => setForm({ ...form, authEmail: event.target.value })}
              placeholder={editingId ? "El ID interno no se edita" : "Se genera solo con el WhatsApp"}
            />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            WhatsApp
            <input
              className="field"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              placeholder="WhatsApp con codigo de pais"
            />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Clave interna opcional
            <input
              className="field"
              minLength={6}
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder={editingId ? "Dejar vacío para mantener" : "No hace falta para entrar por WhatsApp"}
            />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Rol
            <select className="field" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              <option value="participant">Participante</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-line bg-field p-3 text-sm font-bold">
            <input
              checked={form.paid}
              type="checkbox"
              onChange={(event) => setForm({ ...form, paid: event.target.checked })}
            />
            Pago recibido
          </label>
          <button className="btn" disabled={loading} type="submit">
            <Save className="h-4 w-4" />
            {editingId ? "Actualizar" : "Guardar"}
          </button>
          {message && <p className="text-sm font-semibold text-ink/70">{message}</p>}
        </form>

        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-line p-4">
            <h2 className="text-xl font-black">Lista</h2>
            <button className="btn secondary" disabled={loading} onClick={loadProfiles} type="button">
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </button>
          </div>
          {!profiles.length ? (
            <p className="p-5 text-sm text-ink/70">Todavía no hay participantes cargados.</p>
          ) : (
            profiles.map((profile) => (
              <div className="grid gap-3 border-b border-line p-4 last:border-0 md:grid-cols-[1fr_1fr_auto_auto_auto_auto] md:items-center" key={profile.id}>
                <div>
                  <strong>{profile.display_name}</strong>
                  <p className="text-sm text-ink/60">{profile.auth_email.endsWith("@mundialito.local") ? "Auth interno por WhatsApp" : profile.auth_email}</p>
                </div>
                <p className="text-sm text-ink/70">{profile.phone ?? "Sin WhatsApp"}</p>
                <span className="badge w-fit">{profile.role === "admin" ? "Admin" : "Participante"}</span>
                <span className={`badge w-fit ${profile.paid ? "" : "bg-white text-ink/60"}`}>{profile.paid ? "Pago" : "Impago"}</span>
                <button className="btn secondary min-h-9 w-10 px-0" onClick={() => editProfile(profile)} title="Editar participante" type="button">
                  <Pencil className="h-4 w-4" />
                </button>
                <button className="btn secondary min-h-9 w-10 px-0" disabled={loading} onClick={() => deleteProfile(profile)} title="Eliminar participante" type="button">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </section>
      </section>
    </div>
  );
}
