# Especificación — casamarta

## Objetivo

Ayudar a Marta a organizar con sus padres la venta de la casa de Majadahonda y la compra de la nueva vivienda.

## Usuarios y uso

- Los miembros autorizados (propietario y colaboradores) comparten los mismos datos.
- Publicada en https://torija69.github.io/casamarta/. En local se sirve con `python3 -m http.server 8080`.

## Funcionalidades

| Sección | Qué cubre |
|---|---|
| Inicio | Resumen de pisos, compradores, documentos, reformas, avisos, fechas y balance previsto |
| Pisos a comprar | Datos, €/m², contacto, visitas, valoración, fotos, mapa, comparador (hasta 3) y ficha PDF |
| Compradores | Visitas, resultado, ofertas y mejor oferta viva |
| Agencia | Contrato, comisión con IVA, exclusividad, vencimiento, preaviso y PDF |
| Notaría | Lista de documentos de venta y compra, caducidades, adjuntos y PDF «Día de la firma» |
| Impuestos | Plusvalía municipal (métodos objetivo y real), IRPF con exención para mayores de 65, ITP o IVA + AJD |
| Suministros | Contratos de las dos viviendas, totales, cambios de titular y lista de mudanza |
| Reformas | Tablero por estado, presupuestos, fotos de antes y después, y calendario |
| Agenda | Todas las fechas, con exportación `.ics` |
| Ajustes | Datos de la operación, accesos, parámetros fiscales y copia de seguridad |

## Fuera de alcance

- Asesoría fiscal: los cálculos son orientativos.
- Alta de cuentas desde la web: se hacen en Supabase (Authentication → Users → Add user).

## Datos

- Supabase (proyecto `casamarta`, región eu-west-1). PostgreSQL con RLS en todas las tablas y acceso limitado a `usuarios_permitidos`, controlado por un trigger en `auth.users`.
- Storage privado (`fotos-pisos`, `reformas-fotos` y `documentos`) con URLs firmadas temporales.
- Las migraciones están en `supabase/migrations/` (001 a 007).
- Hay datos personales y económicos de la familia. El repositorio es público, pero el código no contiene datos: están en Supabase. Hay que revisar si conviene hacerlo privado.

## Arquitectura

- HTML, CSS y JS (módulos ES) sin compilación, organizado en `js/views/` (una vista por sección).
- Despliegue con GitHub Pages (`.github/workflows/pages.yml`).
- `js/config.js` contiene solo la clave publicable. La `service_role` no se sube nunca.

## Criterios de aceptación

- Un email no autorizado no puede crear cuenta ni ver datos.
- Los archivos subidos solo se ven con sesión de un miembro.
- La agenda exporta un `.ics` que abre Calendario.
