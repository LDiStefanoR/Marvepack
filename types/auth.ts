export type RolUsuario = "admin" | "cliente";

export type EstadoCuenta = "pendiente" | "activa" | "rechazada";

export type TipoPersona = "persona" | "empresa";

export type PerfilCliente = {
  tipoPersona: TipoPersona;
  tipoLocal: string;
  productosInteres: string;
  direccion: string;
  telefono: string;
  horarioAtencion: string;
  deseaAsesor: boolean;
};

export type SesionPublica = {
  email: string;
  nombre: string;
  rol: RolUsuario;
};

export type Usuario = SesionPublica & {
  id: string;
  passwordHash: string;
  estado: EstadoCuenta;
  perfil?: PerfilCliente;
  creadoEn: string;
};

export type UsuarioPublico = Omit<Usuario, "passwordHash">;
