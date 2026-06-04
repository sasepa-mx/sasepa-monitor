// ©️ SASEPAMx Derechos Reservados Prohibida su copia total o parcial sin autorización expresa

var listaHistorial = [];
var CONFIG_AUDIOS = {
    alertas: true,   
    intensidades: true, 
    sensores: true      
};
let mediaRecorder = null;
let fragmentosGrabacion = [];
let buferCircular = []; 
let intervaloBufer = null;
let streamGrabacion = null;

if (typeof mapboxgl !== 'undefined' && window.MAPBOX_ACCESS_TOKEN) {
    mapboxgl.accessToken = window.MAPBOX_ACCESS_TOKEN;
}

var MIS_SENSORES = (typeof window !== 'undefined' && window.MIS_SENSORES) ? window.MIS_SENSORES : [];
let mapUltimo = null;
let ultimaAlertaId = "";
var mostrandoHistorialMapa = false;
let lastSyncTime = 0;
let intervaloOndas = null;
let intervaloETA = null;
let userCoords = null;
let userMarkerUltimo = null;
let indiceInicial = 0;
let ultimoIndiceRandom = -1;
let enPausaDeEspera = false;
let audioContext;
let dest;
let fuenteFuerteIniciada = false;
let fuenteDebilIniciada = false;
let sonidoActivado = true;
let bloqueoPorAlerta = false;
var timersSensores = {};
let dvrBloqueadoPorSismo = false;
let dvrTiempoInicioSismo = null;
let dvrGrabandoSismo = false;
const VELOCIDAD_P = 6.0; 
const VELOCIDAD_S = 3.5;

try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('sasepa_historial')) {
        listaHistorial = JSON.parse(localStorage.getItem('sasepa_historial')) || [];
    }
} catch (e) { 
    listaHistorial = []; 
}

const pulsingDot = {
    width: 100, 
    height: 100, 
    data: new Uint8Array(100 * 100 * 4), 
    color: '255, 0, 0',
    onAdd: function () {
        const canvas = document.createElement('canvas');
        canvas.width = this.width; 
        canvas.height = this.height;
        this.context = canvas.getContext('2d');
    },
    render: function () {
        const duration = 1500;
        const t = (performance.now() % duration) / duration;
        const radius = (100 / 2) * 0.3;
        const outerRadius = (100 / 2) * 0.7 * t + radius;
        const context = this.context;

        context.clearRect(0, 0, this.width, this.height);
        context.beginPath();
        context.arc(this.width / 2, this.height / 2, outerRadius, 0, Math.PI * 2);
        context.fillStyle = `rgba(${this.color}, ${1 - t})`;
        context.fill();

        context.beginPath();
        context.arc(this.width / 2, this.height / 2, radius, 0, Math.PI * 2);
        context.fillStyle = `rgb(${this.color})`;
        context.strokeStyle = 'white';
        context.lineWidth = 2 + 4 * (1 - t);
        context.fill();
        context.stroke();

        this.data = context.getImageData(0, 0, this.width, this.height).data;
        if(mapUltimo) mapUltimo.triggerRepaint();
        return true;
    }
};

const ciudadesSasmexBase = [
    { id: 0, idTicker: "CMC", nombre: "Morelia", lat: 19.7006, lon: -101.1864 },
    { id: 1, idTicker: "CEMX", nombre: "CDMX", lat: 19.4326, lon: -99.1332 },
    { id: 2, idTicker: "CMX", nombre: "Toluca", lat: 19.2826, lon: -99.6557 },
    { id: 3, idTicker: "CPB", nombre: "Puebla", lat: 19.0414, lon: -98.2063 },
    { id: 4, idTicker: "CMR", nombre: "Cuernavaca", lat: 18.9261, lon: -99.2307 },
    { id: 5, idTicker: "COX", nombre: "Oaxaca", lat: 17.0732, lon: -96.7266 },
    { id: 6, idTicker: "CGR2", nombre: "Chilpancingo", lat: 17.5513, lon: -99.5005 },
    { id: 7, idTicker: "CGR1", nombre: "Acapulco", lat: 16.8531, lon: -99.8237 },
    { id: 8, idTicker: "CCL", nombre: "Colima", lat: 19.2433, lon: -103.7247 }
];

function toggleMenuAudio() {
    const menu = document.getElementById('menu-config-audio');
    menu.style.display = (menu.style.display === 'none') ? 'block' : 'none';
}

function actualizarCanalesAudio() {
    const chkAlertas = document.getElementById('check-audio-alertas');
    const chkIntensidades = document.getElementById('check-audio-intensidades');
    const chkSensores = document.getElementById('check-audio-sensores');

    if (chkAlertas) CONFIG_AUDIOS.alertas = chkAlertas.checked;
    if (chkIntensidades) CONFIG_AUDIOS.intensidades = chkIntensidades.checked;
    if (chkSensores) CONFIG_AUDIOS.sensores = chkSensores.checked;

    const icono = document.getElementById('icono-audio');
    const boton = document.getElementById('btn-toggle-audio');
    const silenciadoTotal = !CONFIG_AUDIOS.alertas && !CONFIG_AUDIOS.intensidades && !CONFIG_AUDIOS.sensores;
    
    if (silenciadoTotal) {
        if (icono) icono.className = 'fas fa-volume-mute';
        if (boton) boton.style.color = '#ff4d4d';
        sonidoActivado = false;
    } else {
        if (icono) icono.className = 'fas fa-volume-up';
        if (boton) boton.style.color = '#42df04';
        sonidoActivado = true;
    }
}

function toggleLeyenda() {
    const leyenda = document.querySelector('.leyenda');
    const btn = document.getElementById('btn-leyenda');
    const cuadroCiudades = document.getElementById('cuadro-ciudades');
    
    if (!leyenda) return;

    leyenda.classList.toggle('hidden');
    const estaOculto = leyenda.classList.contains('hidden');
    if (btn) {
        if (estaOculto) {
            btn.style.color = "#888";
            btn.style.borderColor = "rgba(255, 255, 255, 0.1)";
        } else {
            btn.style.color = "white";
            btn.style.borderColor = "var(--green-alert)";
        }
    }

    if (cuadroCiudades) {
        cuadroCiudades.style.cssText = ""; 
        
        if (estaOculto) {
            cuadroCiudades.classList.add('leyenda-oculta');
        } else {
            cuadroCiudades.classList.remove('leyenda-oculta');
        }

        const spans = cuadroCiudades.querySelectorAll('span');
        spans.forEach(s => s.style.fontSize = estaOculto ? "12px" : "11px");
    }
}

function inicializarMapa() {
    if (!mapboxgl.accessToken) {
        if (window.MAPBOX_ACCESS_TOKEN) {
            mapboxgl.accessToken = window.MAPBOX_ACCESS_TOKEN;
        } else {
            console.error("Error: Token de Mapbox no detectado.");
            return;
        }
    }

    if (typeof mapboxgl === 'undefined') return;

    const size = 150;
    window.pulsingDot = {
        width: size, 
        height: size, 
        data: new Uint8Array(size * size * 4), 
        color: "255, 0, 0",
        onAdd: function() {
            const canvas = document.createElement('canvas');
            canvas.width = this.width; 
            canvas.height = this.height;
            this.context = canvas.getContext('2d');
        },
        render: function() {
            const duration = 1000;
            const t = (performance.now() % duration) / duration;
            const radius = (size / 2) * 0.3;
            const outerRadius = (size / 2) * 0.7 * t + radius;
            const context = this.context;
            context.clearRect(0, 0, this.width, this.height);
            context.beginPath();
            context.arc(this.width / 2, this.height / 2, outerRadius, 0, Math.PI * 2);
            context.fillStyle = `rgba(${this.color}, ${1 - t})`;
            context.fill();
            context.beginPath();
            context.arc(this.width / 2, this.height / 2, radius, 0, Math.PI * 2);
            context.fillStyle = `rgba(${this.color}, 1)`;
            context.strokeStyle = 'white';
            context.lineWidth = 2 + 4 * (1 - t);
            context.fill(); 
            context.stroke();
            this.data = context.getImageData(0, 0, this.width, this.height).data;
            if (mapUltimo) mapUltimo.triggerRepaint();
            return true;
        }
    };

    if (!mapUltimo) {
        mapUltimo = new mapboxgl.Map({
            container: 'mapa-ultimo-evento',
            style: 'mapbox://styles/mapbox/navigation-night-v1',
            center: [-98.8525, 17.8322],
            zoom: 5.8,
            interactive: true, 
            attributionControl: false
        });
        mapUltimo.addControl(new mapboxgl.NavigationControl(), 'top-left');
    }

    const popupSensores = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, className: 'popup-sensor-sasepa' });

    const cargarTodo = () => {
        if (!mapUltimo.hasImage('dot-epi')) mapUltimo.addImage('dot-epi', pulsingDot, { pixelRatio: 2 });

        if (!mapUltimo.getSource('sensores-alerta')) {
            mapUltimo.addSource('sensores-alerta', { 
                'type': 'geojson', 
                'data': { 'type': 'FeatureCollection', 'features': [] },
                'generateId': true 
            });
            const colorLogic = [
                'case',
                'boolean', ['feature-state', 'reportando'], false], '#00d4ff',
                ['!=', ['feature-state', 'color'], null], ['feature-state', 'color'],
                ['get', 'color']
            ];

            mapUltimo.addLayer({ 'id': 'layer-sensores-alerta-glow', 'type': 'circle', 'source': 'sensores-alerta', 'paint': { 'circle-radius': 14, 'circle-color': colorLogic, 'circle-blur': 2.5, 'circle-opacity': 0.5 } });
            mapUltimo.addLayer({ 'id': 'layer-sensores-alerta', 'type': 'circle', 'source': 'sensores-alerta', 'paint': { 'circle-radius': 5, 'circle-color': colorLogic, 'circle-stroke-width': 0 } });
            mapUltimo.addLayer({ 'id': 'layer-sensores-alerta-reflejo', 'type': 'circle', 'source': 'sensores-alerta', 'paint': { 'circle-radius': 1.8, 'circle-color': 'transparent', 'circle-opacity': 0.7, 'circle-translate': [-1.2, -1.2] } });
        }

        if (!mapUltimo.getSource('ondas')) {
            mapUltimo.addSource('ondas', { 'type': 'geojson', 'data': { 'type': 'FeatureCollection', 'features': [] } });
            mapUltimo.addLayer({
                'id': 'layer-ondas', 
                'type': 'fill', 
                'source': 'ondas',
                'paint': {
                    'fill-color': ['case', ['==', ['get', 'tipo'], 'P'], '#ffffff', ['get', 'color']],
                    'fill-opacity': ['case', ['==', ['get', 'tipo'], 'P'], 0.1, 0.3],
                    'fill-outline-color': ['case', ['==', ['get', 'tipo'], 'P'], '#ffffff', ['get', 'color']]
                }
            });
        }

        if (window.MIS_SENSORES) {
            const featuresBase = window.MIS_SENSORES.map((s, index) => ({ 
                'type': 'Feature', 'id': index, 'properties': { 'nombre': s.nombre, 'color': '#00ff00' }, 'geometry': { 'type': 'Point', 'coordinates': [parseFloat(s.lon), parseFloat(s.lat)] }
            }));
            mapUltimo.getSource('sensores-alerta').setData({ 'type': 'FeatureCollection', 'features': featuresBase });
        }
        setTimeout(() => { reporteInicialSensores(); mostrarStatusServidorv7(); }, 1000);
        if (typeof mostrarUbicacionUsuario === 'function') mostrarUbicacionUsuario();
    };

    mapUltimo.on('style.load', cargarTodo);
    if (mapUltimo.isStyleLoaded()) cargarTodo();

    mapUltimo.on('mouseenter', 'layer-sensores-alerta', (e) => {
        mapUltimo.getCanvas().style.cursor = 'pointer';
        const coords = e.features[0].geometry.coordinates.slice();
        popupSensores.setLngLat(coords).setHTML(`<div style="padding: 2px; font-weight: bold; font-family: Arial; font-size: 12px;">${e.features[0].properties.nombre}</div>`).addTo(mapUltimo);
    });
    mapUltimo.on('mouseleave', 'layer-sensores-alerta', () => { mapUltimo.getCanvas().style.cursor = ''; popupSensores.remove(); });
}

