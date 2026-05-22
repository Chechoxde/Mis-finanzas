import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Pos from './Pos' 
import './App.css'

function App() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // 1. Revisar si ya hay una sesión activa al cargar la página
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // 2. Escuchar si inicias o cierras sesión
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    // Aquí enviamos tus credenciales a Supabase
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) {
      alert("Error al iniciar sesión: " + error.message)
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  // SI NO ESTÁS LOGUEADO -> Mostramos el formulario
  if (!session) {
    return (
      <div style={{ maxWidth: '400px', margin: '50px auto', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h1>💰 Mi POS Financiero</h1>
        <p>Inicia sesión para registrar movimientos</p>
        
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input
            type="email"
            placeholder="Tu correo de acceso"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: '10px', fontSize: '16px' }}
          />
          <input
            type="password"
            placeholder="Tu contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: '10px', fontSize: '16px' }}
          />
          <button type="submit" disabled={loading} style={{ padding: '10px', fontSize: '16px', cursor: 'pointer' }}>
            {loading ? 'Cargando...' : 'Entrar al Sistema'}
          </button>
        </form>
      </div>
    )
  }

  // SI YA ESTÁS LOGUEADO -> Mostramos la interfaz principal
  return (
    <div style={{ maxWidth: '600px', margin: '50px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Dashboard de Ingreso 🚀</h2>
        <button onClick={handleLogout} style={{ padding: '5px 10px', cursor: 'pointer' }}>
          Cerrar Sesión
        </button>
      </div>
      <hr />
      
      <p>Bienvenido, <strong>{session.user.email}</strong>.</p>
      <Pos />
    </div>
  )
}

export default App