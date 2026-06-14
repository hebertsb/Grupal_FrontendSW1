import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BarraLateralComponent } from '../barra-lateral/barra-lateral.component';

@Component({
  selector: 'app-diseno-principal',
  standalone: true,
  imports: [RouterOutlet, BarraLateralComponent],
  templateUrl: './diseno-principal.component.html',
  styleUrl: './diseno-principal.component.scss',
})
export class DiseñoPrincipalComponent {}
