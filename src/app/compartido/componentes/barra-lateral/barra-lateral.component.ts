import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AutenticacionServicio } from '../../servicios/autenticacion.servicio';

interface EnlaceNav {
  etiqueta: string;
  icono:    string;
  ruta:     string;
  soloAdmin?: boolean;
}

@Component({
  selector: 'app-barra-lateral',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './barra-lateral.component.html',
  styleUrl: './barra-lateral.component.scss',
})
export class BarraLateralComponent {
  private auth = inject(AutenticacionServicio);

  readonly enlaces: EnlaceNav[] = [
    { etiqueta: 'Dashboard',   icono: 'dashboard',               ruta: '/dashboard',               soloAdmin: true },
    { etiqueta: 'Seguridad',   icono: 'shield',                  ruta: '/guardia',                 soloAdmin: false },
    { etiqueta: 'Cámaras',     icono: 'videocam',                ruta: '/camaras' },
    { etiqueta: 'Alertas',     icono: 'notification_important',  ruta: '/eventos' },
    { etiqueta: 'Reglas IA',   icono: 'rule',                    ruta: '/reglas' },
    { etiqueta: 'Config. Cámaras', icono: 'settings_input_component', ruta: '/configuracion/camaras', soloAdmin: true },
    { etiqueta: 'Usuarios',    icono: 'manage_accounts',         ruta: '/configuracion/usuarios',  soloAdmin: true },
    { etiqueta: 'Auditoría',   icono: 'history',                 ruta: '/auditoria',              soloAdmin: true },
  ];

  readonly enlacesFiltradosPorRol = computed(() =>
    this.enlaces.filter(e => {
      if (e.soloAdmin === true)  return this.auth.esAdmin();
      if (e.soloAdmin === false) return !this.auth.esAdmin();
      return true;
    })
  );

  readonly enlacesFiltrados = computed(() =>
    this.enlaces.filter(e => !e.soloAdmin || this.auth.esAdmin())
  );

  readonly usuario = this.auth.usuarioActual;

  cerrarSesion() { this.auth.cerrarSesion(); }
}
