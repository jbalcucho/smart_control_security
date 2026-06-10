/**
 * Vista de mapa del Supervisor.
 *
 * Estado: PLACEHOLDER — se implementará en Sprint Demo 4.
 * Mostrará: Leaflet con puestos (círculos de geofence) + pins de marcas.
 */

export default function MapaPage() {
  return (
    <div className="space-y-4 animate-fade-in">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Mapa</h1>
        <p className="mt-1 text-sm text-gray-600">Puestos y marcas en tiempo real</p>
      </header>

      <section className="card bg-warning-50 ring-warning-500/30">
        <p className="text-sm font-medium text-warning-700">
          Implementación pendiente (Sprint Demo 4)
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-warning-700">
          <li>Mapa Leaflet con tiles de OpenStreetMap</li>
          <li>Círculos con el radio de geofence de cada puesto</li>
          <li>Pins de marcas (verde = válida, rojo = fraude)</li>
          <li>Popups con foto del guardia + datos</li>
        </ul>
      </section>
    </div>
  );
}
