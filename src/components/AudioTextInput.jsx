import { useState, useRef, useEffect } from 'react'

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

export default function AudioTextInput({ value, onChange, placeholder, rows = 3 }) {
  const [gravando, setGravando] = useState(false)
  const [suportaAudio, setSupportaAudio] = useState(false)
  const recognitionRef = useRef(null)

  useEffect(() => {
    setSupportaAudio(!!SpeechRecognition)
  }, [])

  function iniciarGravacao() {
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = 'pt-BR'
    recognition.continuous = true
    recognition.interimResults = true

    let finalTranscript = value || ''

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript ? ' ' : '') + transcript
          onChange(finalTranscript)
        } else {
          interim += transcript
        }
      }
      // Mostra o texto parcial enquanto fala
      if (interim) {
        onChange(finalTranscript + (finalTranscript ? ' ' : '') + interim)
      }
    }

    recognition.onerror = (event) => {
      console.error('[Speech]', event.error)
      setGravando(false)
    }

    recognition.onend = () => {
      setGravando(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setGravando(true)
  }

  function pararGravacao() {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setGravando(false)
  }

  function toggleGravacao() {
    if (gravando) {
      pararGravacao()
    } else {
      iniciarGravacao()
    }
  }

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-12 text-sm"
      />
      {suportaAudio && (
        <button
          type="button"
          onClick={toggleGravacao}
          className={`absolute right-2 top-2 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
            gravando
              ? 'bg-red-500 text-white animate-pulse'
              : 'bg-slate-100 text-slate-500 active:bg-slate-200'
          }`}
          title={gravando ? 'Parar gravação' : 'Gravar áudio'}
        >
          {gravando ? '■' : '🎤'}
        </button>
      )}
    </div>
  )
}
