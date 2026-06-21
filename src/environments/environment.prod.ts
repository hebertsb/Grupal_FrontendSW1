// DEPLOY: cambiar IP_EC2 por la IP pública del EC2 antes de hacer ng build
// Ejemplo: http://54.123.45.67/api
// NO commitear con la IP real (es temporal para la defensa)
export const entorno = {
  produccion: true,
  apiUrl: 'http://IP_EC2/api',
  wsUrl:  'ws://IP_EC2',
};
