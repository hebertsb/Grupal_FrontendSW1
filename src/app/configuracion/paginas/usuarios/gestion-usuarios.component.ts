import { Component, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CabeceraComponent } from '../../../compartido/componentes/cabecera/cabecera.component';
import { entorno } from '../../../../environments/environment';
import { Usuario } from '../../../compartido/modelos/usuario.modelo';

@Component({
  selector: 'app-gestion-usuarios',
  standalone: true,
  imports: [CabeceraComponent],
  templateUrl: './gestion-usuarios.component.html',
  styleUrl: './gestion-usuarios.component.scss',
})
export class GestionUsuariosComponent implements OnInit {
  readonly usuarios  = signal<Usuario[]>([]);
  readonly cargando  = signal(true);

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get<Usuario[]>(`${entorno.apiUrl}/condominios/usuarios/`).subscribe({
      next:  lista => { this.usuarios.set(lista); this.cargando.set(false); },
      error: ()    => this.cargando.set(false),
    });
  }
}
