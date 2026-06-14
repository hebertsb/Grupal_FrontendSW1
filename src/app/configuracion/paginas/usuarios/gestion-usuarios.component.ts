import { Component, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CabeceraComponent } from '../../../compartido/componentes/cabecera/cabecera.component';
import { entorno } from '../../../../environments/environment';
import { Usuario, RolUsuario } from '../../../compartido/modelos/usuario.modelo';

interface FormUsuario {
  nombre:   string;
  email:    string;
  password: string;
  rol:      RolUsuario;
}

@Component({
  selector: 'app-gestion-usuarios',
  standalone: true,
  imports: [CabeceraComponent, FormsModule],
  templateUrl: './gestion-usuarios.component.html',
  styleUrl: './gestion-usuarios.component.scss',
})
export class GestionUsuariosComponent implements OnInit {
  readonly usuarios     = signal<Usuario[]>([]);
  readonly cargando     = signal(true);
  readonly guardando    = signal(false);
  readonly error        = signal('');
  readonly modalAbierto = signal(false);
  readonly editando     = signal<Usuario | null>(null);

  form: FormUsuario = { nombre: '', email: '', password: '', rol: 'guardia' };

  constructor(private http: HttpClient) {}

  ngOnInit() { this._cargar(); }

  private _cargar() {
    this.cargando.set(true);
    this.http.get<Usuario[]>(`${entorno.apiUrl}/auth/usuarios/`).subscribe({
      next:  lista => { this.usuarios.set(lista); this.cargando.set(false); },
      error: ()    => this.cargando.set(false),
    });
  }

  abrirCrear() {
    this.editando.set(null);
    this.form = { nombre: '', email: '', password: '', rol: 'guardia' };
    this.error.set('');
    this.modalAbierto.set(true);
  }

  abrirEditar(u: Usuario) {
    this.editando.set(u);
    this.form = { nombre: u.nombre, email: u.email, password: '', rol: u.rol };
    this.error.set('');
    this.modalAbierto.set(true);
  }

  cerrarModal() { this.modalAbierto.set(false); }

  guardar() {
    if (!this.form.nombre.trim() || !this.form.email.trim()) return;
    this.guardando.set(true);
    this.error.set('');

    const u   = this.editando();
    const url = u
      ? `${entorno.apiUrl}/auth/usuarios/${u.usuario_id}/`
      : `${entorno.apiUrl}/auth/usuarios/`;
    const req = u
      ? this.http.patch<Usuario>(url, this.form)
      : this.http.post<Usuario>(url, this.form);

    req.subscribe({
      next: () => { this.guardando.set(false); this.cerrarModal(); this._cargar(); },
      error: (e) => { this.error.set(e.error?.error ?? 'Error al guardar'); this.guardando.set(false); },
    });
  }

  eliminar(u: Usuario) {
    if (!confirm(`¿Eliminar a "${u.nombre}"? Esta acción no se puede deshacer.`)) return;
    this.http.delete(`${entorno.apiUrl}/auth/usuarios/${u.usuario_id}/`).subscribe({
      next: () => this._cargar(),
    });
  }
}
