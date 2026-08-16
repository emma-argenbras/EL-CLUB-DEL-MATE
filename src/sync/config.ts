/**
 * Config minima de la nube, sin importar el SDK de Firebase (que pesa
 * bastante). Se puede consultar desde cualquier pantalla sin costo:
 * el SDK real recien se descarga si esto da true (ver sync/motor.ts).
 */
export const nubeConfigurada = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID &&
    import.meta.env.VITE_FIREBASE_APP_ID,
)

export const ID_NEGOCIO = 'el-club-del-mate'
