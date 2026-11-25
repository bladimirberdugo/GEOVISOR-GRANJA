// ---------- 1. Mapa y mapas base ----------
const map = L.map('map').setView([5.310072, -72.386062], 17);

const calles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap'
});

const satelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: 'Tiles &copy; Esri'
});

satelite.addTo(map);

// ---------- 2. Escalas de evaluación fitosanitaria ----------
// "max" es el valor más alto de cada escala; "textos" traduce cada número.
const ESCALAS = {
  Madera_Q: {
    etiqueta: 'Madera quebradiza', max: 4,
    textos: { 1: 'Sin pérdidas', 2: 'Pérdida de 1 rama', 3: 'Pérdida de 2 ramas', 4: 'Pérdida de más de 2 ramas' }
  },
  Heridas_T: {
    etiqueta: 'Heridas en tronco', max: 4,
    textos: { 1: 'Tronco totalmente sano', 2: 'Hasta 10 % de la circunferencia', 3: 'Hasta 30 % de la circunferencia', 4: 'Hasta 50 % de la circunferencia' }
  },
  'P_Raíces': {
    etiqueta: 'Problemas de raíces', max: 4,
    textos: { 1: 'Sin problemas aparentes', 2: '5 % de raíces descubiertas o dañadas', 3: '10 % de raíces descubiertas o dañadas', 4: 'Más del 10 % de raíces descubiertas o dañadas' }
  },
  Inclinaci: {
    etiqueta: 'Inclinación del tronco', max: 4,
    textos: { 1: 'Recto', 2: 'Hasta 80°', 3: 'Hasta 60°', 4: 'Mayor a 60°' }
  },
  A_Plagas: {
    etiqueta: 'Afectación por plagas', max: 5,
    textos: { 1: 'Sin daños', 2: 'Menos del 5 % dañado', 3: 'Del 5 % al 10 % dañado', 4: 'Del 10 % al 20 % dañado', 5: 'Más del 20 % dañado' }
  },
  A_Enferm: {
    etiqueta: 'Afectación por enfermedades', max: 5,
    textos: { 1: 'Sin daños', 2: 'Menos del 5 % dañado', 3: 'Del 5 % al 10 % dañado', 4: 'Del 10 % al 20 % dañado', 5: 'Más del 20 % dañado' }
  }
};

const ESTADOS = [
  { nombre: 'Bueno',    color: '#2e8b57' },
  { nombre: 'Leve',     color: '#a3c644' },
  { nombre: 'Moderado', color: '#f4a52b' },
  { nombre: 'Crítico',  color: '#d64545' }
];

// El estado del árbol lo define su indicador más grave
function calcularEstado(p) {
  let peor = 0;
  for (const campo in ESCALAS) {
    const v = p[campo];
    if (v === null || v === undefined) continue;          // sin dato: se ignora
    const gravedad = (v - 1) / (ESCALAS[campo].max - 1);  // convierte a escala 0-1
    if (gravedad > peor) peor = gravedad;
  }
  if (peor === 0) return ESTADOS[0];
  if (peor <= 0.34) return ESTADOS[1];
  if (peor <= 0.67) return ESTADOS[2];
  return ESTADOS[3];
}

// ---------- 3. Funciones auxiliares ----------
async function cargarGeoJSON(ruta) {
  const respuesta = await fetch(ruta);
  if (!respuesta.ok) throw new Error('No se pudo cargar ' + ruta);
  return await respuesta.json();
}

function crearFicha(p) {
  const num = (v, dec = 1) => (v === null || v === undefined) ? '-' : Number(v).toFixed(dec);
  const estado = calcularEstado(p);

  // Genera una fila por cada indicador sanitario, con su texto
  const filasSanitarias = Object.entries(ESCALAS).map(([campo, esc]) => {
    const v = p[campo];
    const texto = (v === null || v === undefined) ? '-' : v + ' · ' + (esc.textos[v] ?? '');
    return `<tr><td>${esc.etiqueta}</td><td>${texto}</td></tr>`;
  }).join('');

  return `
    <div class="ficha">
      <h3>${p.NOMBRE}</h3>
      <div class="sub">Árbol N.º ${p.NUMERO} <span class="pill" style="background:${estado.color}">${estado.nombre}</span></div>

      <div class="titulo-seccion">Dimensiones</div>
      <table>
        <tr><td>DAP</td><td>${num(p.DAP)} cm</td></tr>
        <tr><td>Altura comercial</td><td>${num(p.HC)} m</td></tr>
        <tr><td>Altura total</td><td>${num(p.HT)} m</td></tr>
        <tr><td>Diámetro de copa</td><td>${num(p.D_COPA)} m</td></tr>
      </table>

      <div class="titulo-seccion">Evaluación sanitaria</div>
      <table>${filasSanitarias}</table>

      ${p.Observacio ? `<div class="obs">${p.Observacio}</div>` : ''}
    </div>`;
}

