import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  getCountFromServer, 
  getDoc,
  increment
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { enviarNotificacionPush } from './notificationService';
import { enviarCorreoSancion } from './emailService';


export const obtenerSolicitudesRegistro = async () => {
  try {
    // 1. Buscar en Clientes pendientes
    const qClientes = query(collection(db, 'clientes'), where('estadoCuenta', '==', 'pendiente'));
    const snapClientes = await getDocs(qClientes);
    
    // 2. Buscar en Alqui-Amigos pendientes
    const qAmigos = query(collection(db, 'alqui-amigos'), where('estadoCuenta', '==', 'pendiente'));
    const snapAmigos = await getDocs(qAmigos);

    const lista: any[] = [];

    snapClientes.forEach(doc => lista.push({ ...doc.data(), id: doc.id, coleccion: 'clientes' }));
    snapAmigos.forEach(doc => lista.push({ ...doc.data(), id: doc.id, coleccion: 'alqui-amigos' }));

    return lista;
  } catch (error) {
    console.error("Error obteniendo registros:", error);
    return [];
  }
};

export const gestionarUsuario = async (id: string, coleccion: string, accion: 'aceptar' | 'rechazar') => {
  try {
    const userRef = doc(db, coleccion, id);
    
    await updateDoc(userRef, {
      activo: accion === 'aceptar',
      estadoCuenta: accion === 'aceptar' ? 'aceptada' : 'rechazada'
    });
    
    // AQUÍ PODRÍAS AGREGAR LÓGICA PARA ENVIAR EMAIL (Requiere Cloud Functions o servicio externo)
    
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
};

export const obtenerResumen = async () => {
  try {
    // Contar Alqui-Amigos Activos
    const qAmigos = query(collection(db, 'alqui-amigos'), where('activo', '==', true));
    const snapAmigos = await getCountFromServer(qAmigos);

    // Contar Clientes Activos
    const qClientes = query(collection(db, 'clientes'), where('activo', '==', true));
    const snapClientes = await getCountFromServer(qClientes);

    return {
      alquiAmigos: snapAmigos.data().count,
      clientes: snapClientes.data().count
    };
  } catch (error) {
    return { alquiAmigos: 0, clientes: 0 };
  }
};

export const obtenerDenunciasPendientes = async () => {
  try {
    // 1. Traer solo denuncias pendientes
    const q = query(collection(db, 'denuncias'), where('estado', '==', 'pendiente'));
    const snapshot = await getDocs(q);
    
    const listaReportes: any[] = [];

    // 2. Por cada denuncia, buscar los datos del Alqui-Amigo acusado
    await Promise.all(
      snapshot.docs.map(async (document) => {
        const dataDenuncia = document.data();
        let alquiAmigoData = {
          nombres: 'Usuario Eliminado',
          fotoURL: '',
          faltas: 0 // Campo nuevo que asumimos existirá
        };

        try {
          const amigoRef = doc(db, 'alqui-amigos', dataDenuncia.alqui_amigo_id);
          const amigoSnap = await getDoc(amigoRef);
          if (amigoSnap.exists()) {
            const d = amigoSnap.data();
            alquiAmigoData = {
              nombres: d.nombres,
              fotoURL: d.fotoURL,
              faltas: d.faltas || 0 // Si no tiene faltas, es 0
            };
          }
        } catch (e) {
          console.error("Error buscando alqui-amigo denunciado", e);
        }

        listaReportes.push({
          id: document.id, // ID de la denuncia
          ...dataDenuncia,
          datosAcusado: alquiAmigoData
        });
      })
    );

    return listaReportes;
  } catch (error) {
    console.error("Error obteniendo denuncias:", error);
    return [];
  }
};

export const resolverDenuncia = async (
  denunciaId: string, 
  alquiAmigoId: string, 
  accionSolicitada: 'strike' | 'ban'
) => {
  try {
    const denunciaRef = doc(db, 'denuncias', denunciaId);
    const alquiAmigoRef = doc(db, 'alqui-amigos', alquiAmigoId);

    //Obtenemos los dato sdel usuario para ver sus faltas y token
    const usuarioSnap = await getDoc(alquiAmigoRef);
    if (!usuarioSnap.exists()) return { success: false, error: 'Usuario no encontrado' };
    
    const usuarioData = usuarioSnap.data();
    const faltasActuales = usuarioData.faltas || 0;
    const emailUsuario = usuarioData.email;
    const pushToken = usuarioData.pushToken;
    const nombreUsuario = usuarioData.nombres;

    //Determinar la acción final
    let accionFinal = accionSolicitada;
    let nuevasFaltas = faltasActuales;

    // Si es strike, calculamos si llegamos al límite
    if (accionSolicitada === 'strike') {
      nuevasFaltas = faltasActuales + 1;
      if (nuevasFaltas >= 3) {
        accionFinal = 'ban'; //AUTOMÁTICAMENTE SE VUELVE BAN
      }
    }

    //Actualizar la Denuncia
    await updateDoc(denunciaRef, {
      estado: 'revisada',
      accionTomada: accionFinal
    });

    //Aplicar castigo al usuario en BD
    if (accionFinal === 'ban') {
      // Baneo definitivo
      await updateDoc(alquiAmigoRef, {
        activo: false,
        estadoCuenta: 'bloqueada',
        faltas: nuevasFaltas
      });
    } else {
      // Solo sumar falta
      await updateDoc(alquiAmigoRef, {
        faltas: increment(1)
      });
    }

    //NOTIFICACIONES (Email y Push)
    
    //Enviar Notificación Push (Si tiene token)
    if (pushToken) {
      if (accionFinal === 'ban') {
        await enviarNotificacionPush(pushToken, "Cuenta Suspendida", "Has acumulado 3 faltas. Tu cuenta ha sido bloqueada permanentemente.");
      } else {
        await enviarNotificacionPush(pushToken, "Atención: Nueva Falta", `Has recibido una falta. Llevas ${nuevasFaltas}/3.`);
      }
    }

    //Enviar Correo Electrónico
    if (emailUsuario) {
      await enviarCorreoSancion(emailUsuario, nombreUsuario, accionFinal, nuevasFaltas);
    }

    return { success: true, accionAplicada: accionFinal };

  } catch (error) {
    console.error("Error resolviendo denuncia:", error);
    return { success: false, error };
  }
};
