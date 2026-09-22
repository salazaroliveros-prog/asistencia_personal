/**
 * Script para probar la conexión Firebase y CRUD completo
 * Este script prueba la integración completa con Firebase usando las credenciales configuradas
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function testFirebaseConnection() {
  console.log('=== PRUEBA DE CONEXIÓN FIREBASE Y CRUD COMPLETO ===\n');

  console.log('📋 CONFIGURACIÓN FIREBASE:');
  console.log('   Project ID: sistema-de-control-aee89');
  console.log('   Auth Domain: sistema-de-control-aee89.firebaseapp.com');
  console.log('   API Key: AIzaSyDriDh1SC5_8T1rx5EmgFi0pUEKUGQU5xg\n');

  console.log('⚠️  REQUISITOS PREVIOS:');
  console.log('   1. Tener un usuario administrador creado en Firebase');
  console.log('   2. Tener habilitado Email/Password Authentication');
  console.log('   3. Tener las reglas de seguridad desplegadas\n');

  const email = await question('📧 Email del usuario administrador: ');
  const password = await question('🔑 Contraseña: ');

  if (!email || !password) {
    console.log('❌ Email y contraseña son requeridos');
    rl.close();
    return;
  }

  console.log('\n🔄 Iniciando prueba de conexión...');

  // Crear un HTML de prueba que puede abrirse en el navegador
  const testHTML = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prueba Firebase</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .test { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .success { background-color: #d4edda; border-color: #c3e6cb; }
        .error { background-color: #f8d7da; border-color: #f5c6cb; }
        .info { background-color: #d1ecf1; border-color: #bee5eb; }
        button { padding: 10px 20px; margin: 5px; cursor: pointer; }
        #log { background: #f5f5f5; padding: 10px; margin-top: 20px; font-family: monospace; max-height: 300px; overflow-y: auto; }
    </style>
</head>
<body>
    <h1>Prueba de Conexión Firebase</h1>
    
    <div class="test info">
        <h3>Configuración</h3>
        <p>Project ID: sistema-de-control-aee89</p>
        <p>Email: ${email}</p>
    </div>

    <div class="test">
        <h3>Pruebas</h3>
        <button onclick="testAuth()">Test Authentication</button>
        <button onclick="testFirestore()">Test Firestore</button>
        <button onclick="testCRUD()">Test CRUD Completo</button>
        <button onclick="testRealtime()">Test Realtime</button>
    </div>

    <div id="results"></div>
    <div id="log"></div>

    <script type="module">
        import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
        import { getAuth, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
        import { getFirestore, collection, addDoc, getDocs, query, where, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

        const firebaseConfig = {
            apiKey: "AIzaSyDriDh1SC5_8T1rx5EmgFi0pUEKUGQU5xg",
            authDomain: "sistema-de-control-aee89.firebaseapp.com",
            projectId: "sistema-de-control-aee89",
            storageBucket: "sistema-de-control-aee89.firebasestorage.app",
            messagingSenderId: "265655332442",
            appId: "1:265655332442:web:c4e8617741e3b916987263"
        };

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        function log(message, type = 'info') {
            const logDiv = document.getElementById('log');
            const timestamp = new Date().toLocaleTimeString();
            const color = type === 'error' ? 'red' : type === 'success' ? 'green' : 'black';
            logDiv.innerHTML += \`<div style="color: \${color}">[\${timestamp}] \${message}</div>\`;
            logDiv.scrollTop = logDiv.scrollHeight;
        }

        function showResult(message, type = 'info') {
            const resultsDiv = document.getElementById('results');
            resultsDiv.innerHTML += \`<div class="test \${type}">\${message}</div>\`;
        }

        async function testAuth() {
            log('Iniciando prueba de autenticación...');
            try {
                const userCredential = await signInWithEmailAndPassword(auth, '${email}', '${password}');
                log('Autenticación exitosa', 'success');
                showResult('✅ Authentication: Exitosa - User: ' + userCredential.user.email, 'success');
                log('User UID: ' + userCredential.user.uid);
                log('Email verified: ' + userCredential.user.emailVerified);
                return userCredential.user;
            } catch (error) {
                log('Error de autenticación: ' + error.message, 'error');
                showResult('❌ Authentication: Fallida - ' + error.message, 'error');
                return null;
            }
        }

        async function testFirestore() {
            log('Iniciando prueba de Firestore...');
            try {
                const user = await testAuth();
                if (!user) return;

                // Intentar leer una colección
                const personalRef = collection(db, 'personal');
                const snapshot = await getDocs(personalRef);
                
                log('Firestore conectado exitosamente', 'success');
                showResult('✅ Firestore: Conectado - Documentos en personal: ' + snapshot.size, 'success');
                log('Total documentos en personal: ' + snapshot.size);
            } catch (error) {
                log('Error de Firestore: ' + error.message, 'error');
                showResult('❌ Firestore: Fallida - ' + error.message, 'error');
            }
        }

        async function testCRUD() {
            log('Iniciando prueba CRUD completa...');
            try {
                const user = await testAuth();
                if (!user) return;

                // CREATE
                log('CREando documento de prueba...');
                const testDoc = {
                    ID_Trabajador: 'TEST-' + Date.now(),
                    Nombre_Completo: 'Trabajador Prueba',
                    DPI_CUI: '1234567890101',
                    Puesto: 'Albañil',
                    Estado: 'Activo',
                    Fecha_Registro: new Date().toISOString(),
                    Telefono: '55551111',
                    WhatsApp: '55551111',
                    Direccion: 'Zona 10',
                    createdBy: user.uid
                };

                const docRef = await addDoc(collection(db, 'personal'), testDoc);
                log('Documento creado: ' + docRef.id, 'success');
                showResult('✅ CREATE: Exitoso - ID: ' + docRef.id, 'success');

                // READ
                log('LEYendo documento...');
                const q = query(collection(db, 'personal'), where('ID_Trabajador', '==', testDoc.ID_Trabajador));
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                    log('Documento leído exitosamente', 'success');
                    showResult('✅ READ: Exitoso - Encontrado: ' + querySnapshot.size + ' documento(s)', 'success');
                } else {
                    log('Documento no encontrado', 'error');
                    showResult('❌ READ: Fallida - Documento no encontrado', 'error');
                }

            } catch (error) {
                log('Error en CRUD: ' + error.message, 'error');
                showResult('❌ CRUD: Fallida - ' + error.message, 'error');
            }
        }

        async function testRealtime() {
            log('Iniciando prueba de realtime...');
            try {
                const user = await testAuth();
                if (!user) return;

                log('Escuchando cambios en tiempo real...');
                const unsubscribe = onSnapshot(collection(db, 'personal'), (snapshot) => {
                    log('Actualización recibida - Total documentos: ' + snapshot.size, 'success');
                    showResult('✅ Realtime: Funcionando - Documentos: ' + snapshot.size, 'success');
                });

                // Escuchar por 5 segundos
                setTimeout(() => {
                    unsubscribe();
                    log('Listener de realtime detenido', 'info');
                }, 5000);

            } catch (error) {
                log('Error en realtime: ' + error.message, 'error');
                showResult('❌ Realtime: Fallida - ' + error.message, 'error');
            }
        }

        // Exponer funciones globalmente
        window.testAuth = testAuth;
        window.testFirestore = testFirestore;
        window.testCRUD = testCRUD;
        window.testRealtime = testRealtime;

        log('Sistema de pruebas inicializado');
        log('Haz click en los botones para ejecutar las pruebas');
    </script>
</body>
</html>
  `;

  const fs = require('fs');
  fs.writeFileSync('test-firebase.html', testHTML);

  console.log('✅ Archivo de prueba creado: test-firebase.html');
  console.log('\n📋 PASOS SIGUIENTES:');
  console.log('1. Abre el archivo test-firebase.html en tu navegador');
  console.log('2. Haz click en "Test Authentication" para probar la autenticación');
  console.log('3. Haz click en "Test Firestore" para probar la conexión a Firestore');
  console.log('4. Haz click en "Test CRUD" para probar operaciones completas');
  console.log('5. Haz click en "Test Realtime" para probar actualizaciones en tiempo real');
  console.log('\n📝 Los resultados se mostrarán en pantalla y en el log de la página');

  rl.close();
}

testFirebaseConnection();