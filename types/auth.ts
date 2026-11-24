export type RolUsuario = "admin" | "cliente" | "caja";

export type EstadoCuenta = "pendiente" | "activa" | "rechazada";

export type TipoPersona = "persona" | "empresa";

export type TipoCuentaCliente = "generico" | "descuento_especial";

export type PerfilCliente = {
  tipoPersona: TipoPersona;
  tipoLocal: string;
  productosInteres: string;
  direccion: string;
  /** Otras direcciones que el cliente cargó al pedir. */
  direcciones?: string[];
  telefono: string;
  horarioAtencion: string;
  deseaAsesor: boolean;
  franjaReparto?: "manana" | "tarde";
  fotoPerfil?: string;
  codigo?: string;
  apellido?: string;
  /** Fecha AAAA-MM-DD. */
  cumpleanos?: string;
  /** CUIT o DNI. */
  documento?: string;
  /** Porcentaje propio de esta ficha. En caja reemplaza al descuento general. */
  descuento?: number;
};

export type SesionPublica = {
  email: string;
  nombre: string;
  rol: RolUsuario;
  tipoCuenta?: TipoCuentaCliente;
  /** Descuento propio de la ficha. En el catálogo reemplaza al general. */
  descuento?: number;
};

export type Usuario = SesionPublica & {
  id: string;
  passwordHash: string;
  estado: EstadoCuenta;
  perfil?: PerfilCliente;
  tipoCuenta?: TipoCuentaCliente;
  /** Crédito de mercadería, aparte del tipo de cuenta. */
  creditoMercaderia?: boolean;
  notaInterna?: string;
  /** Partes del menú de caja. Si no está, un empleado ve todo menos Deudas. */
  permisosCaja?: string[];
  creadoEn: string;
};

export type UsuarioPublico = Omit<Usuario, "passwordHash">;
