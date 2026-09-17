---
id: MEM-2026-09-17-better-auth-no-exige-2fa-en-inicios-de-sesión-por-enlace-mág
type: pitfall
title: Better Auth no exige 2FA en inicios de sesión por enlace mágico
tags: auth, better-auth, 2fa, magic-link
source: docs/adr/0002-better-auth-enlace-magico-y-segundo-factor-staff.md
created: 2026-09-17
review_by: 2027-03-16
status: active
superseded_by:
---
El plugin twoFactor de Better Auth solo exige el segundo factor en /sign-in/email, /sign-in/username y /sign-in/phone-number. Enlace mágico, passkey y OAuth no quedan protegidos. En este repo el personal debe pasar por el guard requireStaff() (rol + secondFactorVerifiedAt + sesión de 8 h como máximo) en cada página, route handler y server action de src/app/(staff)/.
