"""Criterios FUNCIONAL C1-C13."""
import io
import zipfile
from datetime import date

from base import BaseTest


class TestFuncional(BaseTest):
    def test_C1_guardar_aparece_en_lista_con_fecha_calculada(self):
        e = self.anadir(sitio='Banco Ejemplo', dias=30)
        lista = self.caja.listar()
        self.assertEqual([x.sitio for x in lista], ['Banco Ejemplo'])
        self.assertEqual(lista[0].caduca, date(2026, 2, 14))  # 15 ene + 30 dias
        self.assertEqual(lista[0].id, e.id)

    def test_C2_aviso_de_caducadas_y_proximas_sin_correo(self):
        self.anadir(sitio='A', dias=3)    # proxima (<= 7)
        self.anadir(sitio='B', dias=60)   # lejana
        self.anadir(sitio='C', dias=1)
        self.reloj.avanzar(days=2)        # C caducada, A en 1 dia
        avisos = {a.sitio: a.motivo for a in self.caja.avisos()}
        self.assertEqual(avisos, {'A': 'proxima', 'C': 'caducada'})
        self.assertFalse(hasattr(self.app, 'enviar_correo'))

    def test_C2_antelacion_programable(self):
        e = self.anadir(sitio='A', dias=20)
        self.assertEqual(self.caja.avisos(), [])
        self.caja.programar_aviso(e.id, 30)
        self.assertEqual([a.sitio for a in self.caja.avisos()], ['A'])

    def test_C3_generar_longitud_por_defecto_y_minima(self):
        self.assertEqual(len(self.caja.generar()), 20)
        self.assertEqual(len(self.caja.generar(longitud=12)), 12)
        from gestor.errores import DatoInvalido
        with self.assertRaises(DatoInvalido):
            self.caja.generar(longitud=11)

    def test_C3_generar_solo_tipos_elegidos(self):
        for _ in range(30):
            p = self.caja.generar(tipos=('digitos',))
            self.assertTrue(p.isdigit())
        for _ in range(30):
            p = self.caja.generar(tipos=('mayusculas', 'digitos'))
            self.assertTrue(all(c.isdigit() or ('A' <= c <= 'Z') for c in p))

    def test_C4_deshacer_devuelve_la_anterior(self):
        e = self.anadir(contrasena='Anterior-Aa1!xx')
        self.caja.actualizar(e.id, contrasena='Nueva-Bb2!yy')
        self.assertEqual(self.caja.ver(e.id), 'Nueva-Bb2!yy')
        self.reloj.avanzar(seconds=19)
        self.caja.deshacer()
        self.assertEqual(self.caja.ver(e.id), 'Anterior-Aa1!xx')

    def test_C5_excel_contiene_sitio_usuario_tipo_y_fecha(self):
        self.anadir(sitio='Banco Ejemplo', usuario='cuenta1@example.com', dias=30, tipo='Finanzas')
        datos = self.caja.exportar_excel()
        z = zipfile.ZipFile(io.BytesIO(datos))
        texto = ''.join(z.read(n).decode('utf-8', 'ignore') for n in z.namelist() if n.endswith('.xml'))
        for esperado in ('Banco Ejemplo', 'cuenta1@example.com', 'Finanzas', '2026-02-14'):
            self.assertIn(esperado, texto)

    def test_C6_clave_de_emergencia_se_confirma_y_la_anterior_deja_de_valer(self):
        from gestor.errores import AccesoDenegado
        k1 = self.caja.generar_clave_emergencia()
        self.assertTrue(self.caja.emergencia_pendiente)
        self.caja.confirmar_clave_emergencia()
        self.assertFalse(self.caja.emergencia_pendiente)
        k2 = self.caja.generar_clave_emergencia()
        self.caja.confirmar_clave_emergencia()
        self.assertNotEqual(k1, k2)
        with self.assertRaises(AccesoDenegado):
            self.app.abrir_caja_emergencia(self.sesion, k1)
        self.assertIsNotNone(self.app.abrir_caja_emergencia(self.sesion, k2))

    def test_C7_ics_con_fecha_y_sitio(self):
        self.anadir(sitio='Banco Ejemplo', dias=30)
        ics = self.caja.exportar_ics()
        self.assertIn('BEGIN:VCALENDAR', ics)
        self.assertIn('BEGIN:VEVENT', ics)
        self.assertIn('Banco Ejemplo', ics)
        self.assertIn('20260214', ics)

    def test_C8_contrasena_solo_con_ver_y_portapapeles_se_borra_a_los_30s(self):
        e = self.anadir(contrasena='Secreta-Aa1!xx')
        self.assertFalse(hasattr(self.caja.listar()[0], 'contrasena'))
        self.assertEqual(self.caja.ver(e.id), 'Secreta-Aa1!xx')
        self.caja.copiar(e.id)
        self.assertEqual(self.app.portapapeles.contenido(), 'Secreta-Aa1!xx')
        self.reloj.avanzar(seconds=29)
        self.assertEqual(self.app.portapapeles.contenido(), 'Secreta-Aa1!xx')
        self.reloj.avanzar(seconds=1)
        self.assertEqual(self.app.portapapeles.contenido(), '')

    def test_C9_buscar_y_filtrar(self):
        self.anadir(sitio='Banco Ejemplo', usuario='uno@example.com', dias=90)
        self.anadir(sitio='Correo Ejemplo', usuario='dos@example.com', dias=2)
        self.reloj.avanzar(days=5)
        self.assertEqual([e.sitio for e in self.caja.listar(buscar='banco')], ['Banco Ejemplo'])
        self.assertEqual([e.sitio for e in self.caja.listar(buscar='dos@')], ['Correo Ejemplo'])
        self.assertEqual([e.sitio for e in self.caja.listar(estado='Caducada')], ['Correo Ejemplo'])
        self.assertEqual(self.caja.listar(buscar='no-existe'), [])

    def test_C10_renovar_varias_en_seco_no_modifica_hasta_confirmar(self):
        a = self.anadir(sitio='A', contrasena='Vieja-A-Aa1!xx')
        b = self.anadir(sitio='B', contrasena='Vieja-B-Aa1!xx')
        informe = self.caja.renovar_varias([a.id, b.id])  # por defecto: prueba en seco
        self.assertEqual(informe.cambios, 2)
        self.assertFalse(informe.aplicado)
        self.assertEqual(self.caja.ver(a.id), 'Vieja-A-Aa1!xx')
        self.assertEqual(self.caja.ver(b.id), 'Vieja-B-Aa1!xx')
        informe = self.caja.renovar_varias([a.id, b.id], confirmar=True)
        self.assertTrue(informe.aplicado)
        self.assertNotEqual(self.caja.ver(a.id), 'Vieja-A-Aa1!xx')
        self.assertNotEqual(self.caja.ver(b.id), 'Vieja-B-Aa1!xx')

    def test_C11_registro_de_acciones(self):
        e = self.anadir()
        self.caja.ver(e.id)
        self.caja.exportar_excel()
        acciones = {r['accion'] for r in self.caja.registro()}
        for a in ('inicio_sesion', 'alta', 'ver_contrasena', 'exportacion'):
            self.assertIn(a, acciones)
        self.caja.actualizar(e.id, sitio='Otro')
        self.assertIn('cambio', {r['accion'] for r in self.caja.registro()})
        self.assertTrue(all('fecha' in r for r in self.caja.registro()))

    def test_C11_registro_solo_visible_para_su_dueno(self):
        from gestor.errores import AccesoDenegado
        self.anadir()
        s2 = self.app.iniciar_sesion('token-2')
        caja2 = self.app.crear_caja(s2, 'Otra-Maestra-Ficticia-2')
        self.assertNotIn('alta', {r['accion'] for r in caja2.registro()})
        with self.assertRaises(AccesoDenegado):
            self.app.leer_registro(s2, usuario='usuario1@example.com')

    def test_C11_registro_nunca_contiene_contrasenas(self):
        e = self.anadir(contrasena='NoDebeVerse-Aa1!xx')
        self.caja.ver(e.id)
        self.assertNotIn('NoDebeVerse-Aa1!xx', repr(self.caja.registro()))

    def test_C12_editar_y_borrar(self):
        e = self.anadir(sitio='Viejo')
        self.caja.actualizar(e.id, sitio='Nuevo', usuario='nuevo@example.com')
        self.assertEqual(self.caja.listar()[0].sitio, 'Nuevo')
        self.assertEqual(self.caja.listar()[0].usuario, 'nuevo@example.com')
        self.caja.borrar(e.id)
        self.assertEqual(self.caja.listar(), [])
