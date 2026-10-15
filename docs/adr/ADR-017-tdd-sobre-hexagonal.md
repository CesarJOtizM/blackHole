# ADR-017 · Construir con TDD sobre la hexagonal

| Campo | Valor |
|-------|-------|
| Estado | Decidido |
| Fecha | 2026-10-15 |
| Relación | [TRD-00, secciones 14 y 16](../trd/TRD-00-arquitectura-base.md) |

## Contexto

El mismo caso de uso corre en el nodo (SQLite) y en la nube (PostgreSQL), y las reglas de impuestos, permisos y totales tienen que coincidir sin internet. La estructura hexagonal ya está decidida. Falta fijar cómo entra cada comportamiento al código, para que un módulo sencillo no se salte las capas y para que los dos adaptadores de persistencia no se desvíen.

## Decisión

Todo comportamiento de M0 a M9, y de las PWA, entra por una prueba que falla. El orden es de adentro hacia afuera: dominio, caso de uso con adaptadores en memoria, contrato del puerto en los dos dialectos, adaptador externo y, al final, la entrada HTTP o WebSocket. Se avanza de a un comportamiento. No se escriben todas las pruebas del módulo antes de la implementación.

Cada prueba de unidad se escribe en tres bloques separados por una línea en blanco: preparar, actuar y comprobar (AAA). Cuando el comportamiento sale de un flujo o de un escenario del PRD, el nombre de la prueba usa dado, cuando y entonces (GWT). Given es preparar, When es actuar y Then es comprobar: es la misma forma, con el vocabulario del escenario.

Los dobles de lo nuestro son adaptadores en memoria del puerto real. Los de Factus, la pasarela, las plataformas y la impresora son otros adaptadores de ese mismo puerto. Drizzle no se simula. El dominio no depende de Nest.

## Consecuencias

- El esqueleto de la Fase 0 incluye Vitest, dependency-cruiser, la suite de contrato y el primer caso de uso nacido de una prueba en rojo.
- Cada TRD de módulo lista los comportamientos a probar, con la plantilla de la sección 9, antes de describir tablas o rutas nuevas.
- La integración continua rechaza un dominio que importa infraestructura, un puerto sin contrato y un contrato que pasa en un solo dialecto.
- No se exige un porcentaje de líneas. Una regla sin prueba no se considera hecha.
- Queda fuera event sourcing y un modelo de lectura separado por cada caso de uso. Las proyecciones de reportes siguen siendo las de TRD-00, sección 11.
