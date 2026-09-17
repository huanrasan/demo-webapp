import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    // threat-model T-7
    rules: {
      "react/no-danger": "error",
      "no-restricted-properties": [
        "error",
        {
          property: "$queryRawUnsafe",
          message: "Usa $queryRaw con plantilla etiquetada (consultas parametrizadas).",
        },
        {
          property: "$executeRawUnsafe",
          message: "Usa $executeRaw con plantilla etiquetada (consultas parametrizadas).",
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    "tests/lint/fixtures/**",
  ]),
]);

export default eslintConfig;