function reinstalarCapasOndas() {
    if (!mapUltimo) return;
    if (!mapUltimo.getSource('ondas')) {
        mapUltimo.addSource('ondas', { 
            'type': 'geojson', 
            'data': { 'type': 'FeatureCollection', 'features': [] } 
        });
        mapUltimo.addLayer({ 
            'id': 'ondaS', 
            'type': 'fill', 
            'source': 'ondas', 
            'paint': { 'fill-color': ['get', 'color'], 'fill-opacity': 0.3 }, 
            'filter': ['==', 'tipo', 'S'] 
        });
        mapUltimo.addLayer({ 
            'id': 'ondaP', 
            'type': 'line', 
            'source': 'ondas', 
            'paint': { 'line-color': '#facc15', 'line-width': 2 }, 
            'filter': ['==', 'tipo', 'P'] 
        });
       
        mapUltimo.off('click');

        mapUltimo.on('click', async () => {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioContext.state === 'suspended' || audioContext.state === 'interrupted') {
                await audioContext.resume();
            }
        });
    }
}

function cambiarEstiloMapa(nuevoEstiloURL) {
    if (!mapUltimo) return;
    mapUltimo.setStyle(nuevoEstiloURL);
    mapUltimo.once('style.load', () => {
        inicializarCapasMapa(); 
        if (window.MIS_SENSORES) {
            resetearSensores(); 
        }
    });
}

function crearCirculo(centro, radioKm) {
    const puntos = 64; 
    const kmEnGrados = 1 / 110.574; 
    const ret = [];
    for (let i = 0; i < puntos; i++) {
        const angulo = (i / puntos) * (Math.PI * 2);
        const lat = centro[1] + (radioKm * kmEnGrados) * Math.cos(angulo);
        const lng = centro[0] + (radioKm * kmEnGrados / Math.cos(centro[1] * Math.PI / 180)) * Math.sin(angulo);
        ret.push([lng, lat]);
    }
    ret.push(ret[0]);
    return [ret];
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
    if (lat1 === 0 || lon1 === 0 || lat2 === 0 || lon2 === 0) {
        return 999999;
    }

    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function ejecutarNuevaAlerta(d, permitirAcciones = false) {
    const intInput = (d.intensidad || "").toUpperCase();
    let esSeveroVisual = (intInput.includes("SEVERO") || intInput.includes("SEVERE"));
    let esFuerteVisual = (intInput.includes("FUERTE") || intInput.includes("STRONG"));
    let esModeradoVisual = (intInput.includes("MODERADO") || intInput.includes("MODERATE"));
    let esLigeroVisual = (intInput.includes("LIGERO") || intInput.includes("LIGHT"));
    if (esSeveroVisual) window.tipoOrigenActual = "SEVERO";
    else if (esFuerteVisual) window.tipoOrigenActual = "FUERTE";
    else if (esModeradoVisual) window.tipoOrigenActual = "MODERADO";
    else window.tipoOrigenActual = "LIGERO";
    let colorOndaDinamico = '#0055ff'; 
    if (esSeveroVisual) colorOndaDinamico = '#ff0000';
    else if (esFuerteVisual) colorOndaDinamico = '#ff0000';
    else if (esModeradoVisual) colorOndaDinamico = '#ffff00';
    const sismoLat = float(d.lat || 0);
    const sismoLon = float(d.lon || 0);
    let distanciaKM = 0;
    if (userCoords && sismoLat !== 0 && sismoLon !== 0) {
        distanciaKM = calcularDistancia(userCoords[1], userCoords[0], sismoLat, sismoLon);
    }
    let esMismoSismo = false;
    if (window.lastSismoLat && window.lastSismoLon) {
        let distanciaEntreReportes = calcularDistancia(window.lastSismoLat, window.lastSismoLon, sismoLat, sismoLon);
        if (distanciaEntreReportes < 30 || window.lastSismoZona === d.zona) {
            esMismoSismo = true;
        }
    }
    if (bloqueoPorAlerta && esMismoSismo) {
        console.log(`▲ SASEPA: Escalación/Actualización del sismo actual: ${window.tipoOrigenActual}`);
        window.colorOndaSActualPersistente = colorOndaDinamico;
        if (esFuerteVisual || esSeveroVisual) {
            const audiosAQuitar = ['sonidoEvento', 'sonidointensidadleve', 'sonidointensidadmoderado'];
            audiosAQuitar.forEach(id => {
                const audioNode = document.getElementById(id);
                if (audioNode) { audioNode.pause(); audioNode.currentTime = 0; }
            });
            if (permitirAcciones && sonidoActivado) {
                const sGralFuerte = document.getElementById('sonidoEventoFuerte');
                const sIntFuerte = document.getElementById('sonidointensidadfuerte');
                if (CONFIG_AUDIOS.alertas && sGralFuerte && sGralFuerte.paused) { sGralFuerte.loop = false; sGralFuerte.play().catch(e => {}); }
                if (CONFIG_AUDIOS.intensidades && sIntFuerte && sIntFuerte.paused) { sIntFuerte.loop = false; sIntFuerte.play().catch(e => {}); }
            }
        }
    } 
    else {
        window.lastSismoLat = sismoLat;
        window.lastSismoLon = sismoLon;
        window.lastSismoZona = d.zona;
        if (window.timeoutCierre) clearTimeout(window.timeoutCierre);
        if (window.timeoutCierreSismoDos) clearTimeout(window.timeoutCierreSismoDos); 
        if (window.intervaloETA) { clearInterval(window.intervaloETA); window.intervaloETA = null; }
        if (window.timerTicker) clearTimeout(window.timerTicker);
        if (window.intervaloOndas) { clearInterval(window.intervaloOndas); window.intervaloOndas = null; }
        if (mapUltimo) {
            ['ondas', 'lineas-sensores', 'epicentro', 'ciudades-difusion'].forEach(f => {
                if (mapUltimo.getSource(f)) mapUltimo.getSource(f).setData({ 'type': 'FeatureCollection', 'features': [] });
            });
            if (mapUltimo.getLayer('layer-sensores-puntos')) mapUltimo.setPaintProperty('layer-sensores-puntos', 'circle-color', '#00ff00');
        }
        if (window.sensoresQueYaSonaron) window.sensoresQueYaSonaron.clear();
        else window.sensoresQueYaSonaron = new Set();
        const canalesAudio = ['sonidoEvento', 'sonidoEventoFuerte', 'sonidointensidadleve', 'sonidointensidadmoderado', 'sonidointensidadfuerte'];
        canalesAudio.forEach(id => {
            const audioNode = document.getElementById(id);
            if (audioNode) { audioNode.pause(); audioNode.currentTime = 0; audioNode.loop = false; }
        });
        const oldPanic = document.getElementById('panic-overlay');
        if (oldPanic) oldPanic.remove();
        if (userCoords) {
            let miEstadoCalculado = "CDMX";
            const uLon = userCoords[0]; const uLat = userCoords[1];
            if (uLon < -104.0 && uLat > 19.5) miEstadoCalculado = "Jalisco";
            else if (uLon < -103.4 && uLat >= 18.7 && uLat <= 19.5) miEstadoCalculado = "Colima";
            else if (uLon >= -103.4 && uLon <= -102.0 && uLat <= 19.0) miEstadoCalculado = "Michoacán";
            else if (uLon >= -102.0 && uLon <= -98.5 && uLat >= 16.2 && uLat <= 18.4) miEstadoCalculado = "Guerrero";
            else if (uLon > -98.5 && uLon <= -94.0 && uLat <= 18.0) miEstadoCalculado = "Oaxaca";
            else if (uLon >= -98.8 && uLon <= -97.3 && uLat >= 17.9 && uLat <= 19.5) miEstadoCalculado = "Puebla";
            else if (uLon >= -99.4 && uLon <= -98.9 && uLat >= 18.5 && uLat <= 19.1) miEstadoCalculado = "Morelos";
            else if (uLon >= -99.4 && uLon <= -98.9 && uLat >= 19.0 && uLat <= 19.6) miEstadoCalculado = "CDMX";
            else if (uLon >= -100.6 && uLon <= -98.6 && uLat >= 18.3 && uLat <= 20.3) miEstadoCalculado = "Edomex";
            if (!d.esSimulacion) {
                let estadoEstaPermitido = false;
                if (d.estados_permitidos === "TODOS") estadoEstaPermitido = true;
                else if (Array.isArray(d.estados_permitidos)) estadoEstaPermitido = d.estados_permitidos.includes(miEstadoCalculado);
                else if (typeof d.estados_permitidos === 'string') estadoEstaPermitido = d.estados_permitidos.replace(/\s+/g, '').includes(miEstadoCalculado);
                
                if (d.estados_permitidos && !estadoEstaPermitido) return; 
                // Si es severo, se ignora el límite de 190km para estados no asignados
                if (!(esFuerteVisual || esSeveroVisual) && distanciaKM > 190) {
                    if (!estadoEstaPermitido) return; 
                }
            }
        }
        if (permitirAcciones && sonidoActivado) {
            const sLeve = document.getElementById('sonidointensidadleve');
            const sMod = document.getElementById('sonidointensidadmoderado');
            const sFuerteAudio = document.getElementById('sonidointensidadfuerte');
            const sGralDebil = document.getElementById('sonidoEvento');
            const sGralFuerte = document.getElementById('sonidoEventoFuerte');
            enviarNotificacionPush(d);
            if (CONFIG_AUDIOS.intensidades) {
                let sonidoSensor = sLeve;
                if (esSeveroVisual || esFuerteVisual) sonidoSensor = sFuerteAudio;
                else if (esModeradoVisual) sonidoSensor = sMod;
                if (sonidoSensor) { sonidoSensor.loop = false; sonidoSensor.currentTime = 0; sonidoSensor.play().catch(e => {}); }
            }
            if (CONFIG_AUDIOS.alertas) {
                let sonidoGral = (esSeveroVisual || esFuerteVisual) ? sGralFuerte : sGralDebil;
                setTimeout(() => { if (sonidoGral) { sonidoGral.loop = false; sonidoGral.currentTime = 0; sonidoGral.play().catch(e => {}); } }, 800);
            }
        }
        cortarYGuardarSismo();
        bloqueoPorAlerta = true;
        limpiarReportesDeSensoresParaAlerta();
    }
    let tiempoDesfase = 0;
    if (d.timestamp_inicio) tiempoDesfase = (Date.now() - d.timestamp_inicio) / 1000;
    let intensidadLocal = "Imperceptible";
    let colorPercepcion = "#00FFFF"; 
    let distFinal = distanciaKM.toFixed(0);
    if (userCoords && sCoordinateMatch()) {
        if (esSeveroVisual) {
            intensidadLocal = "Fuerte";
            colorPercepcion = "#FF2A00";
        } 
        else if (esFuerteVisual) {
            if (distanciaKM < 800) { intensidadLocal = "Fuerte"; colorPercepcion = "#FF2A00"; }
            else if (distanciaKM < 1000) { intensidadLocal = "Moderado"; colorPercepcion = "#facc15"; }
            else if (distanciaKM < 1200) { intensidadLocal = "Ligero"; colorPercepcion = "#3b82f6"; }
        } 
        else if (esModeradoVisual) {
            if (distanciaKM < 70) { intensidadLocal = "Moderado"; colorPercepcion = "#facc15"; }
            else if (distanciaKM < 100) { intensidadLocal = "Ligero"; colorPercepcion = "#3b82f6"; }
        } 
        else {
            if (distanciaKM < 70) { intensidadLocal = "Ligero"; colorPercepcion = "#3b82f6"; }
        }
    }
    function sCoordinateMatch() { return sismoLat !== 0 && sismoLon !== 0; }
    const banner = document.getElementById('alert-container');
    const bannerBg = document.getElementById('banner-bg');
    const titleEl = document.getElementById('alert-title');
    const zoneEl = document.getElementById('alert-zone');
    const magEl = document.getElementById('alert-mag');
    const etaEl = document.getElementById('alert-eta');
    const percepcionEl = document.getElementById('alert-percepcion');
    const alertFecha = document.getElementById('alert-fecha');
    if (alertFecha) {
        const grandmother = new Date();
        alertFecha.textContent = d.fecha || `${grandmother.toLocaleDateString('es-MX')} ${grandmother.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    }
    if (bannerBg) bannerBg.classList.remove('fuerte-glow', 'moderado-glow');
    if (!(esFuerteVisual || esSeveroVisual)) {
        const ticker = document.getElementById('ticker-text');
        if (ticker) {
            const nombreAMostrar = d.sensor || d.zona || "SENSOR";
            ticker.innerHTML = `<b style="color: #ffffff;">${nombreAMostrar.toUpperCase()}: #TenemosSismo </b>`;
            ticker.style.opacity = "1";
        }
    }
    if (percepcionEl) {
        if (etaEl) {
            etaEl.style.color = colorPercepcion;
            if (etaEl.parentElement) etaEl.parentElement.style.color = colorPercepcion;
        }
        percepcionEl.innerHTML = `<span style="color: ${colorPercepcion}">Intensidad en tu ubicación: ${intensidadLocal.toUpperCase()}</span> <br>
                                  <span style="color: #bbb; font-size: 0.9em;">Distancia al epicentro: ${distFinal} km</span>`;
    }
    let textoFinal = "Ligero";
    let colorTextoOrigen = "#0055ff";
    if (bannerBg) {
        if (esSeveroVisual) {
            textoFinal = "Severo"; colorTextoOrigen = "#df1616"; 
            bannerBg.style.background = "linear-gradient(180deg, #dd1313 0%, #ff0000 100%)"; bannerBg.classList.add('fuerte-glow');
        } else if (esFuerteVisual) {
            textoFinal = "Fuerte"; colorTextoOrigen = "#FF2A00"; 
            bannerBg.style.background = "linear-gradient(180deg, #ff0000 0%, #8b0000 100%)"; bannerBg.classList.add('fuerte-glow');
        } else if (esModeradoVisual) {
            textoFinal = "Moderado"; colorTextoOrigen = "#ffff00"; 
            bannerBg.style.background = "linear-gradient(180deg, #ffff00 0%, #b5b500 100%)"; bannerBg.classList.add('moderado-glow');
        } else {
            textoFinal = "Ligero"; colorTextoOrigen = "#3b82f6"; 
            bannerBg.style.background = "linear-gradient(180deg, #0055ff 0%, #002288 100%)"; bannerBg.classList.add('moderado-glow');
        }
    }
    if (titleEl) titleEl.textContent = d.esSimulacion ? "SIMULACIÓN DE SISMO" : "SISMO DETECTADO";
    if (banner) banner.style.display = 'block';
    if (zoneEl) zoneEl.textContent = d.zona || '--';
    if (magEl) { magEl.textContent = textoFinal; magEl.style.color = colorTextoOrigen; }
    if (intensidadLocal === "Fuerte") {
        let panicOverlay = document.getElementById('panic-overlay');
        if (!panicOverlay) {
            panicOverlay = document.createElement('div'); panicOverlay.id = 'panic-overlay';
            panicOverlay.className = 'modo-panico'; document.getElementById('app-content').appendChild(panicOverlay);
        }
    }
    if (mapUltimo && sCoordinateMatch()) {
        requestAnimationFrame(() => {
            if (typeof actualizarMarcadorEpicentro === 'function') {
                actualizarMarcadorEpicentro(sCoordinateMatch ? sismoLat : 0, sCoordinateMatch ? sismoLon : 0, textoFinal);
            }
            if (!window.intervaloOndas && typeof dibujarOndas === 'function') {
                dibujarOndas(sismoLat, sismoLon, mapUltimo, colorOndaDinamico, tiempoDesfase);
            }
        });
        if (etaEl && userCoords && !window.intervaloETA) {
            const dist = calcularDistancia(userCoords[1], userCoords[0], sismoLat, sismoLon);
            let segs = Math.round(dist / 3.4) - Math.round(tiempoDesfase);
            window.intervaloETA = setInterval(() => {
                segs--; etaEl.textContent = segs >= 0 ? segs : "0";
                if (segs < -10) { clearInterval(window.intervaloETA); window.intervaloETA = null; }
            }, 1000);
        }
    }
    if (sCoordinateMatch()) actualizarCirculosCiudades(sismoLat, sismoLon, d.intensidad);
    if (window.timeoutCierre) clearTimeout(window.timeoutCierre);
    if (window.timeoutCierreSismoDos) clearTimeout(window.timeoutCierreSismoDos);
    window.timeoutCierre = setTimeout(() => { detenerAlerta(); window.intervaloETA = null; }, 500000);
    window.timeoutCierreSismoDos = setTimeout(() => { resetearSensores(); }, 500000);
}

