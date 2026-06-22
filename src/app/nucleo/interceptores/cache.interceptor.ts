import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { tap } from 'rxjs/operators';

const _cache = new Map<string, { res: HttpResponse<unknown>; exp: number }>();
const TTL_MS = 30_000; // 30 segundos

const NO_CACHE = ['/auth/', '/analizar', '/stream/', '/ultimo_frame/', '/reportes/'];

export const cacheInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET') return next(req);
  if (NO_CACHE.some(p => req.url.includes(p))) return next(req);

  const key = req.urlWithParams;
  const cached = _cache.get(key);
  if (cached && Date.now() < cached.exp) {
    return of(cached.res.clone());
  }

  return next(req).pipe(
    tap(event => {
      if (event instanceof HttpResponse && event.status === 200) {
        _cache.set(key, { res: event.clone(), exp: Date.now() + TTL_MS });
      }
    }),
  );
};
