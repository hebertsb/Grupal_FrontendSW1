import { Component, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { entorno } from '../../../../environments/environment';
import { CabeceraComponent } from '../../../compartido/componentes/cabecera/cabecera.component';

interface LogAuditoria {
  log_id:     number;
  usuario_id: number;
  accion:     string;
  tabla:      string;
  registro_id?: number;
  detalle?:   string;
  created_at: string;
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
    this.http.get<LogAuditoria[]>(`${entorno.apiUrl}/auditoria/`).subscribe({
      next:  lista => { this.logs.set(lista); this.cargando.set(false); },
      error: ()    => this.cargando.set(false),
    });
  }
}