function actualizarCirculosCiudades(latEpi, lonEpi, intensidadGeneral) {
    if (!mapUltimo) return;
    let cuadro = document.getElementById('cuadro-ciudades');
    if (!cuadro) {
        cuadro = document.createElement('div'); cuadro.id = 'cuadro-ciudades';
        document.body.appendChild(cuadro);
    }
    cuadro.style.display = "block";
    const leyendaCerrada = document.querySelector('.leyenda')?.classList.contains('hidden');
    const dynamicFontSize = leyendaCerrada ? "12px" : "10px";
    const ciudadesSasmex = [
        { nombre: "Morelia", lat: 19.7006, lon: -101.1864 },
        { nombre: "CDMX", lat: 19.4326, lon: -99.1332 },
        { nombre: "Toluca", lat: 19.2826, lon: -99.6557 },
        { nombre: "Puebla", lat: 19.0414, lon: -98.2063 },
        { nombre: "Cuernavaca", lat: 18.9261, lon: -99.2307 },
        { nombre: "Oaxaca", lat: 17.0732, lon: -96.7266 },
        { nombre: "Chilpancingo", lat: 17.5513, lon: -99.5005 },
        { nombre: "Acapulco", lat: 16.8531, lon: -99.8237 },
        { nombre: "Colima", lat: 19.2433, lon: -103.7247 }
    ];
    let htmlInterno = `<div style="font-size:9px; font-weight:bold; border-bottom:1px solid #444; margin-bottom:8px; padding-bottom:4px; text-align:center; color:#aaa; letter-spacing:1px;">INTENSIDAD ESTIMADA</div>`;
    const featuresCiudades = ciudadesSasmex.map(c => {
        const dist = calcularDistancia(latEpi, lonEpi, c.lat, c.lon); 
        let colorTxt = "#40f184"; 
        let etiqueta = "Imperceptible 🟢";
        const intUpper = (intensidadGeneral || "").toUpperCase();
        let esSevero = intUpper.includes("SEVERO") || intUpper.includes("SEVERE");
        let esFuerte = intUpper.includes("FUERTE") || intUpper.includes("STRONG");
        let esModerado = intUpper.includes("MODERADO") || intUpper.includes("MODERATE");
        if (esSevero) {
            colorTxt = "#ff0000";
            etiqueta = "Fuerte 🔴";
        } 
        else if (esFuerte) {
            if (dist < 800) { colorTxt = "#ff0000"; etiqueta = "Fuerte 🔴"; }
            else if (dist < 1000) { colorTxt = "#facc15"; etiqueta = "Moderado 🟡"; }
            else if (dist < 1200) { colorTxt = "#3b82f6"; etiqueta = "Ligero 🔵"; }
        } 
        else if (esModerado) {
            if (dist < 70) { colorTxt = "#facc15"; etiqueta = "Moderado 🟡"; }
            else if (dist < 500) { colorTxt = "#3b82f6"; etiqueta = "Ligero 🔵"; }
        } 
        else { 
            if (dist < 70) { colorTxt = "#3b82f6"; etiqueta = "Ligero 🔵"; }
        }
        htmlInterno += `
            <div style="display:flex; justify-content:space-between; margin-bottom:4px; align-items:center; width: 100%;">
                <span style="color:#eee; font-size:${dynamicFontSize}; font-weight:500;">${c.nombre}</span>
                <span style="color:${colorTxt}; font-size:${dynamicFontSize}; font-weight:900;">${etiqueta}</span>
            </div>`;
        return {
            'type': 'Feature',
            'properties': { 'nombre': c.nombre, 'color': colorTxt },
            'geometry': { 'type': 'Point', 'coordinates': [c.lon, c.lat] }
        };
    });
    cuadro.innerHTML = htmlInterno;
    const geojsonData = { 'type': 'FeatureCollection', 'features': featuresCiudades };
    if (mapUltimo.getSource('ciudades-difusion')) {
        mapUltimo.getSource('ciudades-difusion').setData(geojsonData);
    } else {
        mapUltimo.addSource('ciudades-difusion', { 'type': 'geojson', 'data': geojsonData });
        mapUltimo.addLayer({
            'id': 'layer-ciudades-circulo',
            'type': 'circle',
            'source': 'ciudades-difusion',
            'paint': {
                'circle-radius': 9,
                'circle-color': 'rgba(0,0,0,0)', 
                'circle-stroke-width': 3, 
                'circle-stroke-color': ['get', 'color'],
                'circle-blur': 0.1
            }
        });
    }
    if (window.tCuadro) clearTimeout(window.tCuadro);
    window.tCuadro = setTimeout(() => { 
        if (cuadro) cuadro.style.display = "none"; 
        if (mapUltimo.getSource('ciudades-difusion')) {
            mapUltimo.getSource('ciudades-difusion').setData({ 'type': 'FeatureCollection', 'features': [] });
        }
    }, 300000);
}

