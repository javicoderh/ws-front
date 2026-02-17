# Workshopia Backend + UX Contract (Frontend First)

Este documento es la referencia principal para el equipo frontend.

Objetivo: implementar la UI respetando el flujo UX acordado y consumiendo los contratos actuales del backend sin ambiguedades.

## 1) Resumen del producto

Workshopia permite crear workshops guiados con un helper, generar entregables PDF y enviarlos por email.

Reglas de negocio clave:
- Iniciar helper cuesta 1 workshop token.
- Si el usuario no tiene tokens, no puede iniciar.
- La creacion final entra a un semaforo de procesamiento (max paralelos configurable).
- El workshop queda registrado en historial y en la tabla de workshops del usuario.

## 2) Estado actual del sistema

- Auth: Firebase Identity Toolkit (`idToken`).
- Persistencia: Firestore (fuente de verdad) + cache en memoria para runtime.
- LLM: OpenAI/Gemini/Ollama segun configuracion.
- Render PDF: renderer externo (`renderer/`).
- Email: SMTP (Gmail app password compatible).

## 3) Modelo UX oficial (frontend)

### 3.1 Flujo top-level

1. Usuario autenticado entra al dashboard.
2. Ve su saldo de workshop tokens.
3. Si no tiene tokens: va al flujo de compra.
4. Si tiene tokens: inicia helper.
5. Helper recolecta datos step-by-step y valida.
6. Step final: usuario elige generar workshop.
7. Se crea job con estado `queued` o `running`.
8. Front hace polling de estado job/helper.
9. Al terminar: estado `completed` o `failed`.
10. Usuario ve workshop en historial y en su listado.

### 3.2 UX de helper (importante)

- Todo request del helper requiere `idToken`.
- Ownership estricto: solo el duenio de la sesion puede leer/editar/finalizar.
- El helper tiene estados reales:
  - `in_progress`
  - `queued`
  - `running`
  - `completed`
  - `failed`
  - `escalated`

### 3.3 UX del semaforo

- Si no hay cupo paralelo, el job queda en cola.
- El frontend debe mostrar:
  - posicion en cola
  - estimacion de minutos
  - lista de trabajos por delante (nombre)

## 4) Contratos API para frontend

Base local: `http://127.0.0.1:3000`

Importante para frontend v1 local:
- Asumir backend en `http://127.0.0.1:3000`.
- `cargo run` levanta backend en puerto `3000` por defecto.
- Solo cambia si defines `PORT` (ejemplo: `PORT=3002 cargo run`).

### 4.1 Health

- `GET /health`

### 4.2 Auth

- `POST /auth/signup/email`
- `POST /auth/login/email`
- `POST /auth/login/google`
- `POST /auth/me`
- `POST /auth/password/change`
- `POST /auth/password/forgot`

El frontend debe guardar y refrescar `idToken` segun flujo Firebase.

### 4.3 Perfil usuario

- `POST /users/profile/upsert`
- `POST /users/profile/get`

`/users/profile/get` requiere body:
```json
{ "idToken": "..." }
```

### 4.4 Tokens

- `GET /users/workshop-tokens/pricing`
- `POST /users/workshop-tokens/topup` (legacy/manual)
- `POST /users/workshop-tokens/ledger`
- `POST /users/workshop-tokens/history`
- `POST /users/workshop-tokens/purchases/history`

### 4.5 Pagos (Mercado Pago)

- `GET /payments/token-packs`
- `POST /payments/checkout/start`
- `POST /payments/checkout/confirm`
- `POST /payments/webhook/mercadopago` (solo provider)

Flujo frontend recomendado:
1. `GET /payments/token-packs`
2. `POST /payments/checkout/start` con `{ idToken, packId }`
3. Redireccionar al `checkoutUrl` recibido.
4. Volver al app y consultar `POST /payments/checkout/confirm` con `{ idToken, paymentSessionId }`.

Acreditacion real de tokens ocurre por webhook firmado + validado.

### 4.6 Helper (nuevo contrato)

#### 4.6.0 Regla UX critica: quien define las preguntas

- Los textos de preguntas (`prompt`) y el schema (`fields`) los define el backend en cada step.
- Frontend no debe hardcodear textos ni asumir orden distinto al que devuelve la sesion.
- Frontend debe renderizar la UI desde:
  - `currentStepId`
  - `prompt`
  - `fields[]`
  - `feedback`
  - `suggestions`
