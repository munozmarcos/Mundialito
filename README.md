# Mundialito

Prode del Mundial 2026 para jugar entre amigos: login por mail, predicciones, bloqueo 1 hora antes, ranking, admin, recordatorios y chat IA.

## Stack

- Next.js + TypeScript
- Supabase Auth/Postgres/RLS
- Tailwind
- OpenAI API
- Resend para emails
- Gmail SMTP opcional para emails
- Adapter mock para WhatsApp
- WorldCupAPI para sincronizar resultados automaticamente

## Arranque local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Despues abri `http://localhost:3000`.

## Supabase

1. Crear proyecto en Supabase.
2. Copiar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`.
3. Ejecutar `supabase/schema.sql` en SQL Editor.
4. Opcional: ejecutar `supabase/seed.sql` para tener partidos de prueba.

## Variables

`CRON_SECRET` protege:

- `POST /api/jobs/send-reminders`
- `POST /api/jobs/lock-matches`
- `POST /api/jobs/sync-results`

Usar header:

```text
Authorization: Bearer <CRON_SECRET>
```

## Envio con Gmail

Para enviar mails reales desde Gmail:

1. Activar verificacion en 2 pasos en la cuenta.
2. Crear una contraseña de aplicacion de Google.
3. Crear `.env.local`:

```env
EMAIL_PROVIDER=gmail
GMAIL_USER=gmunozmarcos@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
FROM_EMAIL="Mundialito <gmunozmarcos@gmail.com>"
```

No uses tu contraseña normal de Gmail.

## Scoring implementado

El Excel `Prode Qatar 2022.xlsx` se usa solo como referencia de reglas.

Fase de grupos:

- Tendencia correcta: 1 punto.
- Resultado exacto: +1 punto.
- Maximo por partido de grupo: 2 puntos.

Ejemplos:

- Real 2-1, prediccion 1-0: 1 punto.
- Real 2-1, prediccion 2-1: 2 puntos.
- Real 0-0, prediccion 1-1: 1 punto.
- Real 0-0, prediccion 0-0: 2 puntos.

El motor deja preparadas reglas de eliminatorias, incluyendo empates con ponderacion especial segun el Excel.

## Fixture 2026

El archivo `data/worldcup-2026-fixture.sample.csv` es solo muestra. El fixture real de 104 partidos debe importarse desde fuente actualizada/oficial y luego cargarse con:

```http
POST /api/admin/import-fixture
```

Payload:

```json
{
  "matches": [
    {
      "home_team": "Mexico",
      "away_team": "South Africa",
      "kickoff_at": "2026-06-11T16:00:00-05:00",
      "stadium": "Estadio Azteca",
      "stage": "GROUP",
      "group_name": "A"
    }
  ]
}
```

## Resultados automaticos

La app trae un job para que no cargues resultados a mano:

```http
POST /api/jobs/sync-results
Authorization: Bearer <CRON_SECRET>
```

Proveedor recomendado gratis: football-data.org, que lista Worldcup dentro del Free Tier. Variables:

```env
RESULTS_PROVIDER=football-data
FOOTBALL_DATA_API_KEY=tu_api_key
```

Fallback compatible:

```env
RESULTS_PROVIDER=worldcupapi
WORLD_CUP_API_KEY=tu_api_key
```

Cuando el job encuentra un partido terminado:

- lo marca como `final`,
- guarda goles reales,
- bloquea el partido,
- recalcula puntos.

## Tests

```bash
npm test
```

Los tests cubren scoring de grupos y bloqueo 1 hora antes.

## Rutas

- `/`
- `/login`
- `/dashboard`
- `/partidos`
- `/ranking`
- `/admin`
- `/admin/resultados`
- `/admin/importar`
- `/api/predictions`
- `/api/results`
- `/api/jobs/send-reminders`
- `/api/jobs/lock-matches`
- `/api/jobs/sync-results`
- `/api/chat`
- `/api/whatsapp/inbound`

## WhatsApp

`lib/whatsapp.ts` queda mockeado hasta conectar proveedor. Webhook:

```http
POST /api/whatsapp/inbound
```

Comandos preparados:

- `ranking`
- `pendientes`
- `$predigo Argentina vs Mexico 2-1`
- `ayuda`

Para envio real con UltraMsg:

1. Crear cuenta en `https://ultramsg.com`.
2. Crear una instancia.
3. Escanear QR hasta que la instancia quede autenticada.
4. Completar `.env.local`:

```env
WHATSAPP_PROVIDER=ultramsg
ULTRAMSG_INSTANCE_ID=instanceXXXX
ULTRAMSG_TOKEN=tu_token
WHATSAPP_WEBHOOK_SECRET=dev-whatsapp-secret
```

Prueba local:

- `/admin/whatsapp`
- `POST /api/test/send-whatsapp`