function dibujarOndas(lat, lon, mapa, colorS, desfase = 0) {
    if (!mapa || !mapa.getSource('ondas')) return;
    window.colorOndaSActualPersistente = colorS;
    if (window.intervaloOndas) return; 
    const inicio = Date.now() - (desfase * 1000);
    let lineasFeatures = [];
    let sensoresConEstado = MIS_SENSORES.filter(s => s.lat && s.lon).map(s => ({
        ...s,
        dist: calcularDistancia(lat, lon, parseFloat(s.lat), parseFloat(s.lon)),
        colorPersistente: '#00ff00',
        yaSonado: false
    })).sort((a, b) => a.dist - b.dist);
    window.intervaloOndas = setInterval(() => {
        try {
            const segs = (Date.now() - inicio) / 1000;
            const rP = segs * 6.0;
            const rS = segs * 3.4;
            if (segs > 240 || rP > 1440) {
                clearInterval(window.intervaloOndas);
                window.intervaloOndas = null;
                if (mapa.getSource('ondas')) mapa.getSource('ondas').setData({ 'type': 'FeatureCollection', 'features': [] });
                if (mapa.getSource('lineas-sensores')) mapa.getSource('lineas-sensores').setData({ 'type': 'FeatureCollection', 'features': [] });
                const tickerEl = document.getElementById('ticker-text');
                if (tickerEl) tickerEl.innerHTML = "";
                return;
            }
            let ultimoSensorTexto = "";
            const origenActual = window.tipoOrigenActual || "LIGERO";
            const colorOndaSDinamico = window.colorOndaSActualPersistente || colorS;
            let topeMaximo = 6; 
            if (origenActual === "MODERADO") topeMaximo = 10; 
            else if (origenActual === "FUERTE") topeMaximo = 30;  
            else if (origenActual === "SEVERO") topeMaximo = 40;  
            const featuresSensores = sensoresConEstado.map((s, index) => {
                let colorActual = s.colorPersistente;
                if (index < topeMaximo && rS >= s.dist) {
                    if (!s.yaSonado && typeof sonidoActivado !== 'undefined' && sonidoActivado) {
                        s.yaSonado = true;
                        let idAudio = 'sonidointensidadleve';
                        if (origenActual === "SEVERO" || origenActual === "FUERTE") {
                            idAudio = (index < 15) ? 'sonidointensidadfuerte' : 'sonidointensidadmoderado';
                        } else if (origenActual === "MODERADO") {
                            idAudio = (index < 6) ? 'sonidointensidadmoderado' : 'sonidointensidadleve';
                        }
                        const sonidoBase = document.getElementById(idAudio);
                        if (sonidoBase) {
                            const clonSonido = sonidoBase.cloneNode();
                            clonSonido.volume = (idAudio === 'sonidointensidadfuerte') ? 0.8 : 0.5;
                            clonSonido.play().catch(e => {});
                        }
                    }
                    if (origenActual === "SEVERO") {
                        if (index < 15) colorActual = '#ff0000';         
                        else if (index < 40) colorActual = '#ffff00';    
                        else colorActual = '#0055ff';                    
                    } else if (origenActual === "FUERTE") {
                        if (index < 5) colorActual = '#ff0000';          
                        else if (index < 30) colorActual = '#ffff00';     
                        else colorActual = '#0055ff';                    
                    } else if (origenActual === "MODERADO") {
                        if (index < 6) colorActual = '#ffff00';          
                        else colorActual = '#0055ff';                    
                    } else { 
                        colorActual = '#0055ff';                         
                    }
                    s.colorPersistente = colorActual;
                    const idSensor = s.nombre || s.id || "S";
                    ultimoSensorTexto = `<span style="color:${colorActual}">${idSensor.toUpperCase()} </span>`;
                    const yaTieneLinea = lineasFeatures.some(l => l.properties.id === idSensor);
                    if (!yaTieneLinea) {
                        lineasFeatures.push({
                            'type': 'Feature',
                            'properties': { 'id': idSensor },
                            'geometry': {
                                'type': 'LineString',
                                'coordinates': [[lon, lat], [parseFloat(s.lon), parseFloat(s.lat)]]
                            }
                        });
                    }
                }
                return {
                    'type': 'Feature',
                    'properties': { 'color': colorActual, 'nombre': s.nombre },
                    'geometry': { 'type': 'Point', 'coordinates': [parseFloat(s.lon), parseFloat(s.lat)] }
                };
            });
            const tickerEl = document.getElementById('ticker-text');
            if (tickerEl && ultimoSensorTexto !== "") {
                if (tickerEl.innerHTML !== ultimoSensorTexto) tickerEl.innerHTML = ultimoSensorTexto;
                if (window.timerTicker) clearTimeout(window.timerTicker);
                window.timerTicker = setTimeout(() => { tickerEl.innerHTML = ""; }, 6000);
            }
            if (mapa.getSource('lineas-sensores')) mapa.getSource('lineas-sensores').setData({ 'type': 'FeatureCollection', 'features': lineasFeatures });
            if (mapa.getSource('sensores-alerta')) mapa.getSource('sensores-alerta').setData({ 'type': 'FeatureCollection', 'features': featuresSensores });
            const circuloP = crearCirculo([lon, lat], rP);
            const circuloS = crearCirculo([lon, lat], rS);
            if (mapa.getSource('ondas')) {
                mapa.getSource('ondas').setData({
                    'type': 'FeatureCollection',
                    'features': [
                        { 'type': 'Feature', 'properties': { 'tipo': 'P' }, 'geometry': { 'type': 'Polygon', 'coordinates': circuloP } },
                        { 'type': 'Feature', 'properties': { 'tipo': 'S', 'color': colorOndaSDinamico }, 'geometry': { 'type': 'Polygon', 'coordinates': circuloS } }
                    ]
                });
            }
        } catch (error) {
            console.error("Error en intervalo dibujarOndas:", error);
        }
    }, 100);
}

function float(val) {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
}

function actualizarMarcadorEpicentro(lat, lon, intensidadOrigen) {
    if (!mapUltimo) return;

    let colorEpicentro = '#0055ff'; 
    const intUpper = (intensidadOrigen || "").toUpperCase();

    if (intUpper.includes("SEVERO") || intUpper.includes("SEVERE")) {
        colorEpicentro = '#db4141'; 
    } else if (intUpper.includes("FUERTE") || intUpper.includes("STRONG")) {
        colorEpicentro = '#ff0000'; 
    } else if (intUpper.includes("MODERADO") || intUpper.includes("MODERATE")) {
        colorEpicentro = '#ffff00'; 
    } else {
        colorEpicentro = '#0055ff'; 
    }

    const geojsonEpicentro = {
        'type': 'FeatureCollection',
        'features': [{
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [parseFloat(lon), parseFloat(lat)] 
            }
        }]
    };

    if (mapUltimo.getSource('epicentro')) {
        mapUltimo.getSource('epicentro').setData(geojsonEpicentro);
    }

    if (mapUltimo.getLayer('layer-epicentro-punto')) {
        mapUltimo.setPaintProperty('layer-epicentro-punto', 'circle-color', colorEpicentro);
    }
}

