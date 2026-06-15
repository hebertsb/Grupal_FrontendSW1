import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AutenticacionServicio } from '../../compartido/servicios/autenticacion.servicio';

export const redirectPorRolGuard: CanActivateFn = () => {
  const auth   = inject(AutenticacionServicio);
  const router = inject(Router);
  return router.createUrlTree([auth.esAdmin() ? '/dashboard' : '/guardia']);
};
