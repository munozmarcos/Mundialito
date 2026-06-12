-- Corrige la ventana tecnica generada el 2026-06-11 18:00 ARG.
-- Esa hora venia de procesos de actualizacion, no de una edicion real del usuario.
update public.predictions
set user_updated_at = created_at
where user_updated_at >= timestamptz '2026-06-11 21:00:00+00'
  and user_updated_at < timestamptz '2026-06-11 21:01:00+00';
