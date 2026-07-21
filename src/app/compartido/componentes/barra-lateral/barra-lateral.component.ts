import { Component, computed, inject, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AutenticacionServicio } from '../../servicios/autenticacion.servicio';

interface EnlaceNav {
  etiqueta:        string;
  icono:           string;
  ruta:            string;
  soloAdmin?:      boolean;
  soloSuperAdmin?: boolean;
  funcionalidad?:  string;   // funcionalidad del plan requerida para ver este ítem
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
    // ── Super Admin ───────────────────────────────────────────────────────────
    { etiqueta: 'Plataforma',         icono: 'admin_panel_settings',     ruta: '/superadmin',             soloSuperAdmin: true },
    { etiqueta: 'Condominios',        icono: 'apartment',                ruta: '/superadmin/condominios', soloSuperAdmin: true },
    { etiqueta: 'Planes',             icono: 'workspace_premium',        ruta: '/superadmin/planes',      soloSuperAdmin: true },
    { etiqueta: 'Todos los Usuarios', icono: 'group',                    ruta: '/superadmin/usuarios',    soloSuperAdmin: true },
    // ── Admin Condominio ──────────────────────────────────────────────────────
    { etiqueta: 'Dashboard',          icono: 'dashboard',                ruta: '/dashboard',              soloAdmin: true,  funcionalidad: 'panel_camaras'      },
    { etiqueta: 'Seguridad',          icono: 'shield',                   ruta: '/guardia',                soloAdmin: false                                       },
    { etiqueta: 'Cámaras',            icono: 'videocam',                 ruta: '/camaras',                                  funcionalidad: 'panel_camaras'      },
    { etiqueta: 'Alertas',            icono: 'notification_important',   ruta: '/eventos',                                  funcionalidad: 'alertas_basicas'    },
    { etiqueta: 'Reglas IA',          icono: 'rule',                     ruta: '/reglas',                                   funcionalidad: 'reglas_roi'         },
    { etiqueta: 'Config. Cámaras',    icono: 'settings_input_component', ruta: '/configuracion/camaras',  soloAdmin: true,  funcionalidad: 'panel_camaras'      },
    { etiqueta: 'Usuarios',           icono: 'manage_accounts',          ruta: '/configuracion/usuarios', soloAdmin: true,  funcionalidad: 'gestion_usuarios'   },
    { etiqueta: 'Vehículos',          icono: 'directions_car',            ruta: '/configuracion/vehiculos', soloAdmin: true                                        },
    { etiqueta: 'Auditoría',          icono: 'history',                  ruta: '/auditoria',              soloAdmin: true,  funcionalidad: 'auditoria'          },
    { etiqueta: 'Reportes IA',        icono: 'analytics',                ruta: '/reportes',               soloAdmin: true,  funcionalidad: 'reportes_ia'        },
    { etiqueta: 'Plano',              icono: 'map',                      ruta: '/plano',                  soloAdmin: true,  funcionalidad: 'plano_condominio'   },
  ];

  readonly enlacesFiltradosPorRol = computed(() => {
    return this.enlaces.filter(e => {
      // Items exclusivos del superadmin
      if (e.soloSuperAdmin === true) return this.auth.esSuperAdmin();

      // El superadmin no ve items de admin/guardia
      if (this.auth.esSuperAdmin()) return false;

      // Items solo para admin
      if (e.soloAdmin === true  && !this.auth.esAdmin()) return false;
      // Items solo para guardia
      if (e.soloAdmin === false &&  this.auth.esAdmin()) return false;

      // Filtro por funcionalidad del plan contratado
      if (e.funcionalidad) return this.auth.tieneFuncionalidad(e.funcionalidad);

      return true;
    });
  });

  readonly usuario = this.auth.usuarioActual;

  ngOnInit() {
    // Cierra el sidebar en móvil al navegar
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.cerrar.emit());
  }

  cerrarSesion() { this.auth.cerrarSesion(); }
}
