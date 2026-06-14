import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { rutas } from './app.routes';
import { jwtInterceptor } from './nucleo/interceptores/jwt.interceptor';

export const configuracionApp: ApplicationConfig = {
  providers: [
    provideRouter(rutas, withComponentInputBinding()),
    provideHttpClient(withInterceptors([jwtInterceptor])),
    provideAnimations(),
  ]
};
