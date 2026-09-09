import { useEffect, useRef, useState } from 'react'
import * as maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import type { Pin } from "./types/pin.ts"
import { samplePins } from "./samplePins.ts"
import './App.css'

const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty"

// Add VITE_MAPBOX_ACCESS_TOKEN=your_token_here to a .env.local file (git-ignored)
const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

function App() {

  //Address state
  const [address, setAddress] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [candidate, setCandidate] = useState<{ lng: number, lat: number; label: string} | null>(null)

  // The number of the pins on the map and adding more pins
  const [pins, setPins] = useState<Pin[]>(samplePins)

  //Attached to div DOM node to render
  const containerRef = useRef<HTMLDivElement>(null)

  //Holds Map instance once created, reused across renders
  const mapRef = useRef<maplibregl.Map | null>(null)

  // Allows holding of map clicks
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())

  // Holds the preview marker shown before a searched pin is confirmed
  const tempMarkerRef = useRef<maplibregl.Marker | null>(null)

  // Handles deletion button press of pin, removes pin from list of pins
  const handleDeletePin = (pinId: string) => {
    setPins((prev) => prev.filter((pin) => pin.id !== pinId))
  }

  // Finds a pin already on the map with the same address/name
  const findExistingPin = (label: string) => {
    const normalized = label.trim().toLowerCase()
    return pins.find((pin) => pin.label.trim().toLowerCase() === normalized)
  }

  // Uses what the user typed as the base label, and fills in anything
  // it's missing (city, state, etc.) from Mapbox's result
  const buildLabel = (userInput: string, properties: Record<string, any>) => {
    const context = properties.context ?? {}
    const mapboxParts = [
      properties.name,
      context.place?.name,
      context.region?.name,
      context.country?.name,
    ].filter(Boolean)

    const trimmedInput = userInput.trim()
    const lowerInput = trimmedInput.toLowerCase()
    const missingParts = mapboxParts.filter((part) => !lowerInput.includes(part.toLowerCase()))

    return [trimmedInput, ...missingParts].join(", ")
  }

  // Handles searching upon submission
  const handleSearch = async (e: React.SubmitEvent) => {
    e.preventDefault()
    if (!address.trim()) return

    setIsSearching(true)
    try {
      const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(address)}&limit=1&access_token=${MAPBOX_ACCESS_TOKEN}`
      const res = await fetch(url)
      const data = await res.json()

      if (!data.features || data.features.length === 0) {
        alert("No results found for that address")
        return
      }

      const feature = data.features[0]
      const [lngNum, latNum] = feature.geometry.coordinates
      const display_name = buildLabel(address, feature.properties)

      // If a pin already exists here, just show its popup instead of a preview pin
      const existingPin = findExistingPin(display_name)
      if (existingPin) {
        tempMarkerRef.current?.remove()
        tempMarkerRef.current = null
        setCandidate(null)
        mapRef.current?.flyTo({ center: [lngNum, latNum], zoom: 14 })
        markersRef.current.get(existingPin.id)?.togglePopup()
        setAddress("")
        return
      }

      // Remove any previous preview marker
      tempMarkerRef.current?.remove()

      const marker = new maplibregl.Marker({ color: "orange" })
        .setLngLat([lngNum, latNum])
        .addTo(mapRef.current!)
      tempMarkerRef.current = marker

      mapRef.current?.flyTo({ center: [lngNum, latNum], zoom: 14 })
      setCandidate({ lng: lngNum, lat: latNum, label: display_name })
    } catch (err) {
      console.error("Geocoding failed:", err)
      alert("Something went wrong searching for that address.")
    } finally {
      setIsSearching(false)
    }
  }

  // Handles confirm pin button press, adds pin to the set of pins on the map
  const handleConfirmPin = () => {
    if (!candidate) return
    const pin: Pin = {
      id: crypto.randomUUID(),
      lng: candidate.lng,
      lat: candidate.lat,
      label: candidate.label,
    }
    setPins((prev) => [...prev, pin])

    tempMarkerRef.current?.remove()
    tempMarkerRef.current = null
    setCandidate(null)
    setAddress("")
  }

  const handleCancelCandidate = () => {
    tempMarkerRef.current?.remove()
    tempMarkerRef.current = null
    setCandidate(null)
  }

  // Creation of map, renders once after React has painted DOM
  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OPENFREEMAP_STYLE,
      center: [-123.1, 49.26],
      zoom: 10,
    })
    map.addControl(new maplibregl.NavigationControl(), "top-right")

    let geolocate = new maplibregl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation:true
    })

    // Add the control to the map.
    map.addControl(geolocate);
    // Set an event listener that fires
    // when a trackuserlocationend event occurs.
    geolocate.on('trackuserlocationend', () => {
      console.log('A trackuserlocationend event has occurred.')
    });
    geolocate.on('error', (e) => {
      console.error('Geolocation error:', e)
    }) 

    mapRef.current = map

    // Returns unmounting cleanup function
    return () => {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current.clear()
      map.remove()
      mapRef.current = null
    }
  }, [])


  //Creates markers and pins + handles marker removal logic
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    //References marker Map<string, marker object>
    const markers = markersRef.current
    const nextIds = new Set(pins.map((pin) => pin.id))

    for (const [id, marker] of markers) {
      // checking if pins have id, if not, remove marker from markers
      if (!nextIds.has(id)) {
        marker.remove()
        markers.delete(id)
      }
    }

    for (const pin of pins) {
      const existing = markers.get(pin.id)
      if (existing) {
        existing.setLngLat([pin.lng, pin.lat])
        continue
      }

      // Create popup content
      const popupContent = document.createElement("div")

      const label = document.createElement("p")
      label.textContent = pin.label

      const deleteButton = document.createElement("button")
      deleteButton.textContent = "Delete"
      deleteButton.onclick = () => handleDeletePin(pin.id)

      popupContent.appendChild(label)
      popupContent.appendChild(deleteButton)
      

      const popup = new maplibregl.Popup({ offset: 24 }).setDOMContent(popupContent)
      const marker = new maplibregl.Marker()
        .setLngLat([pin.lng, pin.lat])
        .setPopup(popup)
        .addTo(map)

      markers.set(pin.id, marker)
    }
  }, [pins])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <form
        onSubmit={handleSearch}
        style={{ position: 'absolute', top: 12, left: 12, zIndex: 1 }}
      >
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Search for an address..."
          style={{ padding: '8px', width: '260px' }}
        />
        <button type="submit" disabled={isSearching} style={{ padding: '8px 12px' }}>
          {isSearching ? "Searching..." : "Search"}
        </button>
      </form>

      {candidate && (
        <div style={{ position: 'absolute', top: 56, left: 12, zIndex: 1, background: 'white', padding: '8px', borderRadius: '4px', maxWidth: '260px' }}>
          <p style={{ margin: '0 0 8px' }}>{candidate.label}</p>
          <button onClick={handleConfirmPin} style={{ marginRight: '8px' }}>Add Pin</button>
          <button onClick={handleCancelCandidate}>Cancel</button>
        </div>
      )}

      <div ref={containerRef} style={{ width: '100%', height: '100vh' }} />
    </div>
  )
}

export default App