function lanzarPruebaSasepa() {
    const menuViejo = document.getElementById('sasepa-sim-menu');
    if (menuViejo) menuViejo.remove();
    const menuHTML = document.createElement('div');
    menuHTML.id = 'sasepa-sim-menu';
    menuHTML.style.position = 'absolute';
    menuHTML.style.top = '20px';
    menuHTML.style.left = '50%';
    menuHTML.style.transform = 'translateX(-50%)';
    menuHTML.style.zIndex = '99999';
    menuHTML.style.backgroundColor = 'rgba(15, 15, 20, 0.95)';
    menuHTML.style.backdropFilter = 'blur(10px)';
    menuHTML.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    menuHTML.style.borderRadius = '12px';
    menuHTML.style.padding = '16px 24px';
    menuHTML.style.fontFamily = "'Segoe UI', Roboto, sans-serif";
    menuHTML.style.color = '#ffffff';
    menuHTML.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.7)';
    menuHTML.style.textAlign = 'center';
    menuHTML.style.minWidth = '420px';

    menuHTML.innerHTML = `
        <h4 style="margin: 0 0 8px 0; font-size: 16px; color: #00bcff; text-transform: uppercase; letter-spacing: 1px;">Simulación SASEPA</h4>
        <p id="sim-instruccion" style="margin: 0; font-size: 13px; color: #cccccc;">📡 Selecciona un <b>sensor</b> activo en el mapa para usarlo como origen.</p>
        <button id="btn-cancelar-sim" style="margin-top: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #aaa; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 11px;">Cancelar</button>
    `;

    document.body.appendChild(menuHTML);
    mapUltimo.getCanvas().style.cursor = 'crosshair';
    document.getElementById('btn-cancelar-sim').onclick = () => {
        mapUltimo.getCanvas().style.cursor = '';
        menuHTML.remove();
    };
    
    mapUltimo.once('click', (e) => {
        const { lng, lat } = e.lngLat;

        if (!window.MIS_SENSORES || window.MIS_SENSORES.length === 0) {
            console.error("No se encontró el array de sensores.");
            mapUltimo.getCanvas().style.cursor = '';
            menuHTML.remove();
            return;
        }
        let sensorMasCercano = null;
        let distanciaMinima = Infinity;

        window.MIS_SENSORES.forEach(sensor => {
            const R = 6371; 
            const dLat = (sensor.lat - lat) * Math.PI / 180;
            const dLon = (sensor.lon - lng) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat * Math.PI / 180) * Math.cos(sensor.lat * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distancia = R * c; 

            if (distancia < distanciaMinima) {
                distanciaMinima = distancia;
                sensorMasCercano = sensor;
            }
        });
        const kmTolerancia = 15;
        if (distanciaMinima > kmTolerancia) {
            mapUltimo.getCanvas().style.cursor = '';
            const instruccion = document.getElementById('sim-instruccion');
            if (instruccion) {
                instruccion.innerHTML = `⚠️ <span style="color: #ff3333;">ERROR: Debes seleccionar un sensor.</span><br>Por favor, selecciona un sensor o cancela la simulación.`;
            }
            setTimeout(() => { lanzarPruebaSasepa(); }, 1500);
            return;
        }

        mapUltimo.getCanvas().style.cursor = '';
        const obtenerZonaDinamica = (nombreEstacion) => {
            if (!nombreEstacion) return "Zona de Cobertura Interna";
            const nombreUpper = nombreEstacion.toUpperCase();
            if (nombreUpper.includes("JL") || nombreUpper.includes("JALISCO")) return "Costa de Jalisco";
            if (nombreUpper.includes("CL") || nombreUpper.includes("COLIMA")) return "Costa de Colima";
            if (nombreUpper.includes("MC") || nombreUpper.includes("MICHOACÁN") || nombreUpper.includes("MICHOACAN")) return "Costa/Zona de Michoacán";
            if (nombreUpper.includes("GR") || nombreUpper.includes("GUERRERO")) return "Costa/Zona de Guerrero";
            if (nombreUpper.includes("PB") || nombreUpper.includes("PUEBLA")) return "Puebla";
            if (nombreUpper.includes("OX") || nombreUpper.includes("OAXACA")) return "Costa/Zona de Oaxaca";
            return "Zona de Cobertura Interna"; 
        };

        const zonaIdentificada = obtenerZonaDinamica(sensorMasCercano.nombre);

        menuHTML.innerHTML = `
            <h4 style="margin: 0 0 6px 0; font-size: 14px; color: #00bcff; text-transform: uppercase; letter-spacing: 1px;">Estación Detectada</h4>
            <div style="background: rgba(255,255,255,0.03); border-radius: 8px; padding: 10px; margin-bottom: 14px; border: 1px solid rgba(255,255,255,0.05); font-size: 12px; text-align: left;">
                <div style="margin-bottom: 4px;"><span style="color: #888;">Sensor:</span> <b style="color: #fff;">${sensorMasCercano.nombre}</b></div>
                <div style="margin-bottom: 4px;"><span style="color: #888;">Región:</span> <span style="color: #fff;">${zonaIdentificada}</span></div>
                <div><span style="color: #888;">Coord:</span> <span style="color: #00ffaa;">${sensorMasCercano.lat.toFixed(4)}, ${sensorMasCercano.lon.toFixed(4)}</span></div>
            </div>
            
            <p style="margin: 0 0 8px 0; font-size: 11px; color: #aaa; text-align: left; font-weight: bold;">Selecciona Intensidad de Origen:</p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; justify-content: center;">
                <button id="btn-sim-severo" style="background: linear-gradient(135deg, #7f00ff, #ff0000); border: none; color: #fff; padding: 8px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 10px; transition: transform 0.1s; box-shadow: 0 4px 10px rgba(127,0,255,0.3);">🟣 SEVERO</button>
                <button id="btn-sim-fuerte" style="background: #ff2244; border: none; color: #fff; padding: 8px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 10px; transition: transform 0.1s; box-shadow: 0 4px 10px rgba(255,34,68,0.3);">🔴 FUERTE</button>
                <button id="btn-sim-moderado" style="background: #eab308; border: none; color: #fff; padding: 8px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 10px; transition: transform 0.1s; box-shadow: 0 4px 10px rgba(234,179,8,0.3);">🟡 MODERADO</button>
                <button id="btn-sim-ligero" style="background: #0055ff; border: none; color: #fff; padding: 8px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 10px; transition: transform 0.1s; box-shadow: 0 4px 10px rgba(0,85,255,0.3);">🔵 LIGERO</button>
            </div>
            <button id="btn-abortar-sim" style="margin-top: 14px; background: transparent; border: none; color: #666; cursor: pointer; font-size: 11px; text-decoration: underline;"> Cancelar Simulación</button>
        `;

        const botones = menuHTML.querySelectorAll('button');
        botones.forEach(b => {
            b.onmouseenter = () => b.style.transform = 'scale(1.03)';
            b.onmouseleave = () => b.style.transform = 'scale(1)';
        });

        document.getElementById('btn-sim-severo').onclick = () => disparar("SEVERO");
        document.getElementById('btn-sim-fuerte').onclick = () => disparar("FUERTE");
        document.getElementById('btn-sim-moderado').onclick = () => disparar("MODERADO");
        document.getElementById('btn-sim-ligero').onclick = () => disparar("LIGERO");
        document.getElementById('btn-abortar-sim').onclick = () => menuHTML.remove();

        function disparar(intensidadTipo) {
            let avisoStr = "Sismo Ligero";
            if (intensidadTipo === "SEVERO" || intensidadTipo === "FUERTE") {
                avisoStr = "Alerta Sísmica";
            } else if (intensidadTipo === "MODERADO") {
                avisoStr = "Sismo Moderado";
            }

            const datosSimulados = {
                aviso: avisoStr,
                intensidad: intensidadTipo, 
                zona: zonaIdentificada, 
                sensor: sensorMasCercano.nombre,
                lat: sensorMasCercano.lat,      
                lon: sensorMasCercano.lon,
                fecha: new Date().toLocaleString('es-MX'),
                esSimulacion: true
            };

            menuHTML.remove();
            ejecutarNuevaAlerta(datosSimulados, true);
        }
    });
}

function toggleUI() {
    const barraControles = document.querySelector('.contenedor-controles-manuales');
    const contenedorLogos = document.querySelector('.contenedor-logos-fondo');
    const iconoOjo = document.getElementById('icono-ojo');
    const leyenda = document.querySelector('.leyenda');
    const contador = document.getElementById('cuenta-regresiva');

    if (!barraControles || !iconoOjo) return;

    const estaOculto = barraControles.classList.toggle('ui-hidden-bottom');

    if (estaOculto) {
        cerrarPromptExe();
    }

    if (contenedorLogos) {
        contenedorLogos.style.opacity = estaOculto ? "0" : "0.3";
        contenedorLogos.style.transform = estaOculto ? "translateX(-50%) translateY(40px)" : "translateX(-50%) translateY(0)";
    }

    if (estaOculto) {
        iconoOjo.className = "fas fa-eye-slash"; 
    } else {
        iconoOjo.className = "fas fa-eye";      
    }

    if (leyenda) leyenda.classList.toggle('hidden', estaOculto);
    if (contador) {
        contador.style.transform = estaOculto ? "translateX(-50%) translateY(-150%)" : "translateX(-50%) translateY(0)";
        contador.style.opacity = estaOculto ? "0" : "1";
    }
}

function detenerAlerta() {
    const banner = document.getElementById('alert-container');
    const bannerBg = document.getElementById('banner-bg');
    if (window.timeoutCierre) clearTimeout(window.timeoutCierre);
    if (window.intervaloETA) clearInterval(window.intervaloETA);

    if (banner) banner.style.display = 'none';
    
    if (bannerBg) {
        bannerBg.classList.remove('fuerte-glow', 'moderado-glow');
    }

    [document.getElementById('sonidoEvento'), document.getElementById('sonidoEventoFuerte')].forEach(s => {
        if(s) {
            s.pause();
            s.currentTime = 0;
            s.loop = false;
        }
    });

    if (ultimaAlertaId) {
        localStorage.setItem('atendida', ultimaAlertaId);
    }

    const panicOverlay = document.getElementById('panic-overlay');
    if (panicOverlay) panicOverlay.remove();
}

function agregarAlHistorial(ev) {
    if (!Array.isArray(listaHistorial)) {
        listaHistorial = [];
    }

    const nuevaEntrada = {
        fecha: ev.fecha || new Date().toLocaleString(),
        zona: ev.zona || "Zona Desconocida",
        intensidad: ev.intensidad || "DESCONOCIDA",
        lat: ev.lat || 16.85, 
        lon: ev.lon || -99.90 
    };

    listaHistorial.unshift(nuevaEntrada);
    if (listaHistorial.length > 15) listaHistorial.pop();
    
    try {
        localStorage.setItem('sasepa_historial', JSON.stringify(listaHistorial));
    } catch(e) { console.error("Error guardando local:", e); }
    
    renderizarHistorial();
}

function togglePuntosHistorial() {
    if (!mapUltimo) return;

    const btn = document.getElementById('btn-historial-mapa');
    mostrandoHistorialMapa = !mostrandoHistorialMapa;

    if (mostrandoHistorialMapa) {
        if (btn) btn.style.backgroundColor = "#ff4d4d";

        if (!window.listaHistorial || window.listaHistorial.length === 0) {
            const guardado = localStorage.getItem('sasepa_historial');
            if (guardado) {
                window.listaHistorial = JSON.parse(guardado);
            }
        }

        if (!mapUltimo.getSource('historial-sismos')) {
            mapUltimo.addSource('historial-sismos', {
                'type': 'geojson',
                'data': { 'type': 'FeatureCollection', 'features': [] }
            });

            mapUltimo.addLayer({
                'id': 'layer-historial-puntos',
                'type': 'circle',
                'source': 'historial-sismos',
                'paint': {
                    'circle-radius': 8, 
                    'circle-color': ['get', 'color'],
                    'circle-stroke-width': 0, 
                    'circle-blur': 0.5,       
                    'circle-opacity': 0.8 
                }
            });

            let ascending = false;
            if (window.intervalHistorial) clearInterval(window.intervalHistorial);
            window.intervalHistorial = setInterval(() => {
                if (!mostrandoHistorialMapa) return;
                try {
                    let currOp = mapUltimo.getPaintProperty('layer-historial-puntos', 'circle-opacity');
                    if (ascending) {
                        currOp += 0.03;
                        if (currOp >= 0.8) ascending = false;
                    } else {
                        currOp -= 0.03;
                        if (currOp <= 0.2) ascending = true;
                    }
                    mapUltimo.setPaintProperty('layer-historial-puntos', 'circle-opacity', currOp);
                } catch (e) {}
            }, 80); 
        }

        const features = (window.listaHistorial || []).map(s => {
            const lon = parseFloat(s.lon || s.longitud);
            const lat = parseFloat(s.lat || s.latitud);
            if (isNaN(lon) || isNaN(lat)) return null;

            let colorPunto = '#192a8b'; 
            const intStr = (s.intensidad || "").toUpperCase();
            
            if (intStr.includes("FUERTE") || intStr.includes("SEVERE")) {
                colorPunto = '#ff0000'; 
            }

            return {
                'type': 'Feature',
                'properties': { 'color': colorPunto },
                'geometry': { 'type': 'Point', 'coordinates': [lon, lat] }
            };
        }).filter(f => f !== null);

        if (features.length > 0) {
            mapUltimo.getSource('historial-sismos').setData({
                'type': 'FeatureCollection',
                'features': features
            });
            mapUltimo.setLayoutProperty('layer-historial-puntos', 'visibility', 'visible');
            mapUltimo.moveLayer('layer-historial-puntos');
        }
    } else {
        if (btn) btn.style.backgroundColor = "";
        if (mapUltimo.getLayer('layer-historial-puntos')) {
            mapUltimo.setLayoutProperty('layer-historial-puntos', 'visibility', 'none');
            if (window.intervalHistorial) clearInterval(window.intervalHistorial);
        }
    }
}

function monitoreoServicio() {
    setInterval(() => {
        const el = document.getElementById('uptime');
        if (el) {
            if (lastSyncTime > 0) {
                const s = Math.floor((Date.now() - lastSyncTime) / 1000);
                el.textContent = 'Hace ' + s + 's';
            } else {
                el.textContent = 'Sin eventos'; 
            }
        }
    }, 1000);

    const latEl = document.getElementById('latencia-valor');
    if (latEl && latEl.textContent === '-- ms') {
        latEl.textContent = '🟢 ONLINE'; 
    }
}

