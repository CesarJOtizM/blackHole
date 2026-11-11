---
name: blackHole
description: Parte del salón para operar la sede, la caja y la factura.
colors:
  ink: "#141210"
  paper: "#F2ECE1"
  sheet: "#FBF8F1"
  faded: "#5E574C"
  stamp: "#C21F2B"
  go: "#1E6B3A"
  hold: "#9A4A06"
  carbon: "#1B1916"
  board: "#E4DBCB"
typography:
  display:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "40px"
    fontWeight: 700
  headline:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "34px"
    fontWeight: 700
  title:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
  body:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 700
rounded:
  sm: "4px"
spacing:
  inline: "16px"
  section: "32px"
  screen: "44px"
  control: "48px"
  board: "56px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "48px"
  chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "40px"
  chip-idle:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "40px"
  choice-card:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "18px"
  nav-item-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    padding: "0 12px"
    height: "36px"
---

# Design System: blackHole

## Overview

**Creative North Star: "El parte del salón"**

Un parte se lee de un vistazo: quién, qué estado y qué cifra. El sistema es de turno. La densidad es la de una cuenta abierta. El papel, la hoja y el tablero se distinguen por tono. Lo que se puede pulsar lleva un borde de 1 px. No hay sombra.

La voz es de auditoría. Cada estado se escribe. El color acompaña a la palabra y no la reemplaza. Los números usan mono y el separador de miles es un punto. Dentro de un ticket, las líneas se separan con guiones.

Queda fuera un panel SaaS genérico, con gradientes, sombras y tarjetas iguales. También queda fuera el tema Servicio del código: su naranja de acción, el azul de mesa ocupada y Bricolage Grotesque no son este sistema.

**Key Characteristics:**

- Estados con palabra, no solo con color
- Mono para códigos, cifras y sellos
- Papel, hoja y tablero como únicas capas
- Borde de 1 px en lo que se pulsa
- Sello rojo solo para faltante, anulación y agotado

## Colors

La paleta es de papel y tinta. El color entra para señalar un estado, y el estado siempre lleva su palabra.

### Primary

- **ink** (`#141210`): texto, botón principal y fondo de la barra lateral. Es la acción. No hay un acento de marca aparte.

### Secondary

- **stamp** (`#C21F2B`): faltante, anulación y agotado. Nada más.

**The Stamp Rule.** stamp no pinta un botón de entrega, un paso, un trámite ni un filtro. Si el caso no es faltante, anulación o agotado, el control es ink.

### Tertiary

- **go** (`#1E6B3A`): cerrado, recibido o activo. La palabra va junto al color: RESUELTA, RECIBIDO, ACTIVO.
- **hold** (`#9A4A06`): espera y trámite. La palabra va junto al color: ABIERTA, EN TRÁMITE, PENDIENTE.

**The Word Rule.** Un estado no se entiende solo por el color. La pantalla dice ATRASADA, FALTA, AGOTADO o RESUELTA.

### Neutral

- **paper** (`#F2ECE1`): fondo de la pantalla.
- **sheet** (`#FBF8F1`): tarjeta, fila y botón secundario.
- **board** (`#E4DBCB`): lienzo detrás de las pantallas y borde de 1 px.
- **faded** (`#5E574C`): texto de apoyo, rutas y guiones del ticket.
- **carbon** (`#1B1916`): texto o bloque que tiene que ser más oscuro que ink sin volverse otro acento.

En la barra lateral, la etiqueta en reposo es `#E9E1D3`, el icono `#CFC6B6` y el rótulo de sección `#8E867A`. La fila activa vuelve a paper, con icono y etiqueta en ink.

## Typography

**Display Font:** IBM Plex Mono (con ui-monospace)
**Body Font:** Atkinson Hyperlegible Next (con ui-sans-serif)
**Label/Mono Font:** IBM Plex Mono (con ui-monospace)

**Character:** La cifra y el sello se leen en mono, como en un ticket. La frase de apoyo se lee en sans. No hay una tercera familia de exhibición.

### Hierarchy

- **Display** (700, 40 px): título del tablero. Aparece una vez, en mono.
- **Headline** (700, 34 px): título de la pantalla de administración. En la caja baja a 32 px. En el celular baja a 28 px.
- **Title** (700, 16 px): nombre de una fila o de una tarjeta, en sans.
- **Body** (500, 16 px): resumen y detalle, en sans y en faded. En el tablero el resumen es de 17 px.
- **Label** (700, 13 px): código de sección, estado, ruta y botón. En mono. El código de sección usa stamp.

**The Audit Type Rule.** Una cifra, un código y un estado van en mono. Una explicación va en sans. El separador de miles es un punto.

