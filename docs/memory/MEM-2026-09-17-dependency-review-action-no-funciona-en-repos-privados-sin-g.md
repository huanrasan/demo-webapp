---
id: MEM-2026-09-17-dependency-review-action-no-funciona-en-repos-privados-sin-g
type: lesson
title: dependency-review-action no funciona en repos privados sin GHAS
tags: ci, github, dependencias
source: .github/workflows/sdlc-gates.yml
created: 2026-09-17
review_by: 2027-03-16
status: active
superseded_by:
---
El job dependencies de sdlc-gates falla con 'Dependency review is not supported on this repository' salvo que el repositorio sea público o tenga GitHub Advanced Security. Se limitó a repositorios públicos; en privado la cobertura la dan Trivy (sca.sarif) y el SBOM.
