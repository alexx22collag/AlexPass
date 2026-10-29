"""Envoltorio: ejecuta los tests de JavaScript (tests/js, con node --test) dentro de unittest,
porque el comando de tests que fija IT en config/politica.json es de Python.
Los criterios C1-C30 se comprueban en tests/js/*.test.mjs; cada test lleva el id del criterio en su nombre."""
import os
import subprocess
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))


class TestJavaScript(unittest.TestCase):
    def test_suite_javascript(self):
        try:
            p = subprocess.run(['node', '--test', 'tests/js/*.test.mjs'], capture_output=True, text=True,
                               timeout=600, cwd=os.path.join(AQUI, '..'))
        except FileNotFoundError:
            self.fail('Hace falta Node.js (version 20 o superior) para ejecutar los tests.')
        self.assertEqual(p.returncode, 0, (p.stdout + p.stderr)[-3000:])
