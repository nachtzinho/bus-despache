'use client'

import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import { ANDRE_ROCHA_POINT } from '@/lib/bus-tracking'

type Vehicle = {
  id: string
  route: '306' | '390'
  direction: string
  latitude: number
  longitude: number
  speed: number | null
  updatedAt: string | null
}

function FitVehicles({ vehicles }: { vehicles: Vehicle[] }) {
  const map = useMap()
  useEffect(() => {
    if (vehicles.length) {
      map.fitBounds([
        ...vehicles.map((vehicle) => [vehicle.latitude, vehicle.longitude] as [number, number]),
        [ANDRE_ROCHA_POINT.latitude, ANDRE_ROCHA_POINT.longitude],
      ], { padding: [24, 24], maxZoom: 13 })
    }
  }, [map, vehicles])
  return null
}

export default function BusMap({ vehicles }: { vehicles: Vehicle[] }) {
  return (
    <MapContainer center={[ANDRE_ROCHA_POINT.latitude, ANDRE_ROCHA_POINT.longitude]} zoom={12} scrollWheelZoom className="bus-map" aria-label="Mapa das linhas 306 e 390 e do ponto André Rocha em Taquara">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitVehicles vehicles={vehicles} />
      <Circle
        center={[ANDRE_ROCHA_POINT.latitude, ANDRE_ROCHA_POINT.longitude]}
        radius={ANDRE_ROCHA_POINT.radiusMeters}
        pathOptions={{ color: '#6e9b51', weight: 1, fillColor: '#6e9b51', fillOpacity: 0.12 }}
      />
      <CircleMarker
        center={[ANDRE_ROCHA_POINT.latitude, ANDRE_ROCHA_POINT.longitude]}
        radius={7}
        pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#6e9b51', fillOpacity: 1 }}
      >
        <Popup><strong>Ponto André Rocha</strong><br />Taquara · raio de detecção de 150 m</Popup>
      </CircleMarker>
      {vehicles.map((vehicle) => (
        <CircleMarker
          key={vehicle.id}
          center={[vehicle.latitude, vehicle.longitude]}
          radius={9}
          pathOptions={{ color: '#ffffff', weight: 2, fillColor: vehicle.route === '306' ? '#3788c8' : '#db8950', fillOpacity: 1 }}
        >
          <Popup>
            <strong>Linha {vehicle.route} · carro {vehicle.id}</strong>
            <br />Sentido {vehicle.direction}
            <br />{vehicle.speed === null ? 'Velocidade indisponível' : `${Math.round(vehicle.speed)} km/h`}
            <br /><a href={`https://www.google.com/maps/search/?api=1&query=${vehicle.latitude},${vehicle.longitude}`} target="_blank" rel="noreferrer">Abrir no mapa</a>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
