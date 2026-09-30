import { ref } from 'vue'

let loadPromise = null

/**
 * Loads the Google Maps JS API script once, no matter how many
 * components call this. Returns a promise that resolves when
 * window.google.maps is ready to use.
 */
export function loadGoogleMaps() {
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve(window.google.maps)
      return
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY in .env'))
      return
    }

    // Use callback approach to ensure Maps API is fully initialized
    const callbackName = '_gmapsReady'
    window[callbackName] = () => {
      resolve(window.google.maps)
      delete window[callbackName]
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry,marker&v=weekly&callback=${callbackName}`
    script.async = true
    script.onerror = () => reject(new Error('Failed to load Google Maps script'))
    document.head.appendChild(script)
  })

  return loadPromise
}

let geocoder = null

/**
 * Reverse-geocodes a lat/lng into a formatted address string.
 * Requires Google Maps to be loaded first (call loadGoogleMaps() before this).
 */
export async function reverseGeocode(lat, lng) {
  if (!geocoder) {
    geocoder = new window.google.maps.Geocoder()
  }
  const { results } = await geocoder.geocode({ location: { lat, lng } })
  if (results && results[0]) {
    return results[0].formatted_address
  }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

export function useGoogleMaps() {
  const isLoaded = ref(false)
  const error = ref(null)

  loadGoogleMaps()
    .then(() => { isLoaded.value = true })
    .catch((err) => { error.value = err.message })

  return { isLoaded, error }
}
