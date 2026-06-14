import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TemaServicio } from './compartido/servicios/tema.servicio';

@Component({
  selector: 'app-raiz',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class ComponenteRaiz implements OnInit {
  constructor(private tema: TemaServicio) {}

  ngOnInit() {
    this.tema.aplicarTemaGuardado();
  }
}
