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

  //Attached to div DOM node to render
  const containerRef = useRef<HTMLDivElement>(null)

  //Holds Map instance once created, reused across renders
  const mapRef = useRef<maplibregl.Map | null>(null)

  // Allows holding of map clicks
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())

  // Handle clicks, adds new pin to the given lat and lng, 
  // increments label by 1 for each new pin
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

  const handleDeletePin = (pinId: string) => {
    setPins((prev) => prev.filter((pin) => pin.id !== pinId))
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

    //Onclick listener, sets pin on current click location
    map.on("click", (e) => {
      const target = e.originalEvent.target as HTMLElement
      if (target.closest(".maplibregl-marker")) 
        return
      handleMapClickRef.current(e.lngLat.lng, e.lngLat.lat)
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
    <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />
  )
}

export default App
