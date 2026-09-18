---
id: MEM-2026-09-18-ac-9-cerrado-la-proteccion-de-main-aplica-a-administradores
type: decision
title: "AC-9 cerrado: la protección de main aplica a administradores"
tags: harness, ci, branch-protection, ac-9
source: review.md AC-9; .github branch protection de main
created: 2026-09-18
review_by: 2027-03-17
status: active
superseded_by:
---
`review.md` registra AC-9 como cumplido solo en parte porque `enforce_admins` estaba en `false`, con el riesgo
aceptado pendiente de registrarse como desviación. El 2026-09-18 se activó `enforce_admins` en la protección de
`main`, así que ya no hay forma de mergear saltándose los checks requeridos ni siendo administrador, y AC-9 se
cumple por completo.

No se editó `review.md`: modificar un artefacto aprobado invalida su recibo de aprobación, y `sdlc amend` solo
corre en una terminal con un humano delante.

El motivo que justificaba la escotilla desapareció con el arnés 0.7.0: el check `harness` se ponía rojo porque
GitHub no permite autoaprobarse, y ahora un recibo que llega en un commit con firma verificada por la plataforma
sustituye a la revisión (ADR-0014). La protección no exige revisiones, así que activarlo no bloquea al
mantenedor único.
