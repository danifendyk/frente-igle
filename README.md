# Estudio de fachadas · Asamblea Cristiana

Editor paramétrico del frente de una iglesia. La geometría cambia según una tabla de proporciones definida para anchos interiores de 6 a 10 m.

## Uso

Abre `index.html` en un navegador actual. No necesita instalación, conexión a Internet ni servicios externos.

- Ajusta el ancho interior entre 6 y 10 m, en pasos de 0,05 m, o elige una de las cinco filas de referencia. El ancho exterior suma siempre 0,40 m.
- Las alturas, la puerta, las ventanas y el cuerpo central sobresaliente se interpolan entre las filas de la tabla. El alto de puertas y ventanas se mide desde su base hasta la punta del arco.
- Selecciona distribución automática, separación fija o cantidad manual. El aviso indica si la distribución cabe y cumple la separación elegida.
- Abre **Presentación y capas** para cambiar el tema, las cotas, la cuadrícula y el rótulo.
- Abre **Ficha de medidas** para consultar márgenes y dimensiones.
- La configuración se guarda automáticamente en este navegador y dispositivo. Si el navegador bloquea el almacenamiento local, el editor sigue funcionando durante la sesión.
- **Restablecer valores iniciales** recupera el modelo original y reemplaza la configuración guardada.

En el plano: arrastra para mover, usa la rueda para ampliar o reducir y haz doble clic para centrar. En pantallas táctiles puedes arrastrar y usar dos dedos para el zoom. Con el plano enfocado, usa `+` / `−` para zoom, flechas para mover, `F` o `0` para centrar y `C` para mostrar u ocultar cotas. En móvil, `Escape` vuelve al plano.

## Exportaciones

- **DXF:** geometría en coordenadas métricas, organizada en capas. Respeta la visibilidad de cotas; los fondos, escala humana y efectos de presentación pertenecen al SVG. Selecciona metros al importar si el programa CAD solicita las unidades.
- **SVG:** plano vectorial con la presentación seleccionada, independiente del desplazamiento o zoom del visor.
- **PNG:** imagen de 3000 píxeles de ancho que conserva la proporción del plano y su fondo.
- **Imprimir / PDF:** hoja A4 horizontal, presentación blanca y plano completo ajustado a página. La escala impresa depende del ajuste de página; las cotas expresan las medidas del modelo. Al cerrar la impresión se recupera el tema del editor.

## Estructura y comprobaciones

- `facade_engine.js`: geometría, generación SVG y DXF.
- `app.js`: controles, navegación, guardado local y descargas.
- `index.html` y `styles.css`: interfaz adaptable a escritorio y móvil.
- `tests/facade_engine.test.js`: regresiones geométricas y de exportación.

Con Node.js instalado, ejecuta `npm test` para comprobar simetría, límites, arcos, rótulos y cotas; `npm run check` verifica la sintaxis. No es necesario instalar paquetes.

Las cinco filas originales están en `FacadeEngine.RELATION_TABLE`. Los valores intermedios usan interpolación lineal por tramos, por lo que cada fila de 6, 7, 8, 9 y 10 m se conserva exactamente. La altura mínima gobierna las alas laterales; la máxima gobierna el remate central; su diferencia define el sobresaliente. Las molduras usan provisionalmente 0,19 m.

La separación de ventanas se mide entre las caras exteriores de las molduras. El modo automático divide cada ala en módulos iguales; agrega ventanas cuando la nueva distribución cumple la separación mínima. El modo de separación fija conserva esa cantidad y centra el conjunto con la distancia seleccionada entre ventanas.
