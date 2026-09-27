# CasaMarta

Web para que Marta ayude a sus padres a organizar **la venta de su casa (Majadahonda)** y **la compra de su nueva vivienda**, donde vivirán ellos.

**Web:** https://torija69.github.io/casamarta/

## Qué incluye

| Sección | Para qué sirve |
|---|---|
| Inicio | Resumen: pisos, compradores, documentos, reformas, avisos, próximas fechas y balance previsto |
| Pisos a comprar | Dirección, precio, €/m², contacto, fechas de visita, valoración, fotos de las visitas, mapa, comparador (hasta 3) y ficha PDF |
| Compradores | Visitas a la casa de los padres, resultado, ofertas y mejor oferta viva |
| Agencia | Contrato, comisión (con IVA), exclusividad, vencimiento, preaviso y PDF del contrato |
| Notaría | Checklist de documentos de venta y de compra, caducidades, adjuntos y PDF «Día de la firma» |
| Impuestos | Plusvalía municipal de Majadahonda (método objetivo y real), IRPF con exención para mayores de 65 años, ITP / IVA + AJD de la compra y checklist fiscal |
| Suministros | Contratos de la casa actual y de la nueva, totales mensuales, cambios de titular y checklist de mudanza |
| Reformas | Tablero por estado, presupuestos (elegir uno), fotos antes/después, totales y calendario de obras |
| Agenda | Todas las fechas juntas y exportación a calendario (.ics) |
| Ajustes | Datos de la operación, personas con acceso, parámetros fiscales y copia de seguridad |

> Los cálculos fiscales son **orientativos**. Consulta siempre con un asesor fiscal.

## Arquitectura

- **Frontend:** HTML + CSS + JavaScript (módulos ES) sin compilación. Publicado con GitHub Pages (`.github/workflows/pages.yml`).
- **Backend:** Supabase (proyecto `casamarta`, región eu-west-1).
  - Auth con email y contraseña.
  - PostgreSQL con **RLS** en todas las tablas: solo los miembros autorizados leen y escriben.
  - Storage privado: `fotos-pisos`, `reformas-fotos` (imágenes, 15 MB) y `documentos` (25 MB). Los archivos se sirven con URLs firmadas temporales.
- **Control de acceso:** solo pueden crear cuenta los emails de la tabla `usuarios_permitidos` (lo comprueba un trigger en `auth.users`). Todos los miembros comparten los mismos datos.

La clave de `js/config.js` es la *publishable key* de Supabase: está pensada para el navegador y no da acceso a nada sin sesión de un miembro. **Nunca subas la `service_role` key.**

## Dar acceso a Marta

1. Entra en la web con la cuenta de propietario → **Ajustes** → **Personas con acceso** → **Dar acceso**.
2. Escribe el email de Marta (rol *colaborador* o *propietario*).
3. En el panel de Supabase: **Authentication → Users → Add user → Create new user** con ese mismo email, una contraseña inicial y *Auto Confirm User* marcado.
4. Pásale la contraseña a Marta; podrá cambiarla en **Ajustes**.

La pantalla de login no permite crear cuentas: las altas solo se hacen desde el panel de Supabase.

## Configuración en el panel de Supabase

- **Authentication → URL Configuration:** Site URL = `https://torija69.github.io/casamarta/` y añade la misma URL en *Redirect URLs*.
- **Authentication → Sign In / Providers:** desactiva *Allow new users to sign up* (las cuentas se crean desde *Users → Add user*). Además, el trigger de `usuarios_permitidos` rechaza cualquier email no autorizado.

## Base de datos

Las migraciones están en `supabase/migrations/` (001 a 007): acceso y miembros, tablas del dominio, storage, datos iniciales (19 documentos de notaría, tareas fiscales y de mudanza, parámetros fiscales con sus fuentes) y ajustes de seguridad.

## Desarrollo local

```bash
python3 -m http.server 8080
# abre http://localhost:8080
```
