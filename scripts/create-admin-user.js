/**
 * Script para crear usuario administrador inicial en Firebase
 * Este script usa el Firebase Admin SDK para crear un usuario con custom claims
 */

const admin = require('firebase-admin');
const readline = require('readline');

// Configuración del proyecto
const SERVICE_ACCOUNT_KEY = process.env.SERVICE_ACCOUNT_KEY || 'service-account-key.json';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createAdminUser() {
  try {
    console.log('=== CREACIÓN DE USUARIO ADMINISTRADOR INICIAL ===\n');

    // Verificar si existe la clave de servicio
    const fs = require('fs');
    let serviceAccount;

    if (fs.existsSync(SERVICE_ACCOUNT_KEY)) {
      serviceAccount = require('./' + SERVICE_ACCOUNT_KEY);
      console.log('✅ Clave de servicio encontrada:', SERVICE_ACCOUNT_KEY);
    } else {
      console.log('❌ No se encontró la clave de servicio.');
      console.log('Para crear un usuario administrador, necesitas:');
      console.log('1. Ir a Firebase Console: https://console.firebase.google.com/project/sistema-de-control-aee89/settings/serviceaccounts/adminsdk');
      console.log('2. Generar una nueva clave privada');
      console.log('3. Guardarla como service-account-key.json en este directorio');
      console.log('4. O establecer la variable de entorno SERVICE_ACCOUNT_KEY');
      console.log('\nAlternativa: Crear el usuario manualmente desde la consola de Firebase.');
      rl.close();
      return;
    }

    // Inicializar Firebase Admin
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'sistema-de-control-aee89'
    });

    const auth = admin.auth();

    // Solicitar datos del usuario
    const email = await question('Correo electrónico del administrador: ');
    const password = await question('Contraseña (mínimo 6 caracteres): ');
    const displayName = await question('Nombre completo: ');

    // Validaciones básicas
    if (!email || !password || !displayName) {
      console.log('❌ Todos los campos son obligatorios');
      rl.close();
      return;
    }

    if (password.length < 6) {
      console.log('❌ La contraseña debe tener al menos 6 caracteres');
      rl.close();
      return;
    }

    console.log('\n🔄 Creando usuario...');

    // Crear usuario
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: displayName,
      emailVerified: false
    });

    console.log('✅ Usuario creado exitosamente');
    console.log('   UID:', userRecord.uid);
    console.log('   Email:', userRecord.email);
    console.log('   DisplayName:', userRecord.displayName);

    // Establecer custom claims para administrador
    console.log('\n🔄 Estableciendo claims de administrador...');

    await auth.setCustomUserClaims(userRecord.uid, {
      admin: true,
      manager: true,
      supervisor: true
    });

    console.log('✅ Custom claims establecidos correctamente');
    console.log('   admin: true');
    console.log('   manager: true');
    console.log('   supervisor: true');

    // Crear documento en Firestore
    const db = admin.firestore();
    const userDoc = {
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      rol: 'admin',
      activo: true,
      fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
      customClaims: {
        admin: true,
        manager: true,
        supervisor: true
      }
    };

    await db.collection('users').doc(userRecord.uid).set(userDoc);

    console.log('✅ Documento de usuario creado en Firestore');
    console.log('   Colección: users');
    console.log('   Document ID:', userRecord.uid);

    console.log('\n🎉 USUARIO ADMINISTRADOR CREADO EXITOSAMENTE');
    console.log('\n📋 Datos de acceso:');
    console.log('   Email:', email);
    console.log('   Contraseña:', password);
    console.log('   UID:', userRecord.uid);
    console.log('\n⚠️  GUARDA ESTAS CREDENCIALES DE FORMA SEGURA');
    console.log('   Este usuario tiene acceso completo al sistema');

  } catch (error) {
    console.error('❌ Error al crear usuario administrador:', error.message);
    if (error.code === 'auth/email-already-exists') {
      console.log('   El correo electrónico ya está en uso');
    } else if (error.code === 'auth/invalid-email') {
      console.log('   El correo electrónico no es válido');
    } else if (error.code === 'auth/weak-password') {
      console.log('   La contraseña es muy débil');
    }
  } finally {
    rl.close();
  }
}

// Ejecutar el script
createAdminUser();