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
Con el arnés 0.5.2 la línea 'Total monthly (production):' exigía un dígito pegado al primer token ('77,40 USD'
pasaba; 'USD 77,40' fallaba) y ninguna línea de Guardrails podía terminar en ':'. **El arnés 0.7.0 relajó ambas
cosas**: el importe admite la moneda antes o después, y Guardrails se juzga por contenido, no por puntuación.

Lo que sigue exigiendo el gate: un importe numérico en 'Total monthly (production):', al menos un componente con
coste mensual numérico, la sección 'Assumptions', y que Guardrails cubra los cuatro temas: presupuesto mensual,
umbrales de alerta, etiquetas de asignación de coste y qué se apaga o se escala a cero cuando está ocioso.
