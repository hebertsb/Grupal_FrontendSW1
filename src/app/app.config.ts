import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { rutas } from './app.routes';
import { jwtInterceptor } from './nucleo/interceptores/jwt.interceptor';
import { cacheInterceptor } from './nucleo/interceptores/cache.interceptor';

export const configuracionApp: ApplicationConfig = {
  providers: [
    provideRouter(rutas, withComponentInputBinding(), withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([jwtInterceptor, cacheInterceptor])),
    provideAnimations(),
  ]
};
