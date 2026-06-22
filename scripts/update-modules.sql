-- Agregar los 4 nuevos módulos a empresas existentes
UPDATE Empresa SET modulosActivos = 
  CASE
    WHEN modulosActivos IS NULL OR modulosActivos = '' THEN '[CORE,PEDIDOS,VENTAS,DESPACHOS,TRASPASOS]'
    WHEN modulosActivos NOT LIKE '%PEDIDOS%' AND modulosActivos NOT LIKE '%VENTAS%' AND modulosActivos NOT LIKE '%DESPACHOS%' AND modulosActivos NOT LIKE '%TRASPASOS%' THEN
      CONCAT(LEFT(modulosActivos, LENGTH(modulosActivos) - 1), ',PEDIDOS,VENTAS,DESPACHOS,TRASPASOS]')
    WHEN modulosActivos NOT LIKE '%PEDIDOS%' THEN
      CONCAT(LEFT(modulosActivos, LENGTH(modulosActivos) - 1), ',PEDIDOS]')
    WHEN modulosActivos NOT LIKE '%VENTAS%' THEN
      CONCAT(LEFT(modulosActivos, LENGTH(modulosActivos) - 1), ',VENTAS]')
    WHEN modulosActivos NOT LIKE '%DESPACHOS%' THEN
      CONCAT(LEFT(modulosActivos, LENGTH(modulosActivos) - 1), ',DESPACHOS]')
    WHEN modulosActivos NOT LIKE '%TRASPASOS%' THEN
      CONCAT(LEFT(modulosActivos, LENGTH(modulosActivos) - 1), ',TRASPASOS]')
    ELSE modulosActivos
  END
WHERE modulosActivos NOT LIKE '%PEDIDOS%' OR modulosActivos NOT LIKE '%VENTAS%' OR modulosActivos NOT LIKE '%DESPACHOS%' OR modulosActivos NOT LIKE '%TRASPASOS%';
