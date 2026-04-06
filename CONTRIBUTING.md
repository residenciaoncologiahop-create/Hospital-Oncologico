# Contribuir a OncoGuide

## Reportar un bug o sugerir una mejora

Abrí un **Issue** en GitHub describiendo:
- Qué pasó / qué esperabas que pasara
- Pasos para reproducirlo
- Captura de pantalla si aplica

## Hacer cambios en el código

1. Cloná el repo y creá una rama: `git checkout -b feature/nombre-de-la-mejora`
2. Hacé los cambios y verificá que el build pase: `npm run build`
3. Verificá que no haya errores de lint: `npm run lint`
4. Commiteá con un mensaje descriptivo: `git commit -m "feat: descripción"`
5. Abrí un Pull Request hacia `main`

## Reglas obligatorias

- **Nunca commitear `.env` ni `.env.local`** — usar `.env.example` como referencia
- No hardcodear API keys ni credenciales en el código
- Todo cambio debe pasar `npm run build` antes del PR
- Los datos de pacientes nunca deben aparecer en commits, issues ni PRs

## Convención de commits

| Prefijo | Uso |
|---|---|
| `feat:` | Nueva funcionalidad |
| `fix:` | Corrección de bug |
| `chore:` | Configuración, dependencias |
| `refactor:` | Reorganización sin cambio de funcionalidad |
| `docs:` | Documentación |

## Contacto

Residencia de Oncología Clínica — Hospital Oncológico Provincial, Córdoba, Argentina.
