import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { verificarCorreoExistente, enviarResetPasswordFirebase } from '../../services/authService';
import { enviarCodigoRecuperacion } from '../../services/emailService';

// --- COMPONENTE MODAL ---
interface ModalMensajeProps {
  visible: boolean;
  titulo: string;
  mensaje: string;
  tipo: 'exito' | 'error';
  onClose: () => void;
}

const ModalMensaje: React.FC<ModalMensajeProps> = ({ visible, titulo, mensaje, tipo, onClose }) => {
  const colorFondo = tipo === 'exito' ? '#007BFF' : '#DC3545';
  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalIconContainer, { backgroundColor: colorFondo }]}>
            <Feather name={tipo === 'exito' ? 'check' : 'x'} size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.modalTitulo}>{titulo}</Text>
          <Text style={styles.modalMensaje}>{mensaje}</Text>
          <TouchableOpacity style={[styles.modalBoton, { backgroundColor: colorFondo }]} onPress={onClose}>
            <Text style={styles.modalBotonTexto}>Aceptar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default function RecuperarContrasenaScreen() {
  const router = useRouter();
  
  // Estados de datos
  const [tipoUsuario, setTipoUsuario] = useState<'cliente' | 'alqui-amigo'>('cliente');
  const [email, setEmail] = useState('');
  
  // Estados para el código de 4 dígitos
  const [codigoIngresado, setCodigoIngresado] = useState(['', '', '', '']);
  const [codigoGenerado, setCodigoGenerado] = useState<string | null>(null); // El código real enviado
  
  // Estados para contraseña nueva
  const [nuevaContrasena, setNuevaContrasena] = useState('');
  const [confirmarContrasena, setConfirmarContrasena] = useState('');
  const [mostrarPass, setMostrarPass] = useState(false);
  const [mostrarConfirmPass, setMostrarConfirmPass] = useState(false);

  // Estados de control de flujo
  const [cargando, setCargando] = useState(false);
  const [correoEnviado, setCorreoEnviado] = useState(false);
  const [codigoVerificado, setCodigoVerificado] = useState(false); // Habilita los inputs finales

  // Refs para los inputs del código (para saltar al siguiente automáticamente)
  const inputRefs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)];

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalDatos, setModalDatos] = useState({ titulo: '', mensaje: '', tipo: 'error' as 'exito' | 'error', accion: () => {} });

  const mostrarModal = (titulo: string, mensaje: string, tipo: 'exito' | 'error', accion?: () => void) => {
    setModalDatos({ titulo, mensaje, tipo, accion: accion || (() => {}) });
    setModalVisible(true);
  };

  const cerrarModal = () => {
    setModalVisible(false);
    if (modalDatos.accion) modalDatos.accion();
  };

  // 1. ENVIAR CÓDIGO
  const manejarEnvioCodigo = async () => {
    if (!email || !email.includes('@')) {
      mostrarModal('Correo inválido', 'Por favor ingresa un correo electrónico válido.', 'error');
      return;
    }

    setCargando(true);
    try {
      //Verificar si existe en la base de datos
      const existe = await verificarCorreoExistente(email.trim().toLowerCase(), tipoUsuario);
      
      if (!existe) {
        mostrarModal('Usuario no encontrado', `No encontramos una cuenta de ${tipoUsuario} asociada a este correo.`, 'error');
        setCargando(false);
        return;
      }

      //Generar Código (4 dígitos)
      const codigo = Math.floor(1000 + Math.random() * 9000).toString();
      setCodigoGenerado(codigo);
      console.log("Código generado (dev):", codigo); // Para pruebas

      //Enviar Correo
      const enviado = await enviarCodigoRecuperacion(email.trim(), codigo);

      if (enviado) {
        setCorreoEnviado(true);
        mostrarModal('Código Enviado', 'Revisa tu correo electrónico, te hemos enviado un código de 4 dígitos.', 'exito');
      } else {
        mostrarModal('Error de envío', 'Hubo un problema al enviar el correo. Intenta de nuevo.', 'error');
      }

    } catch (error) {
      mostrarModal('Error', 'Ocurrió un error inesperado.', 'error');
    } finally {
      setCargando(false);
    }
  };

  // 2. MANEJO DE INPUTS DE CÓDIGO
  const cambiarDigito = (text: string, index: number) => {
    const nuevoCodigo = [...codigoIngresado];
    nuevoCodigo[index] = text;
    setCodigoIngresado(nuevoCodigo);

    // Saltar al siguiente input si se escribe un número
    if (text && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    // Verificar automáticamente si se completaron los 4
    if (nuevoCodigo.join('').length === 4) {
      verificarCodigo(nuevoCodigo.join(''));
    }
  };

  const verificarCodigo = (codigoInput: string) => {
    if (codigoInput === codigoGenerado) {
      setCodigoVerificado(true);
      mostrarModal('Código Correcto', 'Código verificado. Ahora puedes ingresar tu nueva contraseña.', 'exito');
    } else {
       // Si está completo pero es incorrecto
       if (codigoInput.length === 4) {
          // Opcional: mostrar error o borde rojo
          // mostrarModal('Código Incorrecto', 'El código ingresado no coincide.', 'error');
       }
    }
  };

// 3. PROCESO FINAL
const manejarGuardarContrasena = async () => {
  if (nuevaContrasena.length < 6) {
    mostrarModal('Contraseña débil', 'La contraseña debe tener al menos 6 caracteres.', 'error');
    return;
  }
  if (nuevaContrasena !== confirmarContrasena) {
    mostrarModal('Error', 'Las contraseñas no coinciden.', 'error');
    return;
  }

  setCargando(true);
  
  // INTENTO DE RESETEO
  const resultado = await enviarResetPasswordFirebase(email.trim());

  setCargando(false);

  if (resultado.success) {
    mostrarModal(
      'Acción Necesaria', 
      // Cambiamos el mensaje para que el usuario sepa EXACTAMENTE qué esperar
      'Por políticas de seguridad, hemos enviado un enlace especial a tu correo.\n\nÚSALO para confirmar esta nueva contraseña definitivamente.', 
      'exito',
      () => router.replace('/Login/login')
    );
  } else {
     mostrarModal('Error', resultado.error || 'No se pudo enviar el enlace.', 'error');
  }
};

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Recuperar contraseña</Text>
          <View style={{width: 24}} />
        </View>

        <View style={styles.content}>
          
          {/* Tipo de Usuario */}
          <Text style={styles.label}>Tipo de usuario</Text>
          <View style={styles.userTypeContainer}>
            <TouchableOpacity
              style={[styles.userTypeButton, tipoUsuario === 'cliente' && styles.activeUserType]}
              onPress={() => setTipoUsuario('cliente')}
              disabled={correoEnviado} // Bloquear si ya envió código
            >
              <Text style={[styles.userTypeText, tipoUsuario === 'cliente' && styles.activeUserTypeText]}>Cliente</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.userTypeButton, tipoUsuario === 'alqui-amigo' && styles.activeUserType]}
              onPress={() => setTipoUsuario('alqui-amigo')}
              disabled={correoEnviado}
            >
              <Text style={[styles.userTypeText, tipoUsuario === 'alqui-amigo' && styles.activeUserTypeText]}>Alqui - Amigo</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.helperText}>Esto nos ayuda a localizar tu cuenta correctamente.</Text>

          {/* Correo Electrónico */}
          <Text style={styles.label}>Correo electrónico</Text>
          <View style={styles.emailRow}>
            <TextInput
              style={styles.inputEmail}
              placeholder="ejemplo@gmail.com"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!correoEnviado} // Bloquear edición si ya envió
            />
            <TouchableOpacity 
              style={[styles.sendButton, (cargando || correoEnviado) && styles.disabledBtn]} 
              onPress={manejarEnvioCodigo}
              disabled={cargando || correoEnviado}
            >
              {cargando ? <ActivityIndicator color="#FFF" /> : <Feather name="send" size={20} color="#FFF" />}
            </TouchableOpacity>
          </View>
          <Text style={styles.helperText}>Te enviaremos un código a este correo para verificar que eres tú.</Text>

          {/* Código de Verificación */}
          <Text style={styles.label}>Código de verificación</Text>
          <View style={styles.codeContainer}>
            {codigoIngresado.map((digit, index) => (
              <TextInput
                key={index}
                ref={inputRefs[index]} // Asignar ref
                style={[styles.inputCode, codigoVerificado && styles.inputCodeSuccess]}
                keyboardType="numeric"
                maxLength={1}
                value={digit}
                onChangeText={(text) => cambiarDigito(text, index)}
                editable={correoEnviado && !codigoVerificado} // Solo editable si se envió correo y no está verificado aún
              />
            ))}
          </View>
          <Text style={styles.helperText}>
             {correoEnviado 
                ? "Revisa tu correo, si el código no te llego: Reenviar Código" 
                : "Esperando envío del código..."}
          </Text>

          {/* Nueva Contraseña */}
          <Text style={styles.label}>Nueva contraseña</Text>
          <View style={[styles.passwordContainer, !codigoVerificado && styles.inputDisabled]}>
            <TextInput
              style={styles.passwordInput}
              placeholder="***************"
              placeholderTextColor="#999"
              secureTextEntry={!mostrarPass}
              value={nuevaContrasena}
              onChangeText={setNuevaContrasena}
              editable={codigoVerificado}
            />
            <TouchableOpacity onPress={() => setMostrarPass(!mostrarPass)} disabled={!codigoVerificado}>
              <Feather name={mostrarPass ? "eye" : "eye-off"} size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Confirmar Contraseña */}
          <Text style={styles.label}>Confirmar contraseña</Text>
          <View style={[styles.passwordContainer, !codigoVerificado && styles.inputDisabled]}>
            <TextInput
              style={styles.passwordInput}
              placeholder="***************"
              placeholderTextColor="#999"
              secureTextEntry={!mostrarConfirmPass}
              value={confirmarContrasena}
              onChangeText={setConfirmarContrasena}
              editable={codigoVerificado}
            />
            <TouchableOpacity onPress={() => setMostrarConfirmPass(!mostrarConfirmPass)} disabled={!codigoVerificado}>
              <Feather name={mostrarConfirmPass ? "eye" : "eye-off"} size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Botón Guardar */}
          <TouchableOpacity 
            style={[styles.saveButton, (!codigoVerificado || cargando) && styles.disabledBtn]} 
            onPress={manejarGuardarContrasena}
            disabled={!codigoVerificado || cargando}
          >
            {cargando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Guardar nueva contraseña</Text>}
          </TouchableOpacity>

        </View>

        <ModalMensaje 
          visible={modalVisible} 
          titulo={modalDatos.titulo} 
          mensaje={modalDatos.mensaje} 
          tipo={modalDatos.tipo} 
          onClose={cerrarModal} 
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20, backgroundColor: '#FFF'
  },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  content: { padding: 20 },
  
  label: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, marginTop: 15, color: '#000' },
  helperText: { fontSize: 13, color: '#888', marginBottom: 5 },

  // User Type
  userTypeContainer: { flexDirection: 'row', gap: 10, marginBottom: 5 },
  userTypeButton: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#E5E5E5', alignItems: 'center' },
  activeUserType: { backgroundColor: '#008FD9' },
  userTypeText: { fontSize: 14, color: '#666', fontWeight: '600' },
  activeUserTypeText: { color: '#FFF' },

  // Email Row
  emailRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 5 },
  inputEmail: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 10, padding: 15, fontSize: 16, color: '#333' },
  sendButton: { backgroundColor: '#008FD9', padding: 15, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  
  // Code Inputs
  codeContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 5 },
  inputCode: { 
    flex: 1, backgroundColor: '#F5F5F5', borderRadius: 10, height: 60, 
    fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: '#333' 
  },
  inputCodeSuccess: { borderWidth: 2, borderColor: '#28a745', backgroundColor: '#e8f5e9' },

  // Passwords
  passwordContainer: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', 
    borderRadius: 10, paddingHorizontal: 15, height: 55, borderWidth: 1, borderColor: '#F5F5F5'
  },
  passwordInput: { flex: 1, fontSize: 16, color: '#333', height: '100%' },
  inputDisabled: { opacity: 0.5, backgroundColor: '#EEE' },

  // Save Button
  saveButton: { backgroundColor: '#008FD9', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 30 },
  saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  disabledBtn: { backgroundColor: '#B0C4DE' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '85%', backgroundColor: '#FFF', borderRadius: 15, padding: 25, alignItems: 'center' },
  modalIconContainer: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  modalTitulo: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  modalMensaje: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 20 },
  modalBoton: { width: '100%', padding: 12, borderRadius: 10, alignItems: 'center' },
  modalBotonTexto: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});