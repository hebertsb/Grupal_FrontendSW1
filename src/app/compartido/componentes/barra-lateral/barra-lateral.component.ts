import { Component, computed, inject, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
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
export class BarraLateralComponent implements OnInit {
  @Input()  abierto = false;
  @Output() cerrar  = new EventEmitter<void>();

  private auth   = inject(AutenticacionServicio);
  private router = inject(Router);

  readonly enlaces: EnlaceNav[] = [
    { etiqueta: 'Dashboard',       icono: 'dashboard',               ruta: '/dashboard',              soloAdmin: true  },
    { etiqueta: 'Seguridad',       icono: 'shield',                  ruta: '/guardia',                soloAdmin: false },
    { etiqueta: 'Cámaras',         icono: 'videocam',                ruta: '/camaras'                                  },
    { etiqueta: 'Alertas',         icono: 'notification_important',  ruta: '/eventos'                                  },
    { etiqueta: 'Reglas IA',       icono: 'rule',                    ruta: '/reglas'                                   },
    { etiqueta: 'Config. Cámaras', icono: 'settings_input_component', ruta: '/configuracion/camaras', soloAdmin: true  },
    { etiqueta: 'Usuarios',        icono: 'manage_accounts',         ruta: '/configuracion/usuarios', soloAdmin: true  },
    { etiqueta: 'Auditoría',       icono: 'history',                 ruta: '/auditoria',              soloAdmin: true  },
    { etiqueta: 'Reportes IA',    icono: 'analytics',               ruta: '/reportes',               soloAdmin: true  },
    { etiqueta: 'Plano',           icono: 'map',                     ruta: '/plano',                  soloAdmin: true  },
  ];

  readonly enlacesFiltradosPorRol = computed(() =>
    this.enlaces.filter(e => {
      if (e.soloAdmin === true)  return this.auth.esAdmin();
      if (e.soloAdmin === false) return !this.auth.esAdmin();
      return true;
    })
  );

  readonly usuario = this.auth.usuarioActual;

  ngOnInit() {
    // Cierra el sidebar en móvil al navegar
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.cerrar.emit());
  }

  cerrarSesion() { this.auth.cerrarSesion(); }
}
