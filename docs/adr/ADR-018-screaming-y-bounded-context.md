# ADR-018 · Screaming architecture por bounded context

| Campo | Valor |
|-------|-------|
| Estado | Decidido |
| Fecha | 2026-10-15 |
| Relación | [TRD-00, secciones 14 y 16](../trd/TRD-00-arquitectura-base.md), [ADR-017](ADR-017-tdd-sobre-hexagonal.md) |

## Contexto

La hexagonal y el TDD ya están decididos. El monorepo, en cambio, agrupaba el código por capa (`packages/dominio`, `packages/aplicacion`, `packages/persistencia-*`). Quien abre el repositorio ve el framework y las capas, y tiene que entrar a cada una para encontrar pedidos, caja o facturación. Los módulos M0 a M9 ya se tratan como piezas que no importan el interior de otra; falta nombrarlos como bounded contexts y fijar los principios con los que se escribe dentro.

## Decisión

Cada módulo M0 a M9 es un **bounded context**: su propio lenguaje y su propio modelo. El monorepo usa **screaming architecture**: la primera carpeta de negocio es el contexto (`contextos/pedidos`, `contextos/caja`, `contextos/facturacion`). Dentro de cada uno viven el dominio, los casos de uso y los adaptadores. Las apps quedan como raíz de composición.

Un contexto habla con otro solo por su `puerto-de-entrada` o por un evento de `compartido/contratos`. Factus, la pasarela, las plataformas y la impresora entran por un adaptador que traduce su modelo al lenguaje del contexto.

Dentro de ese marco se aplican separación de responsabilidades, SOLID, DRY, KISS y YAGNI, como los detalla TRD-00, sección 14.2. DRY no unifica modelos de contextos distintos. YAGNI no adelanta carpetas: el contexto aparece con su primera prueba en rojo.

La forma de la prueba sigue en ADR-017: AAA en toda prueba de unidad, y GWT en el nombre cuando el comportamiento sale de un flujo o de un escenario del PRD.

## Consecuencias

- El esqueleto de la Fase 0 crea `contextos/plataforma` con dominio, aplicación, adaptadores en memoria y los dos de persistencia. Los demás contextos aparecen cuando empieza su módulo.
- dependency-cruiser rechaza un contexto que importa el dominio, los casos de uso internos o los adaptadores de otro, y una app que importa el dialecto de base que no le corresponde.
- Los TRD de módulo apuntan a `contextos/<contexto>/dominio` y `contextos/<contexto>/aplicacion`.
- `compartido/` guarda el lenguaje publicado (Zod y eventos), la sincronización, el driver ESC/POS y los componentes visuales. No guarda reglas de salón, caja ni factura.
