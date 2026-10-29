"""Criterios BORDE C14-C19, SEGURIDAD C20-C23, LIMITE C24-C26.
C13 (encontrar y copiar en menos de 5 minutos) se comprueba en la prueba guiada, no con un test automatico."""
from datetime import date

from base import BaseTest, MAESTRA, USUARIO1


class TestBorde(BaseTest):
    def test_C14_lista_vacia_muestra_mensaje_y_boton(self):
        self.assertEqual(self.caja.listar(), [])
        self.assertEqual(self.caja.mensaje_vacio(), 'Aún no tienes contraseñas guardadas')
        from gestor import web
        self.assertIn('Añadir', web.pagina_lista([]))

    def test_C15_fecha_imposible_se_guarda_y_se_marca_revisar(self):
        e0 = self.anadir(sitio='Cero', dias=0)
        en = self.anadir(sitio='Negativa', dias=-5)
        estados = {x.sitio: x.estado for x in self.caja.listar()}
        self.assertEqual(estados, {'Cero': 'Revisar', 'Negativa': 'Revisar'})
        self.assertIsNotNone(e0.id)
        self.assertIsNotNone(en.id)

    def test_C16_renovar_conserva_la_anterior_hasta_confirmar_o_5_dias(self):
        e = self.anadir(contrasena='Anterior-Aa1!xx')
        self.caja.renovar(e.id, 'Nueva-Bb2!yy')
        self.assertEqual(self.caja.contrasena_anterior(e.id), 'Anterior-Aa1!xx')
        self.reloj.avanzar(days=4, hours=23)
        self.assertEqual(self.caja.contrasena_anterior(e.id), 'Anterior-Aa1!xx')
        self.reloj.avanzar(hours=2)
        self.assertIsNone(self.caja.contrasena_anterior(e.id))

    def test_C16_confirmar_descarta_la_anterior(self):
        e = self.anadir(contrasena='Anterior-Aa1!xx')
        self.caja.renovar(e.id, 'Nueva-Bb2!yy')
        self.caja.confirmar_renovacion(e.id)
        self.assertIsNone(self.caja.contrasena_anterior(e.id))
        self.assertEqual(self.caja.ver(e.id), 'Nueva-Bb2!yy')

    def test_C17_avisa_de_contrasena_repetida_y_usuario_repetido(self):
        self.anadir(sitio='A', usuario='uno@example.com', contrasena='Misma-Aa1!xxxx')
        self.anadir(sitio='B', usuario='dos@example.com', contrasena='Misma-Aa1!xxxx')
        self.anadir(sitio='C', usuario='tres@example.com', contrasena='Unica-Bb2!yyyy')
        self.anadir(sitio='C', usuario='tres@example.com', contrasena='Otra-Cc3!zzzz')
        tipos = {(a.tipo, tuple(sorted(a.sitios))) for a in self.caja.avisos_duplicados()}
        self.assertIn(('contrasena_repetida', ('A', 'B')), tipos)
        self.assertIn(('usuario_repetido', ('C', 'C')), tipos)

    def test_C18_sin_maestra_ni_clave_no_hay_forma_de_abrir(self):
        from gestor.errores import AccesoDenegado
        self.anadir()
        self.caja.cerrar()
        with self.assertRaises(AccesoDenegado):
            self.app.abrir_caja(self.sesion, 'maestra-equivocada')
        with self.assertRaises(AccesoDenegado):
            self.app.abrir_caja_emergencia(self.sesion, 'clave-equivocada')
        for nombre in ('recuperar', 'restablecer_maestra', 'recuperar_caja'):
            self.assertFalse(hasattr(self.app, nombre))

    def test_C18_con_la_clave_de_emergencia_se_recupera_el_acceso(self):
        self.anadir(sitio='Banco Ejemplo')
        clave = self.caja.generar_clave_emergencia()
        self.caja.confirmar_clave_emergencia()
        self.caja.cerrar()
        caja = self.app.abrir_caja_emergencia(self.sesion, clave)
        self.assertEqual([e.sitio for e in caja.listar()], ['Banco Ejemplo'])

    def test_C19_tras_la_baja_la_caja_se_conserva_30_dias_y_luego_se_borra(self):
        self.anadir()
        self.app.dar_de_baja(self.sesion)
        self.reloj.avanzar(days=29)
        self.app.purgar_bajas()
        self.assertTrue(self.almacen.existe_caja(USUARIO1))
        self.reloj.avanzar(days=2)
        self.app.purgar_bajas()
        self.assertFalse(self.almacen.existe_caja(USUARIO1))


