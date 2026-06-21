import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AutenticacionServicio } from '../../compartido/servicios/autenticacion.servicio';

export const redirectPorRolGuard: CanActivateFn = () => {
  const auth   = inject(AutenticacionServicio);
  const router = inject(Router);
  if (auth.esSuperAdmin()) return router.createUrlTree(['/superadmin']);
  if (auth.esAdmin())      return router.createUrlTree(['/dashboard']);
  return router.createUrlTree(['/guardia']);
};
