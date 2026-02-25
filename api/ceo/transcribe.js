import OpenAI from 'openai'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { audio } = req.body || {}

  if (!audio) {
    return res.status(400).json({ error: 'Audio data is required' })
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    // Convert base64 data URL to buffer then to File (Node.js 18+)
    const base64Data = audio.includes(',') ? audio.split(',')[1] : audio
    const audioBuffer = Buffer.from(base64Data, 'base64')
    const file = new File([audioBuffer], 'audio.webm', { type: 'audio/webm' })

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1'
    })

    return res.status(200).json({ text: transcription.text })
  } catch (err) {
    // Log full error server-side only — never expose API keys or raw SDK errors to the client
    console.error('[Transcribe] Error:', err.message)
    const isAuthError = err.status === 401 || err.message?.includes('API key') || err.message?.includes('header value')
    const clientMessage = isAuthError
      ? 'OpenAI API key is not configured correctly. Check Vercel environment variables.'
      : 'Transcription failed. Please try again.'
    return res.status(500).json({ error: clientMessage })
  }
}