- Si se cambia un prompt o field en backend, el front debe seguir funcionando sin cambios de codigo.

#### 4.6.0.b Orden canonico de steps del helper (actual)

1. `workshop_nombre`
2. `nivel_workshop`
3. `workshop_descripcion`
4. `objetivo_principal`
5. `objetivos_secundarios`
6. `numero_de_sesiones`
7. `duracion_sesion_minutos`
8. `descripcion_publico_objetivo`
9. `prerequisitos`
10. `oat_alignment.required`
11. `oat_alignment.levels`
12. `consideraciones_dua.required`
13. `consideraciones_dua`
14. `mandatory_activities`
15. `numero_de_evaluaciones_requeridas`
16. `instrumentos_de_evaluacion_requeridos`
17. `delivery_modes`
18. `brochure_brief.one_liner`
19. `brochure_brief.value_proposition`
20. `brochure_brief.format`
21. `brochure_brief.learning_outcomes_client`
22. `brochure_brief.cta.label`
23. `brochure_brief.cta.action`
24. `brochure_brief.cta.action_email_confirmed`
25. `brochure_brief.provider.name`
26. `brochure_brief.provider.contact.email`
27. `brochure_brief.provider.contact.email_confirmed`
28. `brochure_brief.provider.contact.phone`
29. `brochure_brief.provider.contact.instagram`
30. `brochure_brief.provider.contact.website`
31. `email_delivery.recipient_email`
32. `email_delivery.recipient_email_confirmed`
33. `email_delivery.subject`
34. `email_delivery.body`
35. `review` (accion final: editar o generar)

#### 4.6.0.c Step de instrumentos: UX exacta acordada

En el step `instrumentos_de_evaluacion_requeridos`, la UI debe guiar al usuario comun con preguntas secuenciales.

Flujo recomendado:
1. Preguntar si quiere definir instrumentos en modo `manual` o `automatico`.
2. Si `automatico`: pedir solo cantidad de instrumentos.
3. Si `manual`: por cada instrumento:
4. Preguntar tipo: `actividad_con_rubrica` o `instrumento_escrito`.
5. Si es `actividad_con_rubrica`: pedir descripcion de actividad.
6. Si es `instrumento_escrito`: pedir total de preguntas.
7. Pedir cuantas de alternativas.
8. Pedir cuantas de verdadero/falso.
9. Las abiertas se calculan por diferencia.
10. Preguntar si existen preguntas/contenidos imprescindibles.
11. Si responde si: capturarlas como lista.
12. Repetir hasta completar la cantidad de instrumentos.
13. Mostrar resumen final del step y permitir editar antes de continuar.

Regla:
- En modo automatico, se omiten imprescindibles (el LLM infiere).
- En modo manual, se respetan imprescindibles entregadas por usuario.

#### 4.6.1 Start helper

- `POST /workshop-helper/session/start`

Request:
```json
{
  "idToken": "...",
  "mode": "written",
  "userId": "optional_uid_for_cross_check"
}
```

Comportamiento:
- valida usuario por `idToken`
- valida saldo en Firestore
- descuenta 1 token en Firestore
- registra transaccion `-1` en historial tokens
- crea sesion helper

Errores esperables:
- `WORKSHOP_TOKENS_INSUFFICIENT`
- `USER_PROFILE_NOT_FOUND`
- `WORKSHOP_HELPER_FORBIDDEN`

#### 4.6.2 Obtener estado de sesion

- `GET /workshop-helper/session/{session_id}/state?idToken=...`

#### 4.6.3 Responder step

- `POST /workshop-helper/session/{session_id}/answer`

Request:
```json
{
  "idToken": "...",
  "stepId": "...",
  "answer": "... o estructura segun step"
}
```

#### 4.6.4 Editar step

- `POST /workshop-helper/session/{session_id}/edit-step`

Request:
```json
{
  "idToken": "...",
  "stepId": "..."
}
```

#### 4.6.5 Finalizar helper y generar workshop

- `POST /workshop-helper/session/{session_id}/finalize`

Request:
```json
{ "idToken": "..." }
```

Response incluye:
- `jobId`
- `queuePosition`
- `etaMinutes`
- `status` inicial del helper (`queued`)

#### 4.6.6 Metricas helper

- `GET /workshop-helper/session/{session_id}/metrics?idToken=...`

### 4.7 Jobs / semaforo

