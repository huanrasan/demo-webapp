---
id: MEM-2026-09-18-los-commits-van-firmados-lo-exige-el-gate-de-aprobaciones
type: convention
title: "Los commits van firmados: lo exige el gate de aprobaciones"
tags: harness, approvals, ssh, firma
source: .harness/roster.toml separation_of_duties; ADR-0014 del arnes
created: 2026-09-18
review_by: 2027-03-17
status: active
superseded_by:
---
Con `separation_of_duties = false` en `.harness/roster.toml` — un solo mantenedor, que no puede aprobarse a sí
mismo en GitHub — el arnés 0.7.0 sustituye la revisión de plataforma por la firma del commit: `sdlc approvals
verify` exige que el recibo llegue en un commit **con firma que GitHub verifique y que corresponda al aprobador**
(ADR-0014). Un commit sin firmar deja el gate en rojo, y con `enforce_admins` activo ya no hay forma de saltárselo.

Configurado el 2026-09-18 con firma SSH y una clave ed25519 dedicada, separada de la clave de trabajo:

- `gpg.format = ssh`, `user.signingkey = ~/.ssh/id_ed25519_signing.pub`, `commit.gpgsign` y `tag.gpgsign` en true,
  **solo en este repositorio** — la configuración global no se tocó, porque firmar repos corporativos con una clave
  personal no es lo deseable.
- La clave pública está registrada en la cuenta de GitHub como *Signing Key*, que es una entrada distinta de la de
  autenticación aunque el archivo sea el mismo tipo.
- `~/.config/git/allowed_signers` permite que `git log --show-signature` verifique sin depender de GitHub.

Si un commit falla con `failed to write commit object` y una queja sobre la frase de paso, la clave no está en el
agente: `ssh-add --apple-use-keychain ~/.ssh/id_ed25519_signing`.
