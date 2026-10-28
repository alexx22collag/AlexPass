#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Hook UserPromptSubmit de Claude Code.

1) Guarda el ultimo mensaje del usuario en .claude/ultimo_prompt.txt para que el guardia pueda comprobar
   que una aprobacion la escribio el usuario y no Claude.
2) Si el mensaje parece contener una credencial, avisa a Claude (lo que se imprime llega como contexto).
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from scan_secretos import contiene_secreto


def main():
    try:
        datos = json.load(sys.stdin)
    except Exception:
        sys.exit(0)
    prompt = datos.get('prompt') or datos.get('user_prompt') or datos.get('message') or ''
    if not isinstance(prompt, str):
        prompt = ''
    try:
        d = lib.ruta('.claude')
        d.mkdir(parents=True, exist_ok=True)
        (d / 'ultimo_prompt.txt').write_text(prompt, encoding='utf-8', newline='\n')
    except OSError:
        pass
    nombre = contiene_secreto(prompt)
    if nombre:
        print('AVISO DE SEGURIDAD [R-03]: el mensaje del usuario parece contener una credencial (%s). '
              'No la uses, no la guardes y no la repitas. Dile que la rote o avise a IT y que no la vuelva a pegar. '
              'Las conexiones las pone IT.' % nombre)
    sys.exit(0)


if __name__ == '__main__':
    main()