- `GET /workshops/jobs/{job_id}/status`
- `GET /workshops/queue/status`

El frontend debe usar polling cada 2-5s para estados de job.

### 4.8 Workshops del usuario

- `POST /users/workshops/upsert`
- `POST /users/workshops/list`
- `POST /users/workshops/history`

Notas:
- El backend ya upsertea automaticamente en `user_workshops` durante pipeline (`queued/running/done/failed`).
- `users/workshops/history` se basa en `workshop_jobs`.

## 5) Estados y transiciones (UI state machine)

### 5.1 Helper session

`in_progress -> queued -> running -> completed`

o

`in_progress -> queued -> running -> failed`

caso excepcional:

`in_progress -> escalated`

### 5.2 Workshop user record (`user_workshops.status`)

`queued -> running -> done|failed`

### 5.3 Job record (`workshop_jobs.status`)

`queued -> running -> done|failed|cancelled`

## 6) Confirmacion de email en helper (UX obligatoria)

En 3 etapas se envia mail test y se pide confirmacion explicita del usuario:
- CTA brochure
- contacto proveedor
- receptor de entregables

El frontend debe mostrar:
- opcion `Si, recibi el mail test`
- opcion `No, quiero corregir email`

Si elige corregir, vuelve al step de email.

## 7) Propuesta UI concreta (frontend)

### 7.1 Pantallas minimas

1. Auth
2. Dashboard (saldo tokens + crear workshop)
3. Compra tokens
4. Helper stepper
5. Revision final (editar o generar)
6. Estado de generacion (cola/progreso)
7. Historial de workshops
8. Detalle workshop

### 7.2 Polling recomendado

- Durante helper `in_progress`: no polling agresivo (solo requests por accion).
- Desde `finalize`: polling cada 3s en:
  - `GET /workshops/jobs/{job_id}/status`
  - opcional `GET /workshop-helper/session/{session_id}/state?idToken=...`

## 8) Errores y manejo frontend

Backend responde:
```json
{
  "code": "ERROR_CODE",
  "message": "mensaje"
}
```

Acciones recomendadas:
- `WORKSHOP_HELPER_FORBIDDEN`: cerrar sesion actual y refrescar auth.
- `WORKSHOP_TOKENS_INSUFFICIENT`: abrir paywall de tokens.
- `WORKSHOP_TOKENS_CONCURRENT_UPDATE`: reintentar start helper.
- `USER_PROFILE_NOT_FOUND`: forzar completar perfil.
- `WORKSHOP_HELPER_NOT_READY`: mantener usuario en helper.

## 9) Variables de entorno clave

### 9.1 Core

- `PORT`
- `LLM_PROVIDER`
- `OPENAI_API_KEY` / `GEMINI_API_KEY`
- `OPENAI_MODEL`
- `CATALOG_PATH`

### 9.2 Firestore / Auth

- `FIREBASE_WEB_API_KEY`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_JSON` o `FIREBASE_SERVICE_ACCOUNT_PATH`

### 9.3 Email

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER` (o `SMTP_USERNAME`)
- `SMTP_APP_PASSWORD` (o `SMTP_PASSWORD`)
- `SMTP_FROM` (o `EMAIL_FROM`)

### 9.4 Pagos Mercado Pago

- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_NOTIFICATION_URL`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `MERCADOPAGO_API_BASE` (opcional)

### 9.5 Semaforo

- `MAX_PARALLEL_WORKSHOPS` (default 14)
- `ETA_PER_WORKSHOP_MINUTES` (default 10)
- `WORKSHOP_ETA_SAFETY_FACTOR` (default 1.3)

## 10) Desarrollo local rapido

### Backend

```bash
cargo run
```

Por defecto quedara disponible en:

`http://127.0.0.1:3000`

### Renderer PDF

```bash
cd renderer
npm install
npx playwright install chromium
npm start
```

## 11) Checklist frontend antes de produccion

- Integrar `idToken` en todos los endpoints helper.
- Manejar refresh/expiracion de token.
- Implementar estado UX `queued/running/completed/failed`.
- Implementar pantalla de cola con ETA.
- Manejar errores por `code` (no por string libre).
- Probar compra de tokens y confirmacion por webhook.
- Probar escenarios de reinicio backend (recovery de jobs).

---

Si cambias contratos del helper/pagos/cola, actualiza este README en el mismo PR para mantener alineado frontend + backend + UX.
