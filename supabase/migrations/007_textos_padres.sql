-- CasaMarta · 007 · La compra es de los padres (Marta solo ayuda): responsables del checklist
update public.documentos set responsable = 'Padres' where responsable = 'Marta';
update public.documentos set responsable = 'Notaría / agencia' where responsable = 'Marta / notaría';
update public.documentos set nombre = 'DNI/NIE en vigor de los compradores (padres)', descripcion = 'Original y en vigor de cada comprador.'
 where nombre = 'DNI/NIE en vigor de los compradores';
