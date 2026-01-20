// services/emailService.ts

//CREDENCIALES
const EMAILJS_SERVICE_ID = "service_2ptdu7d"; 
const EMAILJS_TEMPLATE_ID = "template_voibff8"; 
const EMAILJS_PUBLIC_KEY = "98HcRhnLWyankTksd"; 

export const enviarCorreoAutomatico = async (
  destinatarioEmail: string, 
  nombreUsuario: string, 
  aceptado: boolean
) => {
  
  const mensaje = aceptado 
    ? `¡Felicidades ${nombreUsuario}! Tu cuenta en Amigo Rentable ha sido ACEPTADA. Ya puedes iniciar sesión y disfrutar de la plataforma.`
    : `Hola ${nombreUsuario}. Lamentamos informarte que tu solicitud de registro en Amigo Rentable ha sido RECHAZADA.`;

  const data = {
    service_id: EMAILJS_SERVICE_ID,
    template_id: EMAILJS_TEMPLATE_ID,
    user_id: EMAILJS_PUBLIC_KEY,
    template_params: {
      to_email: destinatarioEmail,
      to_name: nombreUsuario,
      message: mensaje,
      subject: aceptado ? "¡Bienvenido a Amigo Rentable!" : "Estado de tu solicitud",
    }
  };

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost' // Truco para evitar algunos bloqueos de CORS
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      console.log('Correo enviado con éxito (EmailJS)');
      return true;
    } else {
      const text = await response.text();
      console.error('Error EmailJS:', text);
      return false;
    }
  } catch (error) {
    console.error('Error de red EmailJS:', error);
    return false;
  }
};

export const enviarCodigoRecuperacion = async (
  destinatarioEmail: string, 
  codigo: string
) => {
  
  const mensaje = `Tu código de recuperación para Amigo Rentable es: ${codigo}. Por favor ingrésalo en la aplicación para restablecer tu contraseña.`;

  const data = {
    service_id: "service_2ptdu7d",      
    template_id: "template_voibff8",   
    user_id: "98HcRhnLWyankTksd",       
    template_params: {
      to_email: destinatarioEmail,
      to_name: "Usuario", // Nombre genérico o podrías buscarlo antes
      message: mensaje,
      subject: "Código de recuperación de contraseña",
    }
  };

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost' 
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      console.log('Código enviado con éxito');
      return true;
    } else {
      console.error('Error enviando código');
      return false;
    }
  } catch (error) {
    console.error('Error de red:', error);
    return false;
  }
};


export const enviarCorreoSancion = async (
  destinatarioEmail: string, 
  nombreUsuario: string, 
  tipo: 'strike' | 'ban',
  numeroFaltas: number
) => {
  
  let asunto = "";
  let mensaje = "";

  if (tipo === 'ban') {
    asunto = "Notificación de Suspensión de Cuenta - Amigo Rentable";
    mensaje = `Hola ${nombreUsuario}. Lamentamos informarte que tu cuenta ha sido SUSPENDIDA permanentemente debido a que has acumulado 3 faltas por denuncias validadas. Ya no podrás acceder a la plataforma.`;
  } else {
    asunto = `Aviso de Falta (${numeroFaltas}/3) - Amigo Rentable`;
    mensaje = `Hola ${nombreUsuario}. Se ha validado una denuncia en tu contra. Se te ha aplicado una falta. Tienes ${numeroFaltas} de 3 faltas permitidas. Al llegar a la tercera, tu cuenta será suspendida automáticamente.`;
  }

  const data = {
    service_id: "service_2ptdu7d",      
    template_id: "template_voibff8",   
    user_id: "98HcRhnLWyankTksd",     
    template_params: {
      to_email: destinatarioEmail,
      to_name: nombreUsuario,
      message: mensaje,
      subject: asunto,
    }
  };

  try {
    await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost' },
      body: JSON.stringify(data),
    });
    return true;
  } catch (error) {
    console.error('Error enviando correo sanción:', error);
    return false;
  }
};