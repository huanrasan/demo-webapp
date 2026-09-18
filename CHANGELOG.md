# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versionado según
[Semantic Versioning](https://semver.org/lang/es/).

## [0.1.0] - 2026-09-18

Primera versión: base técnica de la plataforma de reservas. Todavía no permite reservar; las capacidades de producto
llegan en cambios posteriores.

### Añadido

- Aplicación Next.js 16 con capas de dominio, servidor, interfaz y worker, verificadas de forma automática.
- Configuración validada al arrancar: la aplicación no se inicia con variables ausentes o inválidas y el error nunca
  muestra sus valores.
- Endpoint `/api/health` que comprueba la base de datos y registra el motivo cuando responde de forma degradada.
- Registro de actividad en JSON sin datos personales, con código de referencia para correlacionar errores.
- Cabeceras de seguridad y política de contenido con nonce por petición en todas las respuestas.
- Pantallas base en español (inicio, no encontrado, error) verificadas con WCAG 2.2 AA.
- Envío de email con Amazon SES, SMTP o memoria, seleccionable por configuración.
- Proceso de tareas programadas con pg-boss, señal de vida cada minuto y apagado ordenado.
- PostgreSQL 17 con Prisma 7, usuarios separados para migraciones y aplicación, y migración inicial.
- Imagen de contenedor única para la aplicación, el worker y las migraciones, que corre sin privilegios de root.
- Integración continua con calidad, integración, extremo a extremo, contenedor y análisis de seguridad.

### Seguridad

- Dependencias con versiones corregidas para CVE-2026-4800 (lodash), GHSA-3f6p-5ww8-9rcr (mysql2) y
  CVE-2026-40345 (deepmerge-ts).
- La imagen no incluye npm, corepack ni yarn, y aplica los parches del sistema base.
- Escaneo de secretos en cada commit y en integración continua.

[0.1.0]: https://github.com/huanrasan/demo-webapp/releases/tag/v0.1.0