function reporteMasivoCiudades(tiempoLimpieza = 10000) {
    if (!mapUltimo || bloqueoPorAlerta) return;

    const ciudadesSasmexBase = [
        { id: 0, idTicker: "CMC", nombre: "Morelia", lat: 19.7006, lon: -101.1864 },
        { id: 1, idTicker: "CEMX", nombre: "CDMX", lat: 19.4326, lon: -99.1332 },
        { id: 2, idTicker: "CMX", nombre: "Toluca", lat: 19.2826, lon: -99.6557 },
        { id: 3, idTicker: "CPB", nombre: "Puebla", lat: 19.0414, lon: -98.2063 },
        { id: 4, idTicker: "CMR", nombre: "Cuernavaca", lat: 18.9261, lon: -99.2307 },
        { id: 5, idTicker: "COX", nombre: "Oaxaca", lat: 17.0732, lon: -96.7266 },
        { id: 6, idTicker: "CGR2", nombre: "Chilpancingo", lat: 17.5513, lon: -99.5005 },
        { id: 7, idTicker: "CGR1", nombre: "Acapulco", lat: 16.8531, lon: -99.8237 },
        { id: 8, idTicker: "CCL", nombre: "Colima", lat: 19.2433, lon: -103.7247 }
    ];

    const featuresCiudades = ciudadesSasmexBase.map(c => ({
        'type': 'Feature',
        'id': c.id, 
        'properties': { 'nombre': c.nombre, 'idTicker': c.idTicker, 'color': '#00ff00' }, 
        'geometry': { 'type': 'Point', 'coordinates': [c.lon, c.lat] }
    }));

    const geojsonData = { 'type': 'FeatureCollection', 'features': featuresCiudades };

    if (mapUltimo.getSource('ciudades-difusion')) {
        mapUltimo.getSource('ciudades-difusion').setData(geojsonData);
    } else {
        mapUltimo.addSource('ciudades-difusion', { 'type': 'geojson', 'data': geojsonData });
        mapUltimo.addLayer({
            'id': 'layer-ciudades-circulo',
            'type': 'circle',
            'source': 'ciudades-difusion',
            'paint': {
                'circle-radius': 11,
                'circle-color': ['case', ['boolean', ['feature-state', 'reportando'], false], 'rgba(0, 255, 0, 0.4)', 'rgba(0,0,0,0)'],
                'circle-stroke-width': 3, 
                'circle-stroke-color': '#00ff00',
                'circle-blur': 0.1
            }
        });
    }

    let delayAcumulado = 0;
    const tiempoEntreCiudades = 400; 
    let idPrendidoAnteriormente = null;
    const tickerEl = document.getElementById('ticker-text');

    ciudadesSasmexBase.forEach((c) => {
        setTimeout(() => {
            if (bloqueoPorAlerta || !mapUltimo) return;
            if (CONFIG_AUDIOS.sensores && sonidoActivado) {
                const sRep = document.getElementById('sonidoreportesensor');
                if (sRep) {
                    const clon = sRep.cloneNode();
                    clon.volume = 0.4;
                    clon.play().catch(() => {});
                }
            }
            if (idPrendidoAnteriormente !== null) {
                mapUltimo.setFeatureState({ source: 'ciudades-difusion', id: idPrendidoAnteriormente }, { reportando: false });
            }
            mapUltimo.setFeatureState({ source: 'ciudades-difusion', id: c.id }, { reportando: true });
            idPrendidoAnteriormente = c.id;

            if (tickerEl) {
                tickerEl.innerHTML = `<span style="color: #00ff00; font-weight: bold; letter-spacing: 1px;"> ${c.idTicker.toUpperCase()} Reportándose </span>`;
            }
        }, delayAcumulado);
        delayAcumulado += tiempoEntreCiudades;
    });

    setTimeout(() => {
        if (!bloqueoPorAlerta && mapUltimo) {
            ciudadesSasmexBase.forEach(c => {
                mapUltimo.setFeatureState({ source: 'ciudades-difusion', id: c.id }, { reportando: false });
            });
            if (mapUltimo.getSource('ciudades-difusion')) {
                mapUltimo.getSource('ciudades-difusion').setData({ 'type': 'FeatureCollection', 'features': [] });
            }
            if (tickerEl) tickerEl.innerHTML = "";
        }
    }, delayAcumulado + tiempoLimpieza);
}

function animarReporteSensor(idSensor, duracion = 10000) { 
    if (!mapUltimo || bloqueoPorAlerta) return; 

    const index = MIS_SENSORES.findIndex(s => s.nombre === idSensor || s.id === idSensor);
    if (index === -1) return;

    mapUltimo.setFeatureState(
        { source: 'sensores-alerta', id: index },
        { reportando: true }
    );

    const tickerEl = document.getElementById('ticker-text');
    if (tickerEl) {
        tickerEl.innerHTML = `<span style="color: #00d4ff; font-weight: bold;"> ${idSensor.toUpperCase()} Reportándose </span>`;
    }

    if (window.timerTicker) clearTimeout(window.timerTicker);
    window.timerTicker = setTimeout(() => {
        if (tickerEl) tickerEl.innerHTML = "";
    }, 6000); 

    setTimeout(() => {
        if (!bloqueoPorAlerta) { 
            mapUltimo.setFeatureState(
                { source: 'sensores-alerta', id: index },
                { reportando: false }
            );
        }
    }, duracion); 
}

function reporteInicialSensores() {
    if (!window.MIS_SENSORES || window.MIS_SENSORES.length === 0) return;

    if (mapUltimo) {
        window.MIS_SENSORES.forEach((sensor, index) => {
            mapUltimo.setFeatureState(
                { source: 'sensores-alerta', id: index },
                { reportando: false }
            );
        });
    }

    window.MIS_SENSORES.forEach((sensor, index) => {
        setTimeout(() => {
            if (!bloqueoPorAlerta) {
                animarReporteSensor(sensor.nombre || sensor.id, 800); 
            }
        }, index * 150); 
    });
}

function limpiarReportesDeSensoresParaAlerta() {
    if (window.timerReporteGlobal) {
        clearTimeout(window.timerReporteGlobal);
        window.timerReporteGlobal = null;
    }
    if (typeof timersSensores !== 'undefined' && Array.isArray(timersSensores)) {
        timersSensores.forEach((t, i) => {
            if (t) clearTimeout(timersSensores[i]);
        });
    }
    if (window.MIS_SENSORES && mapUltimo) {
        window.MIS_SENSORES.forEach((sensor, index) => {
            mapUltimo.setFeatureState(
                { source: 'sensores-alerta', id: index },
                { reportando: false }
            );
        });
    }
    if (mapUltimo) {
        try {
            if (mapUltimo.getLayer('layer-ciudades-circulo')) {
                mapUltimo.removeLayer('layer-ciudades-circulo');
            }
            if (mapUltimo.getSource('ciudades-difusion')) {
                mapUltimo.removeSource('ciudades-difusion');
            }
        } catch (e) {}
    }
    const tickerEl = document.getElementById('ticker-text');
    if (tickerEl) tickerEl.innerHTML = "";
}

async function mostrarAppMonitor() {
    const app = document.getElementById('app-content');
    if (app) app.style.display = 'block';
    const login = document.getElementById('login-screen');
    if (login) login.style.display = 'none';

    inicializarMapa(); 
    iniciarEscuchaSismos();
    monitoreoServicio();
    setTimeout(() => {
        if (!bloqueoPorAlerta) reporteInicialSensores();
    }, 2000);

    setTimeout(() => { 
        if(mapUltimo) mapUltimo.resize(); 
    }, 1000);
}

function verificarTerminos() {
    if (localStorage.getItem('terminos_aceptados') === 'true') {
        if (document.getElementById('modal-terminos')) {
            document.getElementById('modal-terminos').style.display = 'none';
        }
        crearBotonConectarDVR();
    } else {
        mostrarAppMonitor();
        document.getElementById('modal-terminos').style.display = 'flex';
    }
}

async function aceptarTerminos() {
    localStorage.setItem('terminos_aceptados', 'true');
    document.getElementById('modal-terminos').style.display = 'none';

    if (typeof audioContext === 'undefined' || !audioContext) {
        window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (window.audioContext.state === 'suspended') {
        window.audioContext.resume();
    }

    await iniciarDVRSASEPA();
}

function crearBotonConectarDVR() {
    const login = document.getElementById('login-screen');
    if (login) login.style.display = 'none';
    const contenedorFijar = document.createElement('div');
    contenedorFijar.id = 'conector-dvr-pantalla';
    
    Object.assign(contenedorFijar.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: '10000',
        textAlign: 'center',
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    });

    contenedorFijar.innerHTML = `
        <button id="btn-arranque-dvr" style="background: rgba(5, 10, 20, 0.9); border: 2px solid #00d4ff; color: #00d4ff; font-weight: bold; padding: 15px 35px; font-size: 1.2em; border-radius: 8px; cursor: pointer; box-shadow: 0 0 15px rgba(0, 212, 255, 0.4); letter-spacing: 1px; transition: all 0.3s ease; backdrop-filter: blur(5px);">
            <i class="fas fa-plug" style="margin-right: 10px;"></i> CONECTAR MONITOR SASEPA V7
        </button>
    `;

    document.body.appendChild(contenedorFijar);
    document.getElementById('btn-arranque-dvr').onclick = async function() {
        contenedorFijar.remove(); 
        if (!window.audioContext) {
            window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (window.audioContext.state === 'suspended') {
            await window.audioContext.resume();
        }

        await iniciarDVRSASEPA();
        mostrarAppMonitor();
    };
}

function toggleAudioSasepa() {
    const icono = document.getElementById('icono-audio');
    const boton = document.getElementById('btn-toggle-audio');
    
    sonidoActivado = !sonidoActivado;

    if (sonidoActivado) {
        icono.className = 'fas fa-volume-up';
        boton.style.color = '#42df04';
        console.log("Sonido SASEPA: Activado");
    } else {
        icono.className = 'fas fa-volume-mute';
        boton.style.color = '#ff4d4d';
        console.log("🔇 Sonido SASEPA: Silenciado");
    }
}

function iniciarEscuchaSismos() {
    if (typeof mqtt === 'undefined') return;

    const hostSeguro = '0d0724ae358247cfb3fc53fcabe61af3.s1.eu.hivemq.cloud'; 
    const opciones = {
        protocol: 'wss',                                          
        host: hostSeguro,
        port: 8884,                                            
        path: '/mqtt',                                        
        clientId: 'SASEPA_Monitor_' + Math.random().toString(16).substr(2, 8),
        clean: true,
        connectTimeout: 5000,
        username: 'sasepa_publico',                      
        password: 'CualEsLaPincheContraseñaSASMEXxd123', 
        rejectUnauthorized: false                      
    };
    
    const clienteMQTT = mqtt.connect(opciones);

    clienteMQTT.on('connect', () => {
        clienteMQTT.subscribe('sasepa/monitor/alertas/adminv7/0398cvhhs77ehh6365g', { qos: 0 });
        clienteMQTT.subscribe('sasepa/comandos/frontend', { qos: 0 });
    });

    clienteMQTT.on('message', (topic, message) => {
        try {
            const d = JSON.parse(message.toString());

            if (topic === 'sasepa/comandos/frontend') {
                if (d.accion === "reporte_general") {
                    reporteMasivoCiudades(d.tiempo_limpieza || 10000);
                } else if (d.accion === "reset_total") {
                    resetTotalMapa();
                    reporteInicialSensores();
                    mostrarStatusServidorv7();
                } else if (d.accion === "reporte_todos_sensores") {
                    reporteInicialSensores();
                } else if (d.accion === "sistema_offline") {
                    const tickerEl = document.getElementById('ticker-text');
                    if (tickerEl) tickerEl.innerHTML = '<span style="color: red; font-weight: bold; letter-spacing: 2px;">SYSTEM OFFLINE</span>';
                    if (window.MIS_SENSORES && mapUltimo) {
                        window.MIS_SENSORES.forEach((sensor, index) => {
                            mapUltimo.setFeatureState({ source: 'sensores-alerta', id: index }, { color: '#ff0000', reportando: false });
                        });
                    }
                } else if (d.accion === "sistema_online") {
                    const tickerEl = document.getElementById('ticker-text');
                    if (tickerEl) tickerEl.innerHTML = "";
                    if (window.MIS_SENSORES && mapUltimo) {
                        window.MIS_SENSORES.forEach((sensor, index) => {
                            mapUltimo.setFeatureState({ source: 'sensores-alerta', id: index }, { color: '#00ff00', reportando: false });
                        });
                    }
                    reporteInicialSensores();
                    mostrarStatusServidorv7();
                }
                return; 
            }

            if (topic === 'sasepa/monitor/alertas/adminv7/0398cvhhs77ehh6365g') {
                if (!d || !d.fecha) return;
                if (window.MIS_SENSORES && mapUltimo) {
                    window.MIS_SENSORES.forEach((s, i) => mapUltimo.setFeatureState({ source: 'sensores-alerta', id: i }, { color: null }));
                }
                if (d.timestamp_inicio) {
                    const ahora = Date.now();
                    const diferencia = (ahora - d.timestamp_inicio) / 1000;
                    if (diferencia > 300) {
                        if (typeof resetearSensores === 'function') resetearSensores(); 
                        return; 
                    }
                }
                const id = `${d.fecha}|${d.zona}`;
                if (ultimaAlertaId === id || localStorage.getItem('atendida') === id) return;
                ultimaAlertaId = id;
                lastSyncTime = Date.now();
                try {
                    agregarAlHistorial(d);
                } catch (err) {}
                ejecutarNuevaAlerta(d, true);
            }
        } catch (error) {
            console.error("Error en mensaje MQTT:", error);
        }
    });

    clienteMQTT.on('error', (err) => { console.error("MQTT Error:", err); });
    clienteMQTT.on('close', () => { console.warn("MQTT Cerrado"); });
}

async function limpiarAudios() {
    if (window.audioContext && window.audioContext.state !== 'closed') {
        await window.audioContext.suspend(); 
    }
    const todosLosAudios = document.querySelectorAll('audio');
    todosLosAudios.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });
}

