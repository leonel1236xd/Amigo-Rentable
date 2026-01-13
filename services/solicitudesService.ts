import { 
    collection, 
    addDoc, 
    Timestamp, 
    doc, 
    getDoc 
  } from 'firebase/firestore';
  import { db } from '../config/firebase';
  import { enviarNotificacionPush } from './notificationService';
  
  // Interfaz basada en los campos necesarios para crear una nueva solicitud
  export interface NuevaSolicitud {
    cliente_id: string;
    alqui_amigo_id: string;
    nombre_solicitante: string;
    fotografia_solicitante: string;
    informacion_general_solicitante: string;
    fecha_salida: string; // Formato YYYY-MM-DD
    hora_salida: string;  // Formato HH:MM
    duracion: number;     // Horas
    lugar_asistir: string;
    detalles_de_la_salida: string; // Mensaje/Propósito
    // Campos automáticos
    estado_solicitud: 'pendiente' | 'aceptada' | 'rechazada';
    fecha_creacion: Timestamp;
  }
  
  export const enviarSolicitudServicio = async (datos: NuevaSolicitud) => {
    try {
      //Guardar solicitud en BD
      const docRef = await addDoc(collection(db, 'solicitudes'), {
        ...datos,
        fecha_creacion: Timestamp.now(),
      });
  
      
      try {
        
        const amigoRef = doc(db, 'alqui-amigos', datos.alqui_amigo_id);
        const amigoSnap = await getDoc(amigoRef);
  
        if (amigoSnap.exists()) {
          const amigoData = amigoSnap.data();
          const tokenDestino = amigoData.pushToken; // El campo que guardamos en el Login
  
          if (tokenDestino) {
            
            await enviarNotificacionPush(
              tokenDestino, // Token del alqui-amigo
              "¡Nueva Oportunidad! 💸", // Título
              `${datos.nombre_solicitante} quiere alquilar tu amistad para el ${datos.fecha_salida}.`, // Cuerpo
              { solicitudId: docRef.id } // Datos extra (útil para redirigir al tocar la notif)
            );
          }
        }
      } catch (notifError) {
        console.error("Error enviando push (no crítico):", notifError);
        
      }
      // ------------------------------------------------
  
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error("Error al crear solicitud:", error);
      return { success: false, error };
    }
  };