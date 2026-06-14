import { bootstrapApplication } from '@angular/platform-browser';
import { ComponenteRaiz } from './app/app.component';
import { configuracionApp } from './app/app.config';

bootstrapApplication(ComponenteRaiz, configuracionApp)
  .catch(err => console.error(err));
