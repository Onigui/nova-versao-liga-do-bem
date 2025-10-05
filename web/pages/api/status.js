export default async function handler(req, res) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nova-versao-liga-do-bem.onrender.com'
    
    const response = await fetch(`${apiUrl}/health`)
    const data = await response.json()
    
    res.status(200).json({
      frontend: 'OK',
      backend: data.status === 'OK' ? 'OK' : 'ERROR',
      apiUrl: apiUrl,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      frontend: 'OK',
      backend: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}
