import { Injectable, signal } from '@angular/core';

type Tema = 'oscuro' | 'claro';
const CLAVE_TEMA = 'sivic_tema';

@Injectable({ providedIn: 'root' })
export class TemaServicio {
  readonly temaActual = signal<Tema>('oscuro');

  aplicarTemaGuardado() {
    const guardado = (localStorage.getItem(CLAVE_TEMA) as Tema) ?? 'oscuro';
    this._aplicar(guardado);
  }

  alternar() {
    const nuevo: Tema = this.temaActual() === 'oscuro' ? 'claro' : 'oscuro';
    this._aplicar(nuevo);
    localStorage.setItem(CLAVE_TEMA, nuevo);
  }

  private _aplicar(tema: Tema) {
    const body = document.body;
    if (tema === 'claro') {
      body.classList.add('tema-claro');
    } else {
      body.classList.remove('tema-claro');
    }
    this.temaActual.set(tema);
  }
}
