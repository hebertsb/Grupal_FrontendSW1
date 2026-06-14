import { Component, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { entorno } from '../../../../environments/environment';
import { CabeceraComponent } from '../../../compartido/componentes/cabecera/cabecera.component';

interface LogAuditoria {
  log_id:           number;
  usuario:          number;
  usuario_nombre:   string | null;
  accion:           string;
  tabla_afectada:   string;
  timestamp_accion: string;
}

@Component({
  selector: 'app-logs-auditoria',
  standalone: true,
  imports: [DatePipe, CabeceraComponent],
  templateUrl: './logs-auditoria.component.html',
  styleUrl: './logs-auditoria.component.scss',
})
export class LogsAuditoriaComponent implements OnInit {
  readonly logs     = signal<LogAuditoria[]>([]);
  readonly cargando = signal(true);

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get<LogAuditoria[]>(`${entorno.apiUrl}/auditoria/logs/`).subscribe({
      next:  lista => { this.logs.set(lista); this.cargando.set(false); },
      error: ()    => this.cargando.set(false),
    });
  }
}
