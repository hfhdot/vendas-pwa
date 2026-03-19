export function capturarGPS() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS não suportado'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        gps_accuracy: pos.coords.accuracy,
      }),
      (err) => {
        const msgs = {
          1: 'Permissão de localização negada.',
          2: 'Posição indisponível.',
          3: 'Tempo esgotado ao obter GPS.',
        }
        reject(new Error(msgs[err.code] || 'Erro GPS'))
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  })
}