async function resetTotalMapa() {
    if (window.audioContext) {
        await window.audioContext.suspend();
    }
    const todosLosAudios = document.querySelectorAll('audio');
    todosLosAudios.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });
    const timers = [window.intervaloOndas, window.intervaloETA, window.timerTicker, window.timeoutCierre, window.timeoutCiudades, window.timeoutEpicentroLimpieza];
    timers.forEach(t => { if (t) clearTimeout(t); });
    if (window.intervaloOndas) clearInterval(window.intervaloOndas);
    if (window.intervaloETA) clearInterval(window.intervaloETA);
    const tickerEl = document.getElementById('ticker-text');
    if (tickerEl) tickerEl.innerHTML = "";
    const banner = document.getElementById('alert-container');
    if (banner) banner.style.display = 'none'; 
    const panicOverlay = document.getElementById('panic-overlay');
    if (panicOverlay) panicOverlay.remove(); 
    const cuadroCiudades = document.getElementById('cuadro-ciudades');
    if (cuadroCiudades) cuadroCiudades.style.display = 'none'; 
    if (mapUltimo) {
        ['ondas', 'lineas-sensores', 'epicentro'].forEach(f => {
            const source = mapUltimo.getSource(f);
            if (source) source.setData({ 'type': 'FeatureCollection', 'features': [] });
        });
        if (mapUltimo.getSource('ciudades-difusion')) {
            mapUltimo.getSource('ciudades-difusion').setData({ 'type': 'FeatureCollection', 'features': [] });
        }
        if (window.MIS_SENSORES && mapUltimo.getSource('sensores-alerta')) {
            const featuresBase = window.MIS_SENSORES.map((s, index) => ({
                'type': 'Feature',
                'id': index, 
                'properties': { 'color': '#00ff00', 'nombre': s.nombre },
                'geometry': { 'type': 'Point', 'coordinates': [parseFloat(s.lon), parseFloat(s.lat)] }
            }));
            mapUltimo.getSource('sensores-alerta').setData({ 'type': 'FeatureCollection', 'features': featuresBase });
            bloqueoPorAlerta = false;
        }
    }
}

async function resetearSensores() {
    if (typeof ultimaAlertaId !== 'undefined') {
        ultimaAlertaId = null; 
    }
    localStorage.removeItem('atendida');

    if (window.audioContext && window.audioContext.state !== 'closed') {
        await window.audioContext.suspend(); 
    }

    if (window.intervaloOndas) clearInterval(window.intervaloOndas);
    if (window.intervaloETA) clearInterval(window.intervaloETA);
    if (window.timerTicker) clearTimeout(window.timerTicker); 
    if (window.timeoutCierre) clearTimeout(window.timeoutCierre);
    if (window.timeoutCiudades) clearTimeout(window.timeoutCiudades);

    const tickerEl = document.getElementById('ticker-text');
    if (tickerEl) tickerEl.innerHTML = "";

    const banner = document.getElementById('alert-container');
    if (banner) banner.style.display = 'none';

    const cuadroCiudades = document.getElementById('cuadro-ciudades');
    if (cuadroCiudades) {
        cuadroCiudades.style.display = 'none';
    }

    if (mapUltimo) {
        ['ondas', 'lineas-sensores', 'epicentro', 'ciudades-difusion'].forEach(f => {
            const source = mapUltimo.getSource(f);
            if (source) {
                source.setData({ 'type': 'FeatureCollection', 'features': [] });
            }
        });

        if (mapUltimo.getLayer('layer-sensores-puntos')) {
            mapUltimo.setPaintProperty('layer-sensores-puntos', 'circle-color', '#00ff00');
            mapUltimo.setPaintProperty('layer-sensores-puntos', 'circle-stroke-color', 'transparent');
            mapUltimo.setPaintProperty('layer-sensores-puntos', 'circle-opacity', 1);
        }
        
        if (window.MIS_SENSORES && mapUltimo.getSource('sensores-alerta')) {
            const featuresBase = window.MIS_SENSORES.map(s => ({
                'type': 'Feature',
                'properties': { 
                    'color': '#00ff00',
                    'nombre': s.nombre 
                },
                'geometry': { 
                    'type': 'Point', 
                    'coordinates': [parseFloat(s.lon), parseFloat(s.lat)] 
                }
            }));
            mapUltimo.getSource('sensores-alerta').setData({ 'type': 'FeatureCollection', 'features': featuresBase });
            bloqueoPorAlerta = false;
            reporteInicialSensores();
        }
    }
}

function CapturarPantalla() {
    if (typeof html2canvas === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://html2canvas.hertzen.com/dist/html2canvas.min.js";
        script.onload = () => ejecutarCaptura();
        document.head.appendChild(script);
    } else {
        ejecutarCaptura();
    }

    function ejecutarCaptura() {
        const bentoControl = document.querySelector('.bento-grid-control') || document.querySelector('.bottom-control');
        if (bentoControl) bentoControl.style.opacity = '0';

        html2canvas(document.body, {
            useCORS: true,        
            allowTaint: true,
            backgroundColor: '#0c0c10' 
        }).then(canvas => {
            if (bentoControl) bentoControl.style.opacity = '1';
            const imagenData = canvas.toDataURL('image/png');
            const ahora = new Date();
            const fechaFormato = ahora.toISOString().slice(0,10);
            const horaFormato = ahora.toTimeString().slice(0,8).replace(/:/g, '-');
            const nombreArchivo = `SASEPA_Reporte_${fechaFormato}_${horaFormato}.png`;
            const enlaceDescarga = document.createElement('a');
            const enlaceDescarga = document.createElement('a');
            enlaceDescarga.href = imagenData;
            enlaceDescarga.download = nombreArchivo;
            document.body.appendChild(enlaceDescarga);
            enlaceDescarga.click();
            document.body.removeChild(enlaceDescarga);
        }).catch(err => {
            if (bentoControl) bentoControl.style.opacity = '1';
        });
    }
}

function abrirConfiguracion() {
    const leyenda = document.querySelector('.leyenda');
    if (leyenda) {
        leyenda.classList.toggle('hidden');

        const estaOculto = leyenda.classList.contains('hidden');
        const cuadroCiudades = document.getElementById('cuadro-ciudades');

        if (cuadroCiudades && cuadroCiudades.style.display !== "none") {
            cuadroCiudades.style.left = estaOculto ? "25px" : "260px";
            cuadroCiudades.style.width = estaOculto ? "220px" : "150px";
            const spans = cuadroCiudades.querySelectorAll('span');
            spans.forEach(s => {
                s.style.fontSize = estaOculto ? "12px" : "10px";
            });
        }
    }
}

function iniciarReloj() {
    function actualizar() {
        const ahora = new Date();
        const h = ahora.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        const f = ahora.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' });

        const hEl = document.getElementById('hora-cdmx');
        const fEl = document.getElementById('fecha-cdmx');
        if(hEl) hEl.textContent = h;
        if(fEl) fEl.textContent = f;
    }
    setInterval(actualizar, 1000);
    actualizar();
}

function renderizarHistorial() {
    const target = document.getElementById('lista-historial-content');
    if (!target) return;
    target.innerHTML = "";

    if (!listaHistorial || listaHistorial.length === 0) {
        target.innerHTML = "<div style='color: #888; text-align: center; padding: 20px;'>Sin eventos recientes</div>";
        return;
    }

    listaHistorial.forEach(ev => {
        const item = document.createElement('div');
        const intensidad = (ev.intensidad || "").toUpperCase();
        let claseColor = "";
        
        if (intensidad.includes("FUERTE") || intensidad.includes("SEVERE")) claseColor = "hist-fuerte";
        else if (intensidad.includes("MODERADO") || intensidad.includes("MODERATE")) claseColor = "hist-mod";
        else claseColor = "hist-ligero";

        item.className = `historial-item ${claseColor}`;
        item.innerHTML = `
            <div class="historial-header">
                <span class="historial-zona">${ev.zona}</span>
                <span class="historial-tag">${intensidad}</span>
            </div>
            <div class="historial-fecha">
                <i class="far fa-calendar-alt"></i> ${ev.fecha}
            </div>
            <div class="historial-footer">Historial Eventos SASEPA</div>
        `;
        target.appendChild(item);
    });
}

function cerrarHistorial() {
    const capa = document.getElementById('capa-lista-historial');
    if (capa) capa.style.display = 'none';
    if (mapUltimo) mapUltimo.resize();
}

