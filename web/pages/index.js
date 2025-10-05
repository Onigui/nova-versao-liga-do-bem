import Head from 'next/head'
import Link from 'next/link'

export default function Home() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white'
    }}>
      <Head>
        <title>Liga do Bem Botucatu</title>
        <meta name="description" content="ONG de proteção animal em Botucatu" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main style={{ textAlign: 'center', padding: '2rem' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem', fontWeight: 'bold' }}>
          🐾 Liga do Bem Botucatu
        </h1>
        
        <p style={{ fontSize: '1.2rem', marginBottom: '2rem', opacity: 0.9 }}>
          Protegendo e cuidando dos animais de nossa cidade
        </p>

        <div style={{ 
          display: 'flex', 
          gap: '1rem', 
          flexWrap: 'wrap', 
          justifyContent: 'center',
          marginBottom: '2rem'
        }}>
          <button style={{
            padding: '12px 24px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            border: '2px solid white',
            borderRadius: '8px',
            color: 'white',
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}>
            📱 Baixar App
          </button>
          
          <button style={{
            padding: '12px 24px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            border: '2px solid white',
            borderRadius: '8px',
            color: 'white',
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}>
            🐕 Adotar
          </button>
          
          <button style={{
            padding: '12px 24px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            border: '2px solid white',
            borderRadius: '8px',
            color: 'white',
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}>
            💝 Doar
          </button>
        </div>

        <div style={{ 
          backgroundColor: 'rgba(255,255,255,0.1)', 
          padding: '1.5rem', 
          borderRadius: '12px',
          marginTop: '2rem'
        }}>
          <h3 style={{ marginBottom: '1rem' }}>🚀 Plataforma Online</h3>
          <p style={{ marginBottom: '0.5rem' }}>
            ✅ Backend API: <strong>Funcionando</strong>
          </p>
          <p style={{ marginBottom: '0.5rem' }}>
            ✅ Database: <strong>Conectado</strong>
          </p>
          <p style={{ marginBottom: '0.5rem' }}>
            ✅ Frontend: <strong>Online</strong>
          </p>
          <p>
            ✅ Mobile App: <strong>Em breve</strong>
          </p>
        </div>

        <div style={{ marginTop: '2rem', fontSize: '0.9rem', opacity: 0.8 }}>
          <p>📧 contato@ligadobembotucatu.org.br</p>
          <p>📱 (14) 99999-9999</p>
        </div>
      </main>
    </div>
  )
}
