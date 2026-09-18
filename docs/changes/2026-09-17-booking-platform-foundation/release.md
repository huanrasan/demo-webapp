# Release: base de la plataforma de reservas 0.1.0

| Field | Value |
|---|---|
| Version | 0.1.0 (primera versión; SemVer desde Conventional Commits) |
| Pipeline run | `.github/workflows/sdlc-release.yml`, disparado por el tag `v0.1.0` (se completa al publicar) |
| Artifacts and digests | `dist/booking-0.1.0-runner.oci.tar` (imagen de ejecución, ≈ 848 MB) y `dist/booking-0.1.0-migrator.oci.tar` (imagen de migraciones, ≈ 1,1 GB), más `booking-0.1.0.metadata.txt` con el id de cada imagen y el SHA-256 de cada archivo. Los digests definitivos los produce el pipeline; los locales de la construcción de validación quedan en la salida de `scripts/build-release` |
| SBOM location | `dist/sbom.cdx.json` en la release y `sdlc-evidence/sbom.json` como artefacto del run; CycloneDX generado con Syft sobre el archivo OCI de `runner` (4.044 componentes en la construcción de validación) |
| Signature / provenance | Atestación de procedencia SLSA y atestación de SBOM de `actions/attest-*`, y firma keyless de Sigstore por artefacto (`<archivo>.sigstore.json`). Verificación: `gh attestation verify dist/<archivo> --repo huanrasan/demo-webapp` y `cosign verify-blob dist/<archivo> --bundle dist/<archivo>.sigstore.json --certificate-identity-regexp 'https://github.com/huanrasan/demo-webapp/' --certificate-oidc-issuer https://token.actions.githubusercontent.com` |

## Alcance
Base técnica: aplicación, base de datos, seguridad, observabilidad básica y entrega continua. **No hay funcionalidad
de negocio**: todavía no se puede reservar. Ver `CHANGELOG.md`.

Fuera de esta release: la infraestructura AWS (ADR-0005) y su despliegue, que van en un registro de cambio propio.
Esta release solo produce y firma los artefactos.

## Rollout plan
- **Estrategia:** rolling update de ECS con circuit breaker y rollback automático (ADR-0005). Al no haber usuarios ni
  entorno productivo todavía, la 0.1.0 se despliega primero en el staging efímero que crea la IaC cuando exista.
- **Etapas:** (1) publicar artefactos firmados con el tag; (2) cargar la imagen en ECR desde el archivo OCI verificado;
  (3) ejecutar la tarea `migrator`; (4) desplegar `runner` como servicios `web` y `worker`; (5) observación de 24 h.
- **Señales de salud:** `GET /api/health` 200, healthcheck del ALB estable, 5xx del ALB < 1 %, p95 < 500 ms,
  `queue.heartbeat.age` < 5 min, tareas ECS en ejecución ≥ 1.
- **Umbral de rollback automático:** el circuit breaker de ECS revierte si el servicio no se estabiliza; alarma de 5xx
  > 1 % durante 5 min o healthcheck fallando 3 veces seguidas obliga a revertir manualmente.

## Success metrics
Esta versión no mueve métricas de producto (no hay reservas). Se mide la entrega:

| Métrica | Objetivo |
|---|---|
| Despliegue sin rollback | 1 de 1 |
| `GET /api/health` disponible tras el despliegue | 100 % de las comprobaciones en 24 h |
| Migración aplicada sin intervención | sí, con `migrate deploy` idempotente |
| Verificación de firma y procedencia por un tercero | `gh attestation verify` y `cosign verify-blob` en verde |

## Rollback
- **Disparador:** cualquiera de las señales de salud en rojo tras el despliegue, o fallo de la tarea de migración.
- **Procedimiento:** volver a la definición de tarea anterior en ECS (`aws ecs update-service --task-definition <previa>`);
  el despliegue anterior no existe todavía, así que para la 0.1.0 el rollback es eliminar el servicio y volver al estado
  sin desplegar. La migración inicial está vacía: no hay datos que revertir.
- **Probado:** el rollback de aplicación se probará en staging con la 0.2.0, cuando exista un despliegue previo al que
  volver. Para la 0.1.0 se verificó que `migrate deploy` es idempotente (se ejecuta dos veces en CI, AC-2).

## Communication
Repositorio de un solo mantenedor y sin usuarios: no hay aviso a clientes. La release publica notas generadas en
GitHub más el `CHANGELOG.md`. Cuando exista el negocio piloto, el plan de comunicación se define en `outcome.md`.

## Pendiente antes de desplegar a producción
1. Registro de cambio de infraestructura con la IaC de ADR-0005 y el presupuesto con alertas.
2. Salida del sandbox de SES y verificación de SPF, DKIM y DMARC (threat-model T-11).
3. Prueba de restauración de RDS (RTO ≤ 4 h) y medición de p95 con 20 usuarios concurrentes.
4. Revisión manual con lector de pantalla (ux.md).
5. Publicar las imágenes en un registro en lugar de archivos OCI en la release: 2 GB por versión es caro de subir y
   descargar; los archivos existen para poder firmarlos y verificarlos sin registro.
