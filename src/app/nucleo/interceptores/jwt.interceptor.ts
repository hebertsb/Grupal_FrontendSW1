import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AutenticacionServicio } from '../../compartido/servicios/autenticacion.servicio';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth  = inject(AutenticacionServicio);
  const token = auth.obtenerToken();

  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }
  return next(req);
};
