import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AutenticacionServicio } from '../../compartido/servicios/autenticacion.servicio';

export const guardAutenticacion: CanActivateFn = () => {
  const auth   = inject(AutenticacionServicio);
  const router = inject(Router);

  if (auth.estaAutenticado()) return true;

  return router.createUrlTree(['/login']);
};