class TestSeguridad(BaseTest):
    def test_C20_sin_sso_o_sin_maestra_no_se_muestra_ningun_dato(self):
        from gestor.errores import AccesoDenegado
        self.anadir(sitio='Banco Ejemplo')
        self.caja.cerrar()
        with self.assertRaises(AccesoDenegado):
            self.app.iniciar_sesion('token-falso')
        with self.assertRaises(AccesoDenegado):
            self.app.abrir_caja(self.sesion, 'maestra-equivocada')
        with self.assertRaises(AccesoDenegado):
            self.caja.listar()  # caja cerrada

    def test_C20_otro_usuario_no_ve_mis_datos(self):
        from gestor.errores import AccesoDenegado
        self.anadir(sitio='Banco Ejemplo')
        s2 = self.app.iniciar_sesion('token-2')
        with self.assertRaises(AccesoDenegado):
            self.app.abrir_caja(s2, MAESTRA)  # ni siquiera tiene caja

    def test_C21_lo_guardado_esta_cifrado_y_la_maestra_no_se_guarda(self):
        self.anadir(contrasena='TextoClaro-Aa1!xx')
        self.assertEqual(self.caja.listar()[0].sitio, 'Sitio Ejemplo')
        volcado = self.almacen.volcado()
        self.assertNotIn(b'TextoClaro-Aa1!xx', volcado)
        self.assertNotIn(MAESTRA.encode(), volcado)
        self.caja.cerrar()
        self.app.abrir_caja(self.sesion, MAESTRA)  # sigue abriendo con la maestra

    def test_C22_las_contrasenas_no_quedan_en_el_navegador(self):
        from gestor import web
        c = web.cabeceras_respuesta()
        self.assertIn('no-store', c.get('Cache-Control', ''))
        self.assertIn('autocomplete="new-password"', web.campo_contrasena_html('contrasena'))
        self.assertNotIn('value="', web.campo_contrasena_html('contrasena'))

    def test_C23_ninguna_exportacion_contiene_contrasenas_ni_la_clave(self):
        import io
        import zipfile
        e = self.anadir(contrasena='NoExportar-Aa1!xx')
        clave = self.caja.generar_clave_emergencia()
        xlsx = self.caja.exportar_excel()
        z = zipfile.ZipFile(io.BytesIO(xlsx))
        todo = b''.join(z.read(n) for n in z.namelist())
        ics = self.caja.exportar_ics()
        self.assertNotIn(b'NoExportar-Aa1!xx', todo)
        self.assertNotIn('NoExportar-Aa1!xx', ics)
        self.assertNotIn(clave.encode(), todo)
        self.assertNotIn(clave, ics)
        self.assertNotIn(clave, repr(self.caja.registro()))
        self.assertFalse(hasattr(self.app, 'enviar_correo'))
        self.assertIsNotNone(e.id)


class TestLimite(BaseTest):
    def test_C24_renovar_varias_admite_15_y_rechaza_16_sin_modificar(self):
        from gestor.errores import LimiteExcedido
        ids = [self.anadir(sitio='S%d' % i, contrasena='Vieja-%02d-Aa1!xx' % i).id for i in range(16)]
        antes = [self.caja.ver(i) for i in ids]
        with self.assertRaises(LimiteExcedido):
            self.caja.renovar_varias(ids, confirmar=True)
        self.assertEqual([self.caja.ver(i) for i in ids], antes)
        informe = self.caja.renovar_varias(ids[:15], confirmar=True)
        self.assertEqual(informe.cambios, 15)

    def test_C25_margen_de_deshacer_de_20_segundos(self):
        from gestor.errores import DeshacerNoDisponible
        e = self.anadir(contrasena='Anterior-Aa1!xx')
        self.caja.actualizar(e.id, contrasena='Nueva-Bb2!yy')
        self.reloj.avanzar(seconds=21)
        with self.assertRaises(DeshacerNoDisponible):
            self.caja.deshacer()
        self.assertEqual(self.caja.ver(e.id), 'Nueva-Bb2!yy')

    def test_C26_el_registro_se_conserva_12_meses(self):
        self.anadir(sitio='Antiguo')
        self.reloj.avanzar(days=200)
        self.anadir(sitio='Reciente')
        self.reloj.avanzar(days=170)  # el primero tiene 370 dias; el segundo, 170
        fechas = [r['fecha'] for r in self.caja.registro() if r['accion'] == 'alta']
        self.assertEqual(len(fechas), 1)
        self.assertGreater(fechas[0].date(), date(2026, 1, 15))