function mostrarUbicacionUsuario() {
    if (!mapUltimo) return;
    navigator.geolocation.getCurrentPosition(pos => {
        userCoords = [pos.coords.longitude, pos.coords.latitude];
        if (window.userMarkerUltimo) window.userMarkerUltimo.remove();
        
        const el = document.createElement('div');
        el.className = 'mapboxgl-user-location-dot';
        el.style.backgroundImage = "url('img/ubicacion.png')";
        el.style.backgroundSize = "cover";
        el.style.width = "40px";   
        el.style.height = "40px";  
        
        window.userMarkerUltimo = new mapboxgl.Marker(el).setLngLat(userCoords).addTo(mapUltimo);
    }, () => {
        establecerUbicacionDefault();
    }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
}

function establecerUbicacionDefault() {
    if (!mapUltimo) return;
    userCoords = [-99.1332, 19.4326]; 
    if (window.userMarkerUltimo) window.userMarkerUltimo.remove();
    
    const el = document.createElement('div');
    el.className = 'mapboxgl-user-location-dot';
    el.style.backgroundImage = "url('img/ubicacion.png')";
    el.style.backgroundSize = "cover";
    el.style.width = "40px";   
    el.style.height = "40px";  
    
    window.userMarkerUltimo = new mapboxgl.Marker(el).setLngLat(userCoords).addTo(mapUltimo);

    const tickerEl = document.getElementById('ticker-text');
    if (tickerEl) {
        tickerEl.innerHTML = "<span style='color: #ffcc00;'>UBICACIÓN PREDETERMINADA: CIUDAD DE MÉXICO</span>";
        if (window.timerTicker) clearTimeout(window.timerTicker);
        window.timerTicker = setTimeout(() => { tickerEl.innerHTML = ""; }, 5000);
    }
}

function cerrarPromptExe() {
    const el = document.getElementById('sasepa-prompt-container');
    if (el) el.remove();
}

function procesarUbicacionExe() {
    const input = document.getElementById('prompt-exe-input');
    if (input) {
        const valor = input.value;
        cerrarPromptExe();
        if (valor && valor.trim() !== "") {
            ejecutarGeocodingDirecto(valor);
        }
    }
}

function ejecutarGeocodingDirecto(query) {
    if (!mapUltimo) return;
    const token = mapboxgl.accessToken;
    if (!token) {
        return;
    }

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=1&country=MX`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data && data.features && data.features.length > 0) {
                const coordinates = data.features[0].center; 
                userCoords = coordinates;
                if (window.userMarkerUltimo) window.userMarkerUltimo.remove();
                
                const el = document.createElement('div');
                el.className = 'mapboxgl-user-location-dot';

                window.userMarkerUltimo = new mapboxgl.Marker(el)
                    .setLngLat(userCoords)
                    .addTo(mapUltimo);

            } else {
            }
        })
        .catch(err => {
        });
}

function cambiarUbicacionManual() {
    if (!mapUltimo || bloqueoPorAlerta) return;

    const msg = ">>\nIngrese destino de monitoreo (Ciudad, Estado):";
    
    try {
        let ciudad = prompt(msg);
        if (ciudad !== undefined && ciudad !== null) {
            if (ciudad.trim() !== "") continuarGeocodingSasepa(ciudad);
            return;
        }
    } catch(e) {}
    
    if (!document.getElementById('sasepa-prompt-container')) {
        let contenedor = document.createElement('div');
        contenedor.id = 'sasepa-prompt-container';
        contenedor.style = "position:absolute;bottom:70px;left:50%;transform:translateX(-50%);background:#0c0c0c;border:2px solid #00ffff;padding:25px;z-index:99999;font-family:monospace;color:#fff;box-shadow:0 0 25px rgba(0,255,255,0.4);border-radius:4px;min-width:320px;box-sizing:border-box;";
        contenedor.innerHTML = `
            <p style="color:#ffff00;margin:0 0 12px 0;font-weight:bold;letter-spacing:1px;font-size:12px;">${msg.replace('\n','<br>')}</p>
            <input type="text" id="prompt-exe-input" style="width:100%;background:#000;border:1px solid #00ffff;color:#fff;padding:8px;margin-bottom:15px;font-family:monospace;outline:none;box-sizing:border-box;" autofocus>
            <div style="text-align:right;">
                <button onclick="cerrarPromptExe()" style="background:#222;color:#aaa;border:1px solid #444;padding:6px 12px;margin-right:8px;cursor:pointer;font-family:monospace;font-size:11px;">CANCELAR</button>
                <button onclick="procesarUbicacionExe()" style="background:#00ffff;color:#000;border:none;padding:6px 15px;font-weight:bold;cursor:pointer;font-family:monospace;font-size:11px;">ACEPTAR</button>
            </div>
        `;
        const padre = document.querySelector('.contenedor-controles-manuales') || document.body;
        padre.appendChild(contenedor);
        
        const input = document.getElementById('prompt-exe-input');
        input.focus();
        input.onkeydown = (e) => { 
            if (e.key === 'Enter') procesarUbicacionExe(); 
            if (e.key === 'Escape') cerrarPromptExe();
        };
    }
}

function generarSonidoSasepa(tipo) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (tipo === 'FUERTE') osc.frequency.value = 250;
    else if (tipo === 'MODERADO') osc.frequency.value = 600;
    else osc.frequency.value = 1100;

    osc.type = 'triangle'; 

    const ahora = ctx.currentTime;
    gain.gain.setValueAtTime(0.5, ahora); 
    gain.gain.exponentialRampToValueAtTime(0.0001, ahora + 3); 

    osc.start(ahora);
    osc.stop(ahora + 3);
}

function sincronizarOndas(epicentroCoords, timestampInicio) {
    const ahora = Date.now(); 
    const tiempoTranscurrido = (ahora - timestampInicio) / 1000; 

    if (tiempoTranscurrido > 120) return; 

    let radioP = tiempoTranscurrido * VELOCIDAD_P;
    let radioS = tiempoTranscurrido * VELOCIDAD_S;

    animarOndasDesde(epicentroCoords, radioP, radioS, tiempoTranscurrido);
}

function animarOndasDesde(coords, rP, rS, t) {
    function actualizar() {
        rP += VELOCIDAD_P / 60;
        rS += VELOCIDAD_S / 60;

        mapUltimo.getSource('ondaP').setData(crearCirculo(coords, rP));
        mapUltimo.getSource('ondaS').setData(crearCirculo(coords, rS));

        requestAnimationFrame(actualizar);
    }
    actualizar();
}

function solicitarPermisoNotificaciones() {
    if (!("Notification" in window)) {
        console.log("Este navegador no soporta notificaciones de escritorio.");
        return;
    }

    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
}

function enviarNotificacionPush(datos) {
    if (Notification.permission === "granted") {
        const titulo = datos.intensidad.includes("FUERTE") ? "⚠️ ALERTA CRÍTICA ⚠️" : "🔔 SISMO DETECTADO";
        const opciones = {
            body: `Zona: ${datos.zona}\nIntensidad: ${datos.intensidad}\nFecha: ${datos.fecha}`,
            icon: 'img/SASEPA.png', 
            vibrate: [200, 100, 200],
            tag: 'SASEPA', 
            renotify: true
        };

        const notification = new Notification(titulo, opciones);

        notification.onclick = function() {
            window.focus();
            this.close();
        };
    }
}

function mostrarStatusServidorv7() {
    const statusv7 = document.createElement('div');
    statusv7.id = 'status-v7-temporal';

    Object.assign(statusv7.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: '9999',
        color: '#99bb79', 
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        fontSize: '1.8em',
        fontWeight: 'bold',
        textShadow: '2px 2px 10px rgba(0,0,0,0.8)',
        pointerEvents: 'none',
        textAlign: 'center',
        opacity: '0',
        transition: 'opacity 1s ease-in-out',
        letterSpacing: '1.5px',
        width: '100%'
    });

    statusv7.innerHTML = 'conectado al servidor: sasepa.net.v7';

    document.body.appendChild(statusv7);

    setTimeout(() => {
        statusv7.style.opacity = '1';
    }, 100);

    setTimeout(() => {
        statusv7.style.opacity = '0';
        setTimeout(() => {
            if (statusv7.parentNode) {
                statusv7.parentNode.removeChild(statusv7);
            }
        }, 1000);
    }, 10000); 
}

async function iniciarDVRSASEPA() {
    try {
        streamGrabacion = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: 30, displaySurface: "browser" },
            audio: false 
        });

        let opcionesMime = { mimeType: 'video/webm; codecs=text/html,chromium-webm-video-v3,h264' };
        if (!MediaRecorder.isTypeSupported(opcionesMime.mimeType)) {
            opcionesMime = { mimeType: 'video/webm; codecs=h264' };
        }
        if (!MediaRecorder.isTypeSupported(opcionesMime.mimeType)) {
            opcionesMime = { mimeType: 'video/mp4; codecs=avc1.42E01E' };
        }

        mediaRecorder = new MediaRecorder(streamGrabacion, opcionesMime);
        fragmentosGrabacion = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                fragmentosGrabacion.push(e.data);
            }
        };

        mediaRecorder.onstop = () => {
            procesarYDescargarMP4();
        };

        mediaRecorder.start(1000);
        console.log("DVR: Monitoreo y grabación H264 en segundo plano activa.");

    } catch (err) {
        console.error("No se pudo iniciar el DVR:", err);
    }
}

function cortarYGuardarSismo() {
    if (!mediaRecorder || mediaRecorder.state === "inactive" || dvrGrabandoSismo) return;
    dvrGrabandoSismo = true;

    setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop(); 
        }
    }, 300000); 
}

function procesarYDescargarMP4() {
    const blobVideo = new Blob(fragmentosGrabacion, { type: 'video/mp4' });
    const url = URL.createObjectURL(blobVideo);

    const a = document.createElement('a');
    a.href = url;
    a.download = `Evento_SASEPA_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    fragmentosGrabacion = [];
    dvrGrabandoSismo = false;
    
    reiniciarGrabacionSilenciosa();
}

function reiniciarGrabacionSilenciosa() {
    if (!streamGrabacion || !streamGrabacion.active) {
        console.warn("La sesión de captura se perdió. Solicitando de nuevo...");
        iniciarDVRSASEPA(); 
        return;
    }

    try {
        let opcionesMime = { mimeType: 'video/webm; codecs=text/html,chromium-webm-video-v3,h264' };
        if (!MediaRecorder.isTypeSupported(opcionesMime.mimeType)) {
            opcionesMime = { mimeType: 'video/webm; codecs=h264' };
        }
        if (!MediaRecorder.isTypeSupported(opcionesMime.mimeType)) {
            opcionesMime = { mimeType: 'video/mp4; codecs=avc1.42E01E' };
        }

        mediaRecorder = new MediaRecorder(streamGrabacion, opcionesMime);

        mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                fragmentosGrabacion.push(e.data);
            }
        };

        mediaRecorder.onstop = () => {
            procesarYDescargarMP4();
        };

        mediaRecorder.start(1000);
        
        intervaloBufer = setInterval(() => {
            if (dvrBloqueadoPorSismo) return;

            if (fragmentosGrabacion.length > 0) {
                buferCircular.push(fragmentosGrabacion.shift());
                if (buferCircular.length > 5) {
                    buferCircular.shift();
                }
            }
        }, 1000);

        console.log("DVR: Grabación en bucle reanudada en segundo plano sin pedir permisos.");

    } catch (err) {
        console.error("Error al reiniciar la grabadora en segundo plano:", err);
    }
}
document.addEventListener('DOMContentLoaded', () => {
    solicitarPermisoNotificaciones();
    iniciarReloj();
    const s = document.createElement('script');
    s.src = "js/sensores.js?v=" + Date.now();
    s.onload = () => {
        verificarTerminos();
    };
    document.head.appendChild(s);
});
