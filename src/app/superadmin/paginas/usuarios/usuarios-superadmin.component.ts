import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CabeceraComponent } from '../../../compartido/componentes/cabecera/cabecera.component';
import { entorno } from '../../../../environments/environment';

interface Usuario {
  usuario_id:        number;
  nombre:            string;
  email:             string;
  rol:               string;
  condominio:        number | null;
  condominio_nombre: string | null;
}

@Component({
  selector: 'app-usuarios-superadmin',
  standalone: true,
  imports: [RouterLink, CabeceraComponent, FormsModule],
  templateUrl: './usuarios-superadmin.component.html',
  styleUrl: './usuarios-superadmin.component.scss',
})
export class UsuariosSuperAdminComponent implements OnInit {
  private http = inject(HttpClient);

  readonly cargando  = signal(true);
  readonly usuarios  = signal<Usuario[]>([]);
  readonly filtroRol = signal<string>('admin');

  readonly usuariosFiltrados = computed(() => {
    const rol = this.filtroRol();
    return rol ? this.usuarios().filter(u => u.rol === rol) : this.usuarios();
  });

  ngOnInit() {
    this.http.get<Usuario[]>(`${entorno.apiUrl}/auth/usuarios/`).subscribe({
      next: u => {
        // excluir superadmin propio de la lista operativa
        this.usuarios.set(u.filter(x => x.rol !== 'superadmin'));
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  colorRol(rol: string): string {
    if (rol === 'superadmin') return 'var(--peligro)';
    if (rol === 'admin')      return 'var(--primario)';
    return 'var(--exito)';
  }

  etiquetaRol(rol: string): string {
    const mapa: Record<string, string> = {
      superadmin: 'Super Admin',
      admin:      'Admin',
      guardia:    'Guardia',
    };
    return mapa[rol] ?? rol;
  }
}