// ---------- 4. Cargar y dibujar las capas ----------
async function iniciar() {
  const [limiteData, divisionesData, viasData, arbolesData] = await Promise.all([
    cargarGeoJSON('data/limite.geojson'),
    cargarGeoJSON('data/divisiones.geojson'),
    cargarGeoJSON('data/vias.geojson'),
    cargarGeoJSON('data/arboles.geojson')
  ]);

  const limite = L.geoJSON(limiteData, {
    style: { color: '#ffffff', weight: 3, fill: false }
  }).addTo(map);

  const divisiones = L.geoJSON(divisionesData, {
    style: { color: '#f4c542', weight: 2, fillColor: '#f4c542', fillOpacity: 0.2 },
    onEachFeature: (feature, layer) => {
      layer.bindPopup('<b>' + feature.properties.Nombre + '</b>');
    }
  }).addTo(map);

  const vias = L.geoJSON(viasData, {
    style: { color: '#ff8c42', weight: 3 },
    onEachFeature: (feature, layer) => {
      layer.bindPopup('<b>' + feature.properties.Nombre + '</b>');
    }
  }).addTo(map);

  // Árboles: el color depende del estado sanitario
  const arboles = L.geoJSON(null, {
    pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
      radius: 7,
      fillColor: calcularEstado(feature.properties).color,
      color: '#ffffff',
      weight: 1.5,
      fillOpacity: 0.95
    }),
    onEachFeature: (feature, layer) => {
      layer.bindPopup(crearFicha(feature.properties));
    }
  }).addTo(map);

  // ---------- Panel: buscador y filtro ----------
  const todos = arbolesData.features;
  const panel = document.getElementById('panel');
  const buscador = document.getElementById('buscador');
  const select = document.getElementById('filtro-especie');
  const contador = document.getElementById('contador');

  L.DomEvent.disableClickPropagation(panel);
  L.DomEvent.disableScrollPropagation(panel);

  [...new Set(todos.map(f => f.properties.NOMBRE).filter(Boolean))].sort().forEach(nombre => {
    const op = document.createElement('option');
    op.value = nombre;
    op.textContent = nombre;
    select.appendChild(op);
  });

  function aplicarFiltros() {
    const texto = buscador.value.trim().toLowerCase();
    const especie = select.value;

    const filtrados = todos.filter(f => {
      const p = f.properties;
      const coincideTexto = !texto
        || String(p.NOMBRE).toLowerCase().includes(texto)
        || String(p.NUMERO) === texto;
      const coincideEspecie = !especie || p.NOMBRE === especie;
      return coincideTexto && coincideEspecie;
    });

    arboles.clearLayers();
    arboles.addData(filtrados);
    contador.textContent = filtrados.length + ' de ' + todos.length + ' árboles';

    if ((texto || especie) && filtrados.length > 0) {
      map.fitBounds(arboles.getBounds(), { padding: [60, 60], maxZoom: 19 });
    }
  }

  buscador.addEventListener('input', aplicarFiltros);
  select.addEventListener('change', aplicarFiltros);
  aplicarFiltros();

  // ---------- Leyenda ----------
  const leyenda = L.control({ position: 'bottomleft' });
  leyenda.onAdd = () => {
    const div = L.DomUtil.create('div', 'leyenda');
    div.innerHTML = '<b>Estado fitosanitario</b>' + ESTADOS.map(e =>
      `<div><span class="punto" style="background:${e.color}"></span>${e.nombre}</div>`
    ).join('');
    return div;
  };
  leyenda.addTo(map);

  // ---------- Vista inicial y control de capas ----------
  map.fitBounds(limite.getBounds());

  L.control.layers(
    { 'Satélite': satelite, 'Calles': calles },
    { 'Límite': limite, 'Divisiones': divisiones, 'Vías': vias, 'Árboles': arboles }
  ).addTo(map);
}

iniciar().catch(error => {
  console.error(error);
  alert('Error cargando los datos. Revisa que los 4 archivos estén en la carpeta data/ y que uses Live Server.');
});