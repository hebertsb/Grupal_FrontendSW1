export type RolUsuario = 'admin' | 'guardia';

export interface Usuario {
  usuario_id: number;
  nombre: string;
  email: string;
  rol: RolUsuario;
  created_at?: string;
}

export interface SesionUsuario {
  usuario: Usuario;
  access: string;
}

export interface CredencialesLogin {
  email: string;
  password: string;
}

export interface DatosRegistro {
  nombre:   string;
  email:    string;
  password: string;
  rol:      RolUsuario;
}