## Layout

La web de administración es una página de 1440×900 px. La barra lateral mide 232 px y el resto es el contenido, en horizontal. La barra de ruta mide 60 px, con 32 px de padding lateral.

El tablero que agrupa pantallas tiene 56 px de padding y 32 px entre la cabecera y la fila. Entre pantallas hay 44 px. El contenido de una pantalla lleva 32 px de padding.

El celular del mesero, del cliente y del domiciliario es de 390×844 px. La barra de estado mide 44 px. Un control que se usa con una mano mide 48 px de alto; el botón principal del celular puede llegar a 56 px. La navegación inferior del plano mide 64 px.

La caja, cuando no es el celular, usa una ventana de 1194×834 px.

## Elevation & Depth

No hay sombras. La profundidad es el tono: board detrás, paper en la pantalla, sheet en la tarjeta. Lo que se puede pulsar, o lo que separa una fila, lleva un borde de 1 px en board, alineado por dentro. La opción elegida lleva un borde de 2 px en ink.

**The Flat Line Rule.** Si hace falta separar, es un borde de 1 px. No es una sombra, ni un gradiente, ni una tarjeta flotando.

## Shapes

Las esquinas son de 4 px en botones, filtros y tarjetas. No hay píldoras ni esquinas completamente redondas.

La otra forma del sistema es el guion del ticket: una línea de guiones en mono y en faded, dentro de la hoja, no como adorno de la página.

## Components

Los controles son precisos y contenidos. El peso está en la palabra y en la cifra.

### Buttons

- **Shape:** esquinas de 4 px.
- **Primary:** fondo ink, texto sheet, alto 48 px, padding lateral 16 px, etiqueta en mono a 13 px y peso 700.
- **Hover / Focus:** el foco es un contorno de 2 px en ink, separado 2 px. No hay elevación.
- **Secondary:** fondo sheet, texto ink, borde de 1 px en board.

### Chips

- **Style:** alto 40 px en la web, padding lateral 14 px, mono a 13 px, esquinas de 4 px.
- **State:** el filtro elegido es ink con texto sheet. El filtro en reposo es sheet con texto ink. En el celular, si el filtro se toca con el pulgar, el alto sube a 48 px.

### Cards / Containers

- **Corner Style:** 4 px.
- **Background:** sheet sobre paper.
- **Shadow Strategy:** ninguna. Ver Elevation & Depth.
- **Border:** 1 px en board. La tarjeta elegida entre dos opciones pasa a 2 px en ink.
- **Internal Padding:** 18 px en una tarjeta de elección. 20 px en un ticket.

### Inputs / Fields

- **Style:** el valor escrito se lee en mono, el rótulo en sans y faded. El campo vive en sheet, con borde de 1 px en board y esquinas de 4 px.
- **Focus:** borde de 2 px en ink.
- **Error / Disabled:** el error de un faltante usa stamp y la palabra FALTA. Un campo que no se puede usar baja a faded.

### Navigation

La barra lateral mide 232 px, con fondo ink y padding de 22 px por 14 px. El nombre del producto va en sheet, mono, 18 px. La sección va en `#8E867A`, mono, 10 px. La etiqueta en reposo va en `#E9E1D3`, mono, 12 px. La fila activa tiene fondo paper e icono y etiqueta en ink.

En el celular, la navegación inferior mide 64 px de alto.

### Ticket

La hoja de la cuenta, del comprobante y de la factura usa sheet, mono para las cifras y guiones en faded para cortar secciones. El total cierra en mono. Un comprobante que no es factura lo dice con esas palabras. No usa un número de contingencia.

## Do's and Don'ts

### Do

- **Do** escribir el estado junto al color: FALTA, AGOTADO, ATRASADA, RESUELTA.
- **Do** usar stamp solo para faltante, anulación y agotado.
- **Do** mantener el contraste de WCAG 2.2 AA: 4,5:1 en texto normal y 3:1 en texto grande y en bordes de controles.
- **Do** usar el punto como separador de miles y mono en las cifras.
- **Do** imprimir, cuando no hay internet, un comprobante de venta que diga que no es factura electrónica.

### Don't

- **Don't** usar el tema Servicio (`shared/ui/src/theme.css`) para una pantalla nueva de este sistema. Su acción naranja, su azul de mesa y Bricolage Grotesque son otro tema.
- **Don't** añadir sombra, gradiente o tarjeta flotante para separar superficies.
- **Don't** pintar con stamp un botón normal, un paso o una espera.
- **Don't** dejar que el color sea la única señal de un estado.
- **Don't** numerar una venta sin internet como factura de contingencia.
