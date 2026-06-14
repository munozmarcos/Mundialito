"use client";

import { AdminBackButton } from "@/components/admin-back-button";
import { Pencil, RefreshCw, Save, Trash2, X, UsersRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

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

function paymentSelectClass(value: boolean | string) {
  const paid = value === true || value === "PAID";
  const unpaid = value === false || value === "UNPAID";
  if (paid) return "field border-grass/35 bg-grass/10 font-black text-grass";
  if (unpaid) return "field border-red-400/35 bg-red-500/10 font-black text-red-200";
  return "field";
}

export default function ParticipantesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [form, setForm] = useState(initialForm);
  const [query, setQuery] = useState("");
  const [paidFilter, setPaidFilter] = useState("ALL");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const paidParticipants = profiles.filter((profile) => profile.paid).length;

  const filteredProfiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return profiles
      .filter((profile) => !normalizedQuery || profile.display_name.toLowerCase().includes(normalizedQuery) || (profile.phone ?? "").includes(normalizedQuery))
      .filter((profile) => paidFilter === "ALL" || (paidFilter === "PAID" ? profile.paid : !profile.paid));
  }, [paidFilter, profiles, query]);

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

    setMessage(editingId ? `Actualizado: ${data.profile.display_name}` : `Guardado: ${data.profile.display_name}. Ya puede entrar con apodo y contraseña.`);
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <UsersRound className="mt-1 h-6 w-6 text-grass" />
            <div>
              <h1 className="text-3xl font-black">Participantes</h1>
              <p className="mt-2 text-ink/70">Carga y edita apodo, WhatsApp, rol y estado de pago de cada jugador.</p>
              <p className="mt-1 text-sm font-bold text-grass">
                Alta manual: crea el participante con una contraseña inicial y pasale esos datos. No usa UltraMsg.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-start justify-end gap-3">
            <div className="grid min-h-[76px] min-w-[118px] content-center justify-items-center rounded-lg bg-field px-3 py-2 text-center">
              <UsersRound className="h-5 w-5 text-grass" />
              <strong className="mt-0.5 block text-xl">{paidParticipants}/{profiles.length}</strong>
              <span className="text-xs font-black uppercase text-ink/55">pagaron</span>
            </div>
            <AdminBackButton />
          </div>
        </div>
      </section>

      <section className="grid items-start gap-4 lg:grid-cols-[360px_1fr]">
        <form className="panel grid max-w-[360px] gap-4 p-5" onSubmit={submit}>
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
            Apodo
            <input
              className="field"
              required
              value={form.displayName}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              placeholder="Marcos"
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
            {editingId ? "Cambiar contraseña" : "Contraseña inicial"}
            <input
              className="field"
              minLength={6}
              required={!editingId}
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder={editingId ? "Dejar vacio para mantener" : "Se la pasas al participante"}
            />
            <span className="text-xs font-semibold text-ink/55">
              {editingId ? "Solo completala si queres cambiarla." : "Con esto entra por Ya tengo usuario, usando apodo y contraseña."}
            </span>
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Rol
            <select className="field" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              <option value="participant">Participante</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Estado de pago
            <select
              className={paymentSelectClass(form.paid)}
              value={form.paid ? "PAID" : "UNPAID"}
              onChange={(event) => setForm({ ...form, paid: event.target.value === "PAID" })}
            >
              <option value="PAID">Pago</option>
              <option value="UNPAID">Impago</option>
            </select>
          </label>
          <button className="btn w-fit" disabled={loading} type="submit">
            <Save className="h-4 w-4" />
            {editingId ? "Actualizar" : "Guardar"}
          </button>
          {message && <p className="text-sm font-semibold text-ink/70">{message}</p>}
        </form>

        <section className="panel overflow-hidden">
          <div className="grid max-w-4xl gap-3 border-b border-line p-4 lg:grid-cols-[minmax(260px,1fr)_150px_auto] lg:items-center">
            <input
              className="field"
              placeholder="Filtrar participante"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select className={paymentSelectClass(paidFilter)} value={paidFilter} onChange={(event) => setPaidFilter(event.target.value)}>
              <option value="ALL">Todos</option>
              <option value="PAID">Pagos</option>
              <option value="UNPAID">Impagos</option>
            </select>
            <button className="btn secondary min-h-10 px-3" disabled={loading} onClick={loadProfiles} type="button">
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </button>
          </div>
          {!filteredProfiles.length ? (
            <p className="p-5 text-sm text-ink/70">No hay participantes para ese filtro.</p>
          ) : (
            filteredProfiles.map((profile) => (
              <div className="grid gap-3 border-b border-line p-4 last:border-0 md:grid-cols-[1fr_1fr_auto_auto_auto] md:items-center" key={profile.id}>
                <div>
                  <strong>{profile.display_name}</strong>
                  <p className="text-sm text-ink/60">{profile.auth_email.endsWith("@mundialito.local") ? "Auth interno por WhatsApp" : profile.auth_email}</p>
                </div>
                <p className="text-sm text-ink/70">{profile.phone ?? "Sin WhatsApp"}</p>
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-black uppercase ${profile.paid ? "bg-mint text-grass" : "bg-red-500/15 text-red-200"}`}>
                  {profile.paid ? "Pago" : "Impago"}
                </span>
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
