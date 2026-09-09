import { useEffect, useRef, useState } from 'react'
import * as maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import type { Pin } from "./types/pin.ts"
import { samplePins } from "./samplePins.ts"
import './App.css'

const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty"

function App() {

  // The number of the pins on the map and adding more pins
  const [pins, setPins] = useState<Pin[]>(samplePins)

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())

  const handleMapClick = (lng: number, lat: number) => {
    const pin: Pin = {
      id: crypto.randomUUID(),
      lng,
      lat,
      label: `Pin ${pins.length + 1}`,
    }
    setPins((prev) => [...prev, pin])
  }
  const handleMapClickRef = useRef(handleMapClick)
  handleMapClickRef.current = handleMapClick

  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OPENFREEMAP_STYLE,
      center: [-123.1, 49.26],
      zoom: 10,
    })
    map.addControl(new maplibregl.NavigationControl(), "top-right")

    map.on("click", (e) => {
      handleMapClickRef.current(e.lngLat.lng, e.lngLat.lat)
    })

    mapRef.current = map

    return () => {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current.clear()
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const markers = markersRef.current
    const nextIds = new Set(pins.map((pin) => pin.id))

    for (const [id, marker] of markers) {
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
      const popup = new maplibregl.Popup({ offset: 24 }).setText(pin.label)
      const marker = new maplibregl.Marker()
        .setLngLat([pin.lng, pin.lat])
        .setPopup(popup)
        .addTo(map)
      markers.set(pin.id, marker)
    }
  }, [pins])

  return (
    <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />
  )
}

export default App
