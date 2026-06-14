import { Routes } from '@angular/router';
import { guardAutenticacion } from './nucleo/guardias/auth.guard';

export const rutas: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./autenticacion/paginas/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () => import('./compartido/componentes/diseno-principal/diseno-principal.component').then(m => m.DiseñoPrincipalComponent),
    canActivate: [guardAutenticacion],
    children: [
      {
        path: '',
        redirectTo: 'guardia',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/paginas/dashboard-admin/dashboard-admin.component').then(m => m.DashboardAdminComponent),
        title: 'SIVIC — Dashboard',
      },
      {
        path: 'camaras',
        loadComponent: () => import('./panel-camaras/paginas/panel-principal/panel-principal.component').then(m => m.PanelPrincipalComponent),
        title: 'SIVIC — Panel de Cámaras',
      },
      {
        path: 'eventos',
        loadComponent: () => import('./eventos/paginas/lista-eventos/lista-eventos.component').then(m => m.ListaEventosComponent),
        title: 'SIVIC — Eventos',
      },
      {
        path: 'configuracion/camaras',
        loadComponent: () => import('./configuracion/paginas/camaras/gestion-camaras.component').then(m => m.GestionCamarasComponent),
        title: 'SIVIC — Gestión de Cámaras',
      },
      {
        path: 'guardia',
        loadComponent: () => import('./guardia/paginas/dashboard-guardia/dashboard-guardia.component').then(m => m.DashboardGuardiaComponent),
        title: 'SIVIC — Centro de Seguridad',
      },
      {
        path: 'reglas',
        loadComponent: () => import('./configuracion/paginas/reglas/gestion-reglas.component').then(m => m.GestionReglasComponent),
        title: 'SIVIC — Reglas IA',
      },
      {
        path: 'configuracion/reglas',
        loadComponent: () => import('./configuracion/paginas/reglas/gestion-reglas.component').then(m => m.GestionReglasComponent),
        title: 'SIVIC — Reglas de Infracción',
      },
      {
        path: 'configuracion/usuarios',
        loadComponent: () => import('./configuracion/paginas/usuarios/gestion-usuarios.component').then(m => m.GestionUsuariosComponent),
        title: 'SIVIC — Usuarios',
      },
      {
        path: 'auditoria',
        loadComponent: () => import('./auditoria/paginas/logs/logs-auditoria.component').then(m => m.LogsAuditoriaComponent),
        title: 'SIVIC — Auditoría',
      },
    ],
  },
  { path: '**', redirectTo: 'camaras' },
];
