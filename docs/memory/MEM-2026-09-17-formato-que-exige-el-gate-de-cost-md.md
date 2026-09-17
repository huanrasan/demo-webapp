---
id: MEM-2026-09-17-formato-que-exige-el-gate-de-cost-md
type: pitfall
title: Formato que exige el gate de cost.md
tags: harness, cost, finops, gate
source: .harness/sdlc.pyz (gates.py check_cost)
created: 2026-09-17
review_by: 2027-03-16
status: active
superseded_by:
---
La línea 'Total monthly (production):' debe tener un dígito pegado al primer token, por ejemplo '77,40 USD'; 'USD 77,40' o '**≈ USD 77,40**' fallan. Ninguna línea de la sección Guardrails puede terminar en ':' y la sección debe mencionar 'budget'.
