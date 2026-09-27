-- CasaMarta · 004 · Datos iniciales: operación, checklist notaría, tareas y parámetros fiscales

insert into public.operacion (id) values (1) on conflict do nothing;

insert into public.documentos (nombre, descripcion, operacion, obligatorio, responsable, orden) values
 ('DNI/NIE en vigor de los vendedores', 'Original y en vigor de cada titular (padres). Revisar fecha de caducidad.', 'venta', true, 'Padres', 10),
 ('Escritura de propiedad', 'Título por el que los padres adquirieron la vivienda (copia autorizada o simple).', 'venta', true, 'Padres', 20),
 ('Último recibo del IBI pagado', 'Acredita que el IBI está al corriente y aporta la referencia catastral.', 'venta', true, 'Padres', 30),
 ('Certificado de la comunidad de propietarios', 'Firmado por el secretario con el visto bueno del presidente: al corriente de pago de cuotas.', 'venta', true, 'Administrador de fincas', 40),
 ('Certificado de eficiencia energética (CEE)', 'Obligatorio para vender; registrado en la Comunidad de Madrid, con su etiqueta.', 'venta', true, 'Técnico certificador', 50),
 ('Certificado de deuda o cancelación de hipoteca', 'Solo si queda hipoteca pendiente: certificado de saldo del banco o cancelación registral.', 'venta', false, 'Banco', 60),
 ('Recibos recientes de suministros', 'Luz, agua y gas al corriente; útiles para el cambio de titular y el acta de entrega.', 'venta', false, 'Padres', 70),
 ('Empadronamiento / prueba de vivienda habitual', 'Para justificar la exención de IRPF de mayores de 65 años por vivienda habitual.', 'venta', false, 'Padres', 80),
 ('Contrato de arras firmado', 'Si se firma contrato de arras con el comprador antes de la escritura.', 'venta', false, 'Marta', 90),
 ('Cuenta bancaria para el cobro', 'Datos de la cuenta de los vendedores y justificantes de los medios de pago.', 'venta', true, 'Padres', 100),
 ('Declaración / autoliquidación de la plusvalía', 'Majadahonda: 30 días hábiles desde la firma (actos inter vivos).', 'venta', true, 'Padres / gestoría', 110),
 ('DNI/NIE en vigor de los compradores', 'Original y en vigor.', 'compra', true, 'Marta', 10),
 ('Nota simple actualizada', 'Del Registro de la Propiedad: titularidad y cargas del piso a comprar.', 'compra', true, 'Marta / notaría', 20),
 ('Contrato de arras y justificante de la señal', 'Contrato firmado y justificante de la transferencia de la señal.', 'compra', false, 'Marta', 30),
 ('FEIN y oferta vinculante (si hay hipoteca)', 'Ficha Europea de Información Normalizada y oferta vinculante del banco.', 'compra', false, 'Banco', 40),
 ('Justificantes de los medios de pago', 'Cheques bancarios o transferencias del precio.', 'compra', true, 'Marta', 50),
 ('Certificado de la comunidad (del vendedor)', 'Que el piso está al corriente de cuotas de comunidad.', 'compra', true, 'Vendedor', 60),
 ('Último recibo del IBI (del vendedor)', 'Al corriente de pago.', 'compra', true, 'Vendedor', 70),
 ('Certificado de eficiencia energética del piso', 'Lo aporta el vendedor.', 'compra', true, 'Vendedor', 80);

insert into public.tareas (titulo, categoria, orden, notas) values
 ('Configurar titulares de la casa (nombre, % y fecha de nacimiento)', 'fiscal', 10, 'Sección Impuestos › Titulares.'),
 ('Consultar con asesor fiscal la exención de IRPF (mayores de 65, vivienda habitual)', 'fiscal', 20, null),
 ('Obtener valor catastral del suelo (recibo IBI o Sede del Catastro)', 'fiscal', 30, null),
 ('Presentar la plusvalía en Majadahonda (30 días hábiles tras la firma)', 'fiscal', 40, null),
 ('Declarar la venta en la renta del año siguiente (aunque esté exenta, se informa)', 'fiscal', 50, null),
 ('Liquidar ITP (modelo 600) de la compra en 30 días hábiles', 'fiscal', 60, null),
 ('Pedir lectura de contadores el día de la entrega de llaves', 'mudanza', 10, null),
 ('Cambiar de titular o dar de baja luz, agua y gas de la casa vendida', 'mudanza', 20, null),
 ('Dar de alta suministros en la casa nueva (2-3 semanas antes)', 'mudanza', 30, null),
 ('Trasladar internet y seguro de hogar', 'mudanza', 40, null),
 ('Cambiar domicilio en padrón, DGT, banco y Agencia Tributaria', 'mudanza', 50, null);

insert into public.parametros (clave, valor, descripcion, fuente_url, consultado) values
 ('plusvalia_tipo', '20', 'Majadahonda: tipo de gravamen del IIVTNU (%), igual para todos los periodos.', 'https://portaltributario.majadahonda.org/ordenanzas/MAJADAHONDA-OF-4-MOD-2026-DEROG.pdf', '2026-09-27'),
 ('plusvalia_coeficientes', '[0.15,0.15,0.14,0.14,0.16,0.18,0.19,0.18,0.15,0.12,0.10,0.09,0.09,0.09,0.09,0.09,0.10,0.13,0.17,0.23,0.40]',
   'Majadahonda: coeficientes por años de tenencia (índice 0 = menos de 1 año … 20 = 20 o más). Vigentes desde el 28-01-2026 tras la derogación del RDL 16/2025.',
   'https://portaltributario.majadahonda.org/ordenanzas/MAJADAHONDA-OF-4-MOD-2026-DEROG.pdf', '2026-09-27'),
 ('plusvalia_reduccion_suelo', '0', 'Reducción (%) del valor catastral del suelo si hubo ponencia de valores reciente (60/50/40/30/20 % los 5 primeros años).', 'https://portaltributario.majadahonda.org/ordenanzas/MAJADAHONDA-OF-4-MOD-2026-DEROG.pdf', '2026-09-27'),
 ('irpf_ahorro_tramos', '[[6000,19],[50000,21],[200000,23],[300000,27],[null,30]]', 'Escala de la base del ahorro (estatal + autonómica): hasta X € → tipo %.', 'https://www.cnmv.es/DocPortal/Publicaciones/Guias/GuiaFiscalidadFondosInversion2026.pdf', '2026-09-27'),
 ('itp_general', '6', 'Comunidad de Madrid: ITP general en vivienda de segunda mano (%).', 'https://guiafiscal.es/patrimonio/itp/madrid/', '2026-09-27'),
 ('itp_familia_numerosa', '4', 'Comunidad de Madrid: tipo reducido para familia numerosa que compra vivienda habitual (%).', 'https://guiafiscal.es/patrimonio/itp/madrid/', '2026-09-27'),
 ('iva_obra_nueva', '10', 'IVA de la vivienda nueva (%).', 'https://guiafiscal.es/patrimonio/itp/madrid/', '2026-09-27'),
 ('ajd_madrid', '0.75', 'Comunidad de Madrid: AJD en obra nueva (%), puede variar por tramos de valor.', 'https://guiafiscal.es/patrimonio/itp/madrid/', '2026-09-27'),
 ('gastos_notaria_registro_pct', '1', 'Estimación de notaría + registro + gestoría sobre el precio de compra (%).', null, '2026-09-27');
