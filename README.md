# Mundialito 2026

App web para jugar un prode del Mundial 2026 entre amigos, con WhatsApp como canal principal, ranking automatico, fixture completo, simulador, pagos y administracion.

Produccion: https://mundialito-mu.vercel.app

## Stack

- Next.js 14 + TypeScript
- Supabase Postgres/Auth-like session propia por WhatsApp
- Tailwind CSS
- UltraMsg para WhatsApp
- MercadoPago Checkout Pro
- Vercel deploy + cron jobs
- Football-data / proveedor de resultados para sincronizar fixture y marcadores

## Funcionalidad principal

- Alta/login por apodo + WhatsApp.
- Codigo de verificacion enviado por WhatsApp.
- Apodos unicos, sin repetidos.
- Participantes con rol `Admin` o `Participante`.
- Fixture de Mundial 2026 con 48 equipos y 104 partidos.
- Predicciones por partido desde la web.
- En eliminatorias, si hay empate, se elige ganador.
- Bloqueo automatico 15 minutos antes del inicio.
- Tablas de grupos y llaves proyectadas.
- Simulador para probar resultados y ver como avanza la llave.
- Ranking con puntos, exactos, tendencias y participantes.
- Pagos: entrada de $15.000 ARS, $10.000 al pozo y $5.000 al viaje misionero a Ecuador.
- Premios: 70% primer puesto, 20% segundo, 10% tercero.
- Creditos del proyecto.

## Scoring

Regla actual, simple para todo el torneo:

- Tendencia correcta: 1 punto.
- Resultado exacto: +2 puntos extra.
- Maximo por partido: 3 puntos.
- En eliminatorias cuenta el resultado de 120 minutos.
- Si el partido empatado necesita ganador, se carga ganador para avanzar la llave.

Ejemplos:

- Real 2-1, prediccion 1-0: 1 punto.
- Real 2-1, prediccion 2-1: 3 puntos.
- Real 0-0, prediccion 1-1: 1 punto.
- Real 0-0, prediccion 0-0: 3 puntos.

## WhatsApp

Webhook:

```http
POST /api/whatsapp/inbound
```

Comandos:

- `$comandos`
- `$ranking`
- `$reglas`
- `$partidos`
- `$resultados`
- `$pendientes`
- `$pronosticos`

Jobs por WhatsApp:

- Recordatorios 4 horas antes.
- Bloqueo/notificacion 15 minutos antes.
- Aviso de inicio de partido.
- Aviso de resultado final.
- Ranking diario a las 23:00 Argentina durante el Mundial.
- Broadcast manual desde Admin.

## Pagos

El pago automatico funciona con MercadoPago Checkout Pro:

1. El usuario debe estar logueado.
2. Toca `Pagar` en Ranking.
3. La app crea una preferencia con `external_reference` igual al intento de pago.
4. MercadoPago llama al webhook:

```http
POST /api/payments/mercadopago/webhook
```

5. Si el pago queda `approved`, se marca `profiles.paid = true`.
6. El pozo y premios se recalculan automaticamente desde los participantes pagos.

Si alguien paga por alias o por un link externo sin estar logueado, no hay forma confiable de asociarlo automaticamente al apodo. Ese caso queda para control manual del admin en `/admin/participantes`.

## Admin

Rutas principales:

- `/admin`
- `/admin/participantes`
- `/admin/resultados`
- `/admin/whatsapp`
- `/admin/importar`

Acciones manuales:

- Actualizar partidos.
- Actualizar resultados.
- Enviar recordatorios.
- Bloquear partidos.
- Avisar inicio.
- Enviar ranking por WhatsApp.
- Broadcast de WhatsApp.
- Editar participantes, rol y pago.
- Editar resultados y apuestas.

## Variables de entorno

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_SESSION_SECRET=
APP_URL=https://mundialito-mu.vercel.app
CRON_SECRET=

WHATSAPP_PROVIDER=ultramsg
ULTRAMSG_INSTANCE_ID=
ULTRAMSG_TOKEN=
ULTRAMSG_GROUP_ID=
WHATSAPP_GROUP_INVITE_URL=
WHATSAPP_WEBHOOK_SECRET=

MERCADOPAGO_ACCESS_TOKEN=

RESULTS_PROVIDER=football-data
FOOTBALL_DATA_API_KEY=
LIVE_RESULTS_PROVIDER=api-football
API_FOOTBALL_KEY=
```

No exponer `SUPABASE_SERVICE_ROLE_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, `ULTRAMSG_TOKEN` ni `CRON_SECRET` en frontend.

`RESULTS_PROVIDER` puede seguir en `football-data` para fixtures. Si `LIVE_RESULTS_PROVIDER=api-football`, los resultados en vivo se leen desde API-FOOTBALL/API-Sports sin cambiar el importador de partidos.

## Desarrollo local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abrir:

```text
http://localhost:3000
```

Tests:

```bash
npm test
```

Build:

```bash
npm run build
```

## Supabase

Archivos:

- `supabase/schema.sql`
- `supabase/migrations/*`
- `supabase/seed.sql`

Tablas principales:

- `profiles`
- `matches`
- `predictions`
- `notification_logs`
- `payment_attempts`

Funciones:

- `ranking()`
- `pending_predictions_for_user()`

## Deploy

Deploy productivo en Vercel:

```bash
vercel deploy --prod
```

Cron configurado en `vercel.json`:

- `/api/jobs/send-daily-ranking`

Otros jobs se ejecutan manualmente desde Admin o se pueden automatizar con Vercel/Cron externo usando `CRON_SECRET`.
