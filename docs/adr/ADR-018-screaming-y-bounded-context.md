# ADR-018 · Screaming architecture por bounded context

| Campo | Valor |
|-------|-------|
| Estado | Decidido |
| Versión | 0.2 |
| Fecha | 2026-10-17 |
| Relación | [TRD-00, secciones 14 y 16](../trd/TRD-00-arquitectura-base.md), [ADR-017](ADR-017-tdd-sobre-hexagonal.md), [Glosario de código](../glosario-codigo.md) |

## Contexto

La hexagonal y el TDD ya están decididos. El monorepo, en cambio, agrupaba el código por capa: un paquete de dominio, uno de aplicación y uno de persistencia por cada base. Quien abre el repositorio ve el framework y las capas, y tiene que entrar a cada una para encontrar pedidos, caja o facturación. Los módulos M0 a M9 ya se tratan como piezas que no importan el interior de otra; falta nombrarlos como bounded contexts y fijar los principios con los que se escribe dentro.

## Decisión

Cada módulo M0 a M9 es un **bounded context**: su propio lenguaje y su propio modelo. El monorepo usa **screaming architecture**: la primera carpeta de negocio es el contexto (`contexts/orders`, `contexts/cash-register`, `contexts/invoicing`). Dentro de cada uno viven `domain`, `application` y `adapters`. Las apps (`apps/api-cloud`, `apps/local-node` y las PWA) quedan como raíz de composición.

El código y sus nombres van en inglés, según el [glosario](../glosario-codigo.md); los documentos siguen en español (D-06). El lenguaje ubicuo de cada contexto se traduce una sola vez en el glosario o en el TRD del módulo, y se usa igual en clases, casos de uso, eventos, errores y pruebas.

Un contexto habla con otro solo por su `application/entry-port.ts` o por un evento de `shared/contracts`. Factus, la pasarela, las plataformas y la impresora entran por un adaptador que traduce su modelo al lenguaje del contexto.

Dentro de ese marco se aplican separación de responsabilidades, SOLID, DRY, KISS y YAGNI, como los detalla TRD-00, sección 14.2. DRY no unifica modelos de contextos distintos. YAGNI no adelanta carpetas: el contexto aparece con su primera prueba en rojo.

La forma de la prueba sigue en ADR-017: AAA en toda prueba de unidad, y Given / When / Then en el nombre cuando el comportamiento sale de un flujo o de un escenario del PRD.

## Consecuencias

- El esqueleto de la Fase 0 crea `contexts/platform` con `domain`, `application` y `adapters`. La entrega 0.2 está cerrada: esa carpeta existe, junto con `shared/contracts`, `apps/api-cloud`, `apps/local-node`, `tools/cruiser`, `tools/skeleton`, el primer caso de uso, la suite de contrato del primer puerto y los adaptadores `adapters/memory` y `adapters/postgres`. El adaptador `sqlite` queda en la fase híbrida. Ya entraron `orders`, `cash-register`, `invoicing` y `attendance`. Los demás contextos aparecen cuando empieza su módulo.
- dependency-cruiser rechaza un contexto que importa el dominio, los casos de uso internos o los adaptadores de otro, y una app que importa el dialecto de base que no le corresponde. Los casos que deben fallar viven en `tools/cruiser/fixtures`.
- Los TRD de módulo apuntan a `contexts/<context>/domain` y `contexts/<context>/application`.
- `shared/` guarda el lenguaje publicado (`shared/contracts`: Zod y eventos), la sincronización (`shared/sync`), las plantillas y el driver ESC/POS (`shared/printing`) y los componentes visuales (`shared/ui`). No guarda reglas de salón, caja ni factura: cada contexto decide qué imprime y cuándo.
