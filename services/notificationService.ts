import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Configuración: qué hacer si llega una notif mientras la app está abierta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true, // <--- REQUERIDO EN NUEVAS VERSIONES
    shouldShowList: true,   // <--- REQUERIDO EN NUEVAS VERSIONES
  }),
});

// 1. Obtener el Token del dispositivo (Permisos)
export async function registrarParaPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Permiso de notificaciones denegado');
      return;
    }

    // OBTENER TOKEN
    // El projectId se saca automáticamente de app.json (extra.eas.projectId)
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? (Constants?.manifest as any)?.extra?.eas?.projectId;
    
    try {
        const pushTokenData = await Notifications.getExpoPushTokenAsync({
            projectId: projectId,
        });
        token = pushTokenData.data;
        console.log("Token obtenido:", token);
    } catch (e) {
        console.error("Error obteniendo token:", e);
    }
  } else {
    console.log('Debes usar un dispositivo físico para probar notificaciones');
  }

  return token;
}

// 2. Función para ENVIAR notificación (Usando API de Expo)
export async function enviarNotificacionPush(expoPushToken: string, titulo: string, cuerpo: string, data: any = {}) {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title: titulo,
    body: cuerpo,
    data: data,
  };

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
  } catch (error) {
    console.error("Error enviando push:", error);
  }
}

export async function agendarRecordatorioLocal(
  titulo: string, 
  cuerpo: string, 
  segundosHastaElEvento: number
) {
  try {
    // Calculamos el momento del disparo (trigger)
    // Nota: seconds debe ser positivo. Si es negativo, la notificación falla o sale inmediato.
    if (segundosHastaElEvento <= 0) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: titulo,
        body: cuerpo,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: segundosHastaElEvento, // Expo cuenta en segundos desde "ahora"
      },
    });
    console.log(`⏰ Recordatorio agendado en ${segundosHastaElEvento} segundos`);
  } catch (error) {
    console.error("Error agendando recordatorio local:", error);
  }
}