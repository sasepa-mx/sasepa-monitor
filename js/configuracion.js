// ©️ SASEPAMx Derechos Reservados Prohibida su copia total o parcial sin autorización expresa
var database = null; 
let intervaloSimulacroNacional = null;
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
let desfaseServidorMs = 0;
window.memoriaLat = 0;
window.memoriaLon = 0;

if (typeof mapboxgl !== 'undefined' && window.MAPBOX_ACCESS_TOKEN) {
    mapboxgl.accessToken = window.MAPBOX_ACCESS_TOKEN;
}

var MIS_SENSORES = (typeof window !== 'undefined' && window.MIS_SENSORES) ? window.MIS_SENSORES : [];
var ESTADO_SENSORES_SASEPA = {};
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

/**
 * @param {string} sensor
 * @param {string} mensaje
 * @param {string} tipo
 */
let contadorPingsTotales = 0;
let usuarioHaciendoScroll = false;
const consolaElemento = document.getElementById('contenedor-consola-logs');
consolaElemento?.addEventListener('scroll', () => {
    if (consolaElemento.scrollTop + consolaElemento.clientHeight < consolaElemento.scrollHeight - 10) {
        usuarioHaciendoScroll = true; 
    } else {
        usuarioHaciendoScroll = false; 
    }
});

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
    { id: 100, idTicker: "RCMC1", nombre: "RMorelia1", lat: 19.7206, lon: -101.2364, esRepetidora: true },
    { id: 101, idTicker: "RCMC2", nombre: "RMorelia2", lat: 19.6806, lon: -101.1364, esRepetidora: true },
    { id: 1, idTicker: "CEMX", nombre: "Toluca", lat: 19.2826, lon: -99.6557 },
    { id: 102, idTicker: "RCEMX1", nombre: "RToluca1", lat: 19.3026, lon: -99.7057, esRepetidora: true },
    { id: 103, idTicker: "RCEMX2", nombre: "RToluca2", lat: 19.2626, lon: -99.6057, esRepetidora: true },
    { id: 2, idTicker: "CMX", nombre: "CDMX", lat: 19.4326, lon: -99.1332 }, 
    { id: 104, idTicker: "RCMX1", nombre: "RCDMX1", lat: 19.4526, lon: -99.1832, esRepetidora: true }, 
    { id: 105, idTicker: "RMX1", nombre: "RCDMX2", lat: 19.4126, lon: -99.0832, esRepetidora: true },
    { id: 3, idTicker: "CPB", nombre: "Puebla", lat: 19.0414, lon: -98.2063 },
    { id: 106, idTicker: "RCPB1", nombre: "RPuebla1", lat: 19.0614, lon: -98.2563, esRepetidora: true },
    { id: 107, idTicker: "RCPB2", nombre: "RPuebla2", lat: 19.0214, lon: -98.1563, esRepetidora: true },
    { id: 4, idTicker: "CMR", nombre: "Cuernavaca", lat: 18.9261, lon: -99.2307 },
    { id: 108, idTicker: "RCMR1", nombre: "RCuernavaca1", lat: 18.9461, lon: -99.2807, esRepetidora: true },
    { id: 109, idTicker: "RCMR2", nombre: "RCuernavaca2", lat: 18.9061, lon: -99.1807, esRepetidora: true },
    { id: 5, idTicker: "COX", nombre: "Oaxaca", lat: 17.0732, lon: -96.7266 },
    { id: 110, idTicker: "RCOX1", nombre: "ROaxaca1", lat: 17.0932, lon: -96.7766, esRepetidora: true },
    { id: 6, idTicker: "CGR2", nombre: "Chilpancingo", lat: 17.5513, lon: -99.5005 },
    { id: 112, idTicker: "RCGR2-1", nombre: "RChilpancingo1", lat: 17.5713, lon: -99.5505, esRepetidora: true },
    { id: 7, idTicker: "CGR1", nombre: "Acapulco", lat: 16.8531, lon: -99.8237 },
    { id: 114, idTicker: "RCGR1-1", nombre: "RAcapulco1", lat: 16.8731, lon: -99.8737, esRepetidora: true },
    { id: 8, idTicker: "CCL", nombre: "Colima", lat: 19.2433, lon: -103.7247 },
    { id: 116, idTicker: "RCCL1", nombre: "RColima1", lat: 19.2633, lon: -103.7747, esRepetidora: true },
    { id: 9, idTicker: "CGDL", nombre: "Guadalajara", lat: 20.66682, lon: -103.39182 },
    { id: 116, idTicker: "RCGDL1", nombre: "RGuadalajara1", lat: 20.6736, lon: -103.3440, esRepetidora: true },
    { id: 10, idTicker: "CCH", nombre: "Chiapas", lat: 16.75693, lon: -93.12924 },
    { id: 117, idTicker: "RCCH1", nombre: "RChiapas1", lat: 16.7350, lon: -93.1000, esRepetidora: true }
];

function generarRepetidorasSasmex() {
    const listaRepetidoras = [];
    if (typeof ciudadesSasmexBase === 'undefined') return listaRepetidoras;
    ciudadesSasmexBase.forEach(ciudad => {
        const offsetLongitud = 0.05; 
        const offsetLatitud = 0.02;
        listaRepetidoras.push({
            id: `${ciudad.id}_R1`,
            idTicker: `${ciudad.idTicker}1`,
            nombre: `${ciudad.nombre} Repetidora 1`,
            lat: ciudad.lat + offsetLatitud,
            lon: ciudad.lon - offsetLongitud,
            tipo: "repetidora",
            centralPadre: ciudad.idTicker,
            activo: true
        });
        listaRepetidoras.push({
            id: `${ciudad.id}_R2`,
            idTicker: `${ciudad.idTicker}2`,
            nombre: `${ciudad.nombre} Repetidora 2`,
            lat: ciudad.lat - offsetLatitud,
            lon: ciudad.lon + offsetLongitud,
            tipo: "repetidora",
            centralPadre: ciudad.idTicker,
            activo: true
        });
    });
    return listaRepetidoras;
}

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
    const cargarTodo = () => {
        if (!mapUltimo.hasImage('dot-epi')) mapUltimo.addImage('dot-epi', pulsingDot, { pixelRatio: 2 });
        if (!mapUltimo.getSource('sensores-alerta')) {
            mapUltimo.addSource('sensores-alerta', { 
                'type': 'geojson', 
                'data': { 'type': 'FeatureCollection', 'features': [] },
                'generateId': false 
            });
            const colorLogic = [
                'case',
                ['boolean', ['feature-state', 'reportando'], false], '#00d4ff',
                ['!=', ['feature-state', 'color'], null], ['feature-state', 'color'],
                ['get', 'color']
            ];
            mapUltimo.addLayer({ 'id': 'layer-sensores-alerta-glow', 'type': 'circle', 'source': 'sensores-alerta', 'paint': { 'circle-radius': 10, 'circle-color': colorLogic, 'circle-blur': 2.5, 'circle-opacity': 0.5 } });
            mapUltimo.addLayer({ 'id': 'layer-sensores-alerta', 'type': 'circle', 'source': 'sensores-alerta', 'paint': { 'circle-radius': 3.5, 'circle-color': colorLogic, 'circle-stroke-width': 0 } });
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
            const featuresBase = window.MIS_SENSORES.map((s, index) => {
                const idCorto = (s.id || "").trim().toUpperCase();
                const estadoGuardado = localStorage.getItem(`sasepa_sensor_${idCorto}`);
                if (estadoGuardado === 'false') {
                    s.activo = false;
                }
                const colorInicial = (s.activo === false) ? '#ff0000' : '#00ff00';
                return { 
                    'type': 'Feature', 
                    'id': index,
                    'properties': { 'nombre': s.nombre, 'color': colorInicial }, 
                    'geometry': { 'type': 'Point', 'coordinates': [parseFloat(s.lon), parseFloat(s.lat)] }
                };
            });
            mapUltimo.getSource('sensores-alerta').setData({ 'type': 'FeatureCollection', 'features': featuresBase });
        }
        if (typeof mostrarStatusServidorv8 === 'function') mostrarStatusServidorv8();
        if (typeof mostrarUbicacionUsuario === 'function') mostrarUbicacionUsuario();
    };
    mapUltimo.on('style.load', cargarTodo);
    if (mapUltimo.isStyleLoaded()) cargarTodo();
}

function reporteMasivoCiudades(tiempoLimpieza = 10000) {
    if (!mapUltimo) return;
    const featuresCiudades = ciudadesSasmexBase.map(c => ({
        'type': 'Feature',
        'id': c.id, 
        'properties': { 
            'nombre': c.nombre, 
            'idTicker': c.idTicker,
            'esRepetidora': c.esRepetidora === true 
        }, 
        'geometry': { 'type': 'Point', 'coordinates': [c.lon, c.lat] }
    }));
    const geojsonData = { 'type': 'FeatureCollection', 'features': featuresCiudades };
    if (mapUltimo.getSource('ciudades-telemetria')) {
        mapUltimo.getSource('ciudades-telemetria').setData(geojsonData);
    } else {
        mapUltimo.addSource('ciudades-telemetria', { 'type': 'geojson', 'data': geojsonData });
        mapUltimo.addLayer({
            'id': 'layer-telemetria-circulo',
            'type': 'circle',
            'source': 'ciudades-telemetria',
            'paint': {
                'circle-radius': ['case', ['boolean', ['get', 'esRepetidora'], false], 6, 11],
                'circle-color': ['case', 
                    ['boolean', ['feature-state', 'reportando'], false],
                    ['case', ['boolean', ['get', 'esRepetidora'], false], 'rgba(135, 206, 235, 0.6)', 'rgba(0, 255, 0, 0.4)'],
                    'rgba(0,0,0,0)'
                ],
                'circle-stroke-width': ['case', ['boolean', ['get', 'esRepetidora'], false], 2, 3], 
                'circle-stroke-color': ['case', 
                    ['boolean', ['feature-state', 'reportando'], false],
                    ['case', ['boolean', ['get', 'esRepetidora'], false], '#87ceeb', '#00ff00'],
                    'rgba(0,0,0,0)'
                ],
                'circle-blur': 0.1
            }
        });
    }
    if (CONFIG_AUDIOS.sensores && sonidoActivado) {
        const sRep = document.getElementById('sonidoreportesensor');
        if (sRep) {
            const clon = sRep.cloneNode();
            clon.volume = 0.5;
            clon.play().catch(() => {});
        }
    }
    ciudadesSasmexBase.forEach(c => {
        mapUltimo.setFeatureState({ source: 'ciudades-telemetria', id: c.id }, { reportando: true });
    });
    const tickerEl = document.getElementById('ticker-text');
    if (tickerEl) {
        tickerEl.setAttribute('data-actual-id', 'SISTEMA_MASIVO');
        tickerEl.innerHTML = `<span style="color: #00ff00; font-weight: bold; letter-spacing: 2px;"> [SISTEMA] REPORTE DE ESTACIONES SASMEX </span>`;
    }
    setTimeout(() => {
        if (mapUltimo) {
            ciudadesSasmexBase.forEach(c => {
                mapUltimo.setFeatureState({ source: 'ciudades-telemetria', id: c.id }, { reportando: false });
            });
            
            if (mapUltimo.getSource('ciudades-telemetria')) {
                mapUltimo.getSource('ciudades-telemetria').setData({ 'type': 'FeatureCollection', 'features': [] });
            }
            
            if (tickerEl && tickerEl.getAttribute('data-actual-id') === 'SISTEMA_MASIVO') {
                tickerEl.innerHTML = "";
                tickerEl.removeAttribute('data-actual-id');
            }
        }
    }, tiempoLimpieza);
}

function iniciarEscuchaSismos() {
    if (typeof mqtt === 'undefined') return;
    const audioReporte = new Audio('audio/sonido_reporte.mp3');
    const hostSeguro = '0d0724ae358247cfb3fc53fcabe61af3.s1.eu.hivemq.cloud'; 
    let timerTickerGlobal = null; 
    let intervaloSimulacroNacional = null;

    const opciones = {
        protocol: 'wss',
        host: hostSeguro,
        port: 8884,
        path: '/mqtt',                                       
        clientId: 'SASEPA_Monitor_' + Math.random().toString(16).substr(2, 8),
        clean: true,
        connectTimeout: 5000,
        username: 'sasepa',
        password: '!QnVitpZBAjJx7k',
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
                    registrarLogSensor("SMAEPA", "Reporte difusión ciudades.", "conexion");
                    reporteMasivoCiudades(d.tiempo_limpieza || 10000);
                } else if (d.accion === "reset_total") {
                    resetTotalMapa();
                    ocultarConteoSimulacroNacional();
                    reporteInicialSensores();
                    mostrarStatusServidorv7();
                    if (window.MIS_SENSORES && mapUltimo) {
                        window.MIS_SENSORES.forEach((sensor, index) => {
                            if (sensor.activo === false) {
                                mapUltimo.setFeatureState({ source: 'sensores-alerta', id: index }, { color: '#ff0000', reportando: false });
                            }
                        });
                    }
                    const tickerEl = document.getElementById('ticker-text');
                    if (tickerEl) {
                        tickerEl.innerHTML = "";
                        tickerEl.removeAttribute('data-actual-id');
                    }
                    if (timerTickerGlobal) clearTimeout(timerTickerGlobal);
                } else if (d.accion === "mostrar_simulacro") {
                    mostrarConteoSimulacroNacional();
                    registrarLogSensor("SMAEPA", "Activando cuenta regresiva 2do Simulacro Nacional 2026.", "conexion");
                } else if (d.accion === "ocultar_simulacro") {
                    ocultarConteoSimulacroNacional();
                    registrarLogSensor("SMAEPA", "Desactivando cuenta regresiva del simulacro.", "conexion");
                } else if (d.accion === "reporte_todos_sensores") {
                    audioReporte.currentTime = 0;
                    audioReporte.play().catch(err => console.warn("Audio bloqueado por el navegador:", err));
                    reporteInicialSensores();          
                    if (window.MIS_SENSORES && mapUltimo) {
                        window.MIS_SENSORES.forEach((sensor, index) => {
                            if (sensor.activo === false) {
                                mapUltimo.setFeatureState({ source: 'sensores-alerta', id: index }, { color: '#ff0000', reportando: false });
                            }
                        });
                    }
                } else if (d.accion === "reporte_sensor_individual") {
                    if (d.id_sensor) {
                        audioReporte.currentTime = 0;
                        audioReporte.play().catch(err => console.warn("Audio bloqueado por el navegador:", err));
                        
                        registrarLogSensor(d.id_sensor, "Reportándose", "online");
                        animarReporteSensor(d.id_sensor, 8000); 
                    }
                } else if (d.accion === "reporte_ciudad_individual") {
                    if (d.id_ticker && mapUltimo) {
                        const tickerBuscado = d.id_ticker.trim().toUpperCase();
                        const ciudadTarget = ciudadesSasmexBase.find(c => c.idTicker === tickerBuscado || c.nombre.toUpperCase() === tickerBuscado);
                        if (ciudadTarget) {
                            if (CONFIG_AUDIOS.sensores && sonidoActivado) {
                                const sRep = document.getElementById('sonidoreportesensor');
                                if (sRep) {
                                    const clon = sRep.cloneNode();
                                    clon.volume = 0.4;
                                    clon.play().catch(() => {});
                                }
                            }
                            const esRep = ciudadTarget.esRepetidora === true;const featureNueva = {
                                'type': 'Feature',
                                'id': ciudadTarget.id, 
                                'properties': { 
                                    'nombre': ciudadTarget.nombre, 
                                    'idTicker': ciudadTarget.idTicker,
                                    'esRepetidora': esRep
                                }, 
                                'geometry': { 'type': 'Point', 'coordinates': [ciudadTarget.lon, ciudadTarget.lat] }
                            };
                            if (!mapUltimo.getSource('ciudades-telemetria')) {
                                mapUltimo.addSource('ciudades-telemetria', { 
                                    'type': 'geojson', 
                                    'data': { 'type': 'FeatureCollection', 'features': [featureNueva] } 
                                });
                                mapUltimo.addLayer({
                                    'id': 'layer-telemetria-circulo', 
                                    'type': 'circle', 
                                    'source': 'ciudades-telemetria',
                                    'paint': {
                                        'circle-radius': ['case', ['boolean', ['get', 'esRepetidora'], false], 6, 11],
                                        'circle-color': ['case', 
                                            ['boolean', ['feature-state', 'reportando'], false],
                                            ['case', ['boolean', ['get', 'esRepetidora'], false], 'rgba(135, 206, 235, 0.6)', 'rgba(0, 255, 0, 0.4)'],
                                            'rgba(0,0,0,0)'
                                        ], 
                                        'circle-stroke-width': ['case', ['boolean', ['get', 'esRepetidora'], false], 2, 3], 
                                        'circle-stroke-color': ['case', 
                                            ['boolean', ['feature-state', 'reportando'], false],
                                            ['case', ['boolean', ['get', 'esRepetidora'], false], '#87ceeb', '#00ff00'],
                                            'rgba(0,0,0,0)'
                                        ], 
                                        'circle-blur': 0.1
                                    }
                                });
                            } else {
                                const dataActual = mapUltimo.getSource('ciudades-telemetria')._data;
                                const filtrados = dataActual.features.filter(f => f.id !== ciudadTarget.id);
                                filtrados.push(featureNueva);
                                mapUltimo.getSource('ciudades-telemetria').setData({
                                    'type': 'FeatureCollection',
                                    'features': filtrados
                                });
                            }
                            mapUltimo.setFeatureState({ source: 'ciudades-telemetria', id: ciudadTarget.id }, { reportando: true });
                            const tickerEl = document.getElementById('ticker-text');
                            if (tickerEl) {
                                const tipoTag = esRep ? "REPETIDORA" : "CENTRAL";
                                tickerEl.setAttribute('data-actual-id', ciudadTarget.idTicker);
                                tickerEl.innerHTML = `<span style="color: ${esRep ? '#87ceeb' : '#00ff00'}; font-weight: bold; letter-spacing: 1px;"> [${tipoTag}] ${ciudadTarget.nombre} Reportándose </span>`;
                            }
                            registrarLogSensor(ciudadTarget.idTicker, esRep ? "Antena repetidora reportándose." : "Central de difusión reportándose.", "online");
                            setTimeout(() => {
                                if (mapUltimo && mapUltimo.getSource('ciudades-telemetria')) {
                                    mapUltimo.setFeatureState({ source: 'ciudades-telemetria', id: ciudadTarget.id }, { reportando: false });
                                    const dataActual = mapUltimo.getSource('ciudades-telemetria')._data;
                                    const featuresRestantes = dataActual.features.filter(f => f.id !== ciudadTarget.id);
                                    mapUltimo.getSource('ciudades-telemetria').setData({
                                        'type': 'FeatureCollection',
                                        'features': featuresRestantes
                                    });
                                    if (tickerEl && tickerEl.getAttribute('data-actual-id') === ciudadTarget.idTicker) {
                                        tickerEl.innerHTML = "";
                                        tickerEl.removeAttribute('data-actual-id');
                                    }
                                }
                            }, 4000);
                        }
                    }
                } else if (d.accion === "mensaje_personalizado") {
                    if (d.id && d.texto) {
                        const idLimpio = d.id.trim().toUpperCase();
                        const textoLimpio = d.texto.trim();
                        const tickerEl = document.getElementById('ticker-text');
                        if (tickerEl) {
                            tickerEl.setAttribute('data-actual-id', `CUSTOM_${idLimpio}`);
                            tickerEl.innerHTML = `<span style="color: #00ff00; font-weight: bold; letter-spacing: 1px;"> ${idLimpio}: ${textoLimpio} </span>`;
                        }
                        registrarLogSensor(idLimpio, textoLimpio, "conexion");
                        setTimeout(() => {
                            if (tickerEl && tickerEl.getAttribute('data-actual-id') === `CUSTOM_${idLimpio}`) {
                                tickerEl.innerHTML = "";
                                tickerEl.removeAttribute('data-actual-id');
                            }
                        }, 4000);
                    }
                } else if (d.accion === "cambiar_estado_sensor") {
                    if (d.id_sensor && window.MIS_SENSORES) {
                        const idBuscado = d.id_sensor.trim().toUpperCase();
                        const idx = window.MIS_SENSORES.findIndex(s => s.id === idBuscado);
                        if (idx !== -1) {
                            window.MIS_SENSORES[idx].activo = d.activo;
                            localStorage.setItem(`sasepa_sensor_${idBuscado}`, d.activo);
                            const tickerEl = document.getElementById('ticker-text');
                            if (tickerEl) {
                                if (timerTickerGlobal) clearTimeout(timerTickerGlobal);
                                if (d.activo === false) {
                                    registrarLogSensor(idBuscado, "FUERA DE SERVICIO", "desconectado");
                                    tickerEl.innerHTML = `<span style="color: #ff0000; font-weight: bold; letter-spacing: 1px;">${idBuscado}: FUERA DE SERVICIO</span>`;
                                } else {
                                    registrarLogSensor(idBuscado, "EN SERVICIO.", "online");
                                    tickerEl.innerHTML = `<span style="color: #00ff00; font-weight: bold; letter-spacing: 1px;">${idBuscado}: EN SERVICIO</span>`;
                                }
                                timerTickerGlobal = setTimeout(() => { tickerEl.innerHTML = ""; }, 10000);
                            }
                            if (mapUltimo && mapUltimo.getSource('sensores-alerta')) {
                                const colorEstado = d.activo ? null : '#ff0000';
                                mapUltimo.setFeatureState(
                                    { source: 'sensores-alerta', id: idx }, 
                                    { color: colorEstado, reportando: false }
                                );
                                const featuresActualizadas = window.MIS_SENSORES.map((s, index) => {
                                    const colorInicial = (s.activo === false) ? '#ff0000' : '#00ff00';
                                    return { 
                                        'type': 'Feature', 
                                        'id': index, 
                                        'properties': { 'nombre': s.nombre, 'color': colorInicial }, 
                                        'geometry': { 'type': 'Point', 'coordinates': [parseFloat(s.lon), parseFloat(s.lat)] }
                                    };
                                });
                                mapUltimo.getSource('sensores-alerta').setData({ 'type': 'FeatureCollection', 'features': featuresActualizadas });
                            }
                        }
                    }
                } else if (d.accion === "sistema_offline") {
                    const regionObjetivo = d.region ? d.region.trim().toUpperCase() : "TODOS";
                    const tickerEl = document.getElementById('ticker-text');
                    
                    if (regionObjetivo === "TODOS") {
                        if (tickerEl) tickerEl.innerHTML = '<span style="color: red; font-weight: bold; letter-spacing: 2px;">SYSTEM OFFLINE</span>';
                        registrarLogSensor("sasepa.net.v8", "El servidor remoto reporta desconexión global.", "desconectado");
                    } else {
                        if (tickerEl) {
                            tickerEl.innerHTML = `<span style="color: red; font-weight: bold; letter-spacing: 2px;">OFFLINE: REGIÓN ${regionObjetivo}</span>`;
                            setTimeout(() => { tickerEl.innerHTML = ""; }, 10000);
                        }
                        registrarLogSensor("sasepa.net.v8", `Región ${regionObjetivo} fuera de servicio.`, "desconectado");
                    }

                    if (window.MIS_SENSORES && mapUltimo) {
                        window.MIS_SENSORES.forEach((sensor, index) => {
                            const idSensorUpper = (sensor.id || "").trim().toUpperCase();
                            if (regionObjetivo === "TODOS" || idSensorUpper === regionObjetivo || idSensorUpper.startsWith(regionObjetivo + "-")) {
                                sensor.activo = false; 
                                localStorage.setItem(`sasepa_sensor_${sensor.id}`, false);
                                mapUltimo.setFeatureState({ source: 'sensores-alerta', id: index }, { color: '#ff0000', reportando: false });
                            }
                        });
                        const featuresActualizadas = window.MIS_SENSORES.map((s, index) => {
                            const colorInic = (s.activo === false) ? '#ff0000' : '#00ff00';
                            return {
                                'type': 'Feature', 'id': index, 'properties': { 'nombre': s.nombre, 'color': colorInic }, 'geometry': { 'type': 'Point', 'coordinates': [parseFloat(s.lon), parseFloat(s.lat)] }
                            };
                        });
                        mapUltimo.getSource('sensores-alerta').setData({ 'type': 'FeatureCollection', 'features': featuresActualizadas });
                    }
                } else if (d.accion === "sistema_online") {
                    const regionObjetivo = d.region ? d.region.trim().toUpperCase() : "TODOS";
                    const tickerEl = document.getElementById('ticker-text');
                    
                    if (tickerEl) tickerEl.innerHTML = "";
                    if (timerTickerGlobal) clearTimeout(timerTickerGlobal);
                    registrarLogSensor("sasepa.net.v8", `Restableciendo servicio para: ${regionObjetivo}...`, "conexion");

                    if (window.MIS_SENSORES && mapUltimo) {
                        window.MIS_SENSORES.forEach((sensor, index) => {
                            const idSensorUpper = (sensor.id || "").trim().toUpperCase();
                            if (regionObjetivo === "TODOS" || idSensorUpper === regionObjetivo || idSensorUpper.startsWith(regionObjetivo + "-")) {
                                sensor.activo = true; 
                                localStorage.setItem(`sasepa_sensor_${sensor.id}`, true);
                                mapUltimo.setFeatureState({ source: 'sensores-alerta', id: index }, { color: null, reportando: false });
                            }
                        });
                        const featuresActualizadas = window.MIS_SENSORES.map((s, index) => {
                            const colorInic = (s.activo === false) ? '#ff0000' : '#00ff00';
                            return {
                                'type': 'Feature', 'id': index, 'properties': { 'nombre': s.nombre, 'color': colorInic }, 'geometry': { 'type': 'Point', 'coordinates': [parseFloat(s.lon), parseFloat(s.lat)] }
                            };
                        });
                        mapUltimo.getSource('sensores-alerta').setData({ 'type': 'FeatureCollection', 'features': featuresActualizadas });
                    }
                    audioReporte.currentTime = 0;
                    audioReporte.play().catch(err => console.warn("Audio bloqueado por el navegador:", err));
                    reporteInicialSensores();
                    mostrarStatusServidorv7();
                }
                return; 
            }

            if (topic === 'sasepa/monitor/alertas/adminv7/0398cvhhs77ehh6365g') {
                if (!d || !d.fecha) {
                    return;
                }

                localStorage.removeItem('atendida');
                bloqueoPorAlerta = false;

                const datosNormalizados = {
                    lat: d.coordenadas?.latitud || d.lat || 0,
                    lon: d.coordenadas?.longitud || d.lon || 0,
                    intensidad: d.intensidad || "Moderate",
                    zona: d.zona || "Zona indeterminada",
                    fecha: d.fecha || new Date().toISOString(),
                    esSimulacion: !!d.esSimulacion,
                    sensor: d.sensor || "SASMEX",
                    identificador: d.identificador || `${d.fecha}|${d.zona}`
                };

                if (d.sensor && window.MIS_SENSORES) {
                const idSismo = d.sensor.trim().toUpperCase();
                if (idSismo !== "SASMEX") {
                    const sensorOrigen = window.MIS_SENSORES.find(s => s.id === idSismo);
                    if (sensorOrigen && sensorOrigen.activo === false) return;
                }
            }

                if (window.MIS_SENSORES && mapUltimo) {
                    window.MIS_SENSORES.forEach((s, index) => {
                        if (s.activo === false) {
                            mapUltimo.setFeatureState({ source: 'sensores-alerta', id: index }, { color: '#ff0000' });
                        } else {
                            mapUltimo.setFeatureState({ source: 'sensores-alerta', id: index }, { color: null });
                        }
                    });
                }

                const id = datosNormalizados.identificador;
                ultimaAlertaId = id;
                lastSyncTime = Date.now();

                registrarLogSensor(d.sensor || "#TenemosSismo", `Región: ${d.zona} | Intensidad: ${d.intensidad}`, "alerta");
                try { agregarAlHistorial(datosNormalizados); } catch (err) {}
                
                ejecutarNuevaAlerta(datosNormalizados, true);
            }
        } catch (error) {
            console.error("Error al procesar MQTT:", error);
        }
    });

    clienteMQTT.on('error', (err) => { console.error("MQTT Error:", err); });
    clienteMQTT.on('close', () => { console.warn("MQTT Cerrado"); });
}

function mostrarConteoSimulacroNacional() {
        const contenedor = document.getElementById('simulacro-nacional-container');
        if (!contenedor) return;
        contenedor.style.display = 'block';

        if (intervaloSimulacroNacional) clearInterval(intervaloSimulacroNacional);

        const fechaObjetivo = new Date('2026-09-19T12:00:00-06:00').getTime();

        intervaloSimulacroNacional = setInterval(() => {
            const ahora = Date.now();
            const diferencia = fechaObjetivo - ahora;
            const relojEl = document.getElementById('simulacro-nacional-reloj');

            if (!relojEl) return;

            if (diferencia <= 0) {
                relojEl.textContent = "¡SIMULACRO EN DESARROLLO!";
                return;
            }

            const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
            const horas = Math.floor((diferencia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutos = Math.floor((diferencia % (1000 * 60 * 60)) / (1000 * 60));
            const segundos = Math.floor((diferencia % (1000 * 60)) / 1000);

            relojEl.textContent = `${dias}d ${String(horas).padStart(2, '0')}h ${String(minutos).padStart(2, '0')}m ${String(segundos).padStart(2, '0')}s`;
        }, 1000);
}

function ocultarConteoSimulacroNacional() {
        const contenedor = document.getElementById('simulacro-nacional-container');
        if (contenedor) contenedor.style.display = 'none';
        if (intervaloSimulacroNacional) {
            clearInterval(intervaloSimulacroNacional);
            intervaloSimulacroNacional = null;
        }
}

function mostrarRecomendacionesProteccionCivil() {
    if (document.getElementById('modal-proteccion-civil')) return;

    const modal = document.createElement('div');
    modal.id = 'modal-proteccion-civil';
    Object.assign(modal.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: '99999',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    });

    modal.innerHTML = `
        <div style="background: #0f1928; border: 2px solid #ffcc00; border-radius: 12px; padding: 25px; width: 90%; max-width: 450px; color: #fff; box-shadow: 0 0 25px rgba(255, 204, 0, 0.3); position: relative;">
            <button onclick="cerrarRecomendacionesPC()" style="position: absolute; top: 12px; right: 15px; background: transparent; border: none; color: #ffcc00; font-size: 18px; font-weight: bold; cursor: pointer;">&times;</button>
            
            <h3 style="margin: 0 0 15px 0; color: #ffcc00; font-size: 16px; text-align: center; letter-spacing: 1px; text-transform: uppercase;">
                <i class="fas fa-shield-alt"></i> Protocolo de Protección Civil
            </h3>
            
            <div style="font-size: 13px; line-height: 1.6; color: #ddd; text-align: left;">
                <p style="margin: 0 0 10px 0;">🛡️ <b>Antes del simulacro:</b> Identifica las zonas de menor riesgo, rutas de evacuación y salidas de emergencia.</p>
                <p style="margin: 0 0 10px 0;">🛑 <b>Durante el evento:</b> Conserva la calma. <b>No corro, no empujo, no grito</b> y dirígete a la zona de seguridad establecida.</p>
                <p style="margin: 0 0 10px 0;">⚡ <b>Acciones clave:</b> Si estás en una zona segura asignada, aléjate de ventanas, repisas, vidrios o postes y cables de luz.</p>
                <p style="margin: 0;">✅ <b>Después del sismo:</b> Revisa si hay daños en tu inmueble, no enciendas cerillos o velas hasta descartar fuga de gas, y sigue las indicaciones de las autoridades.</p>
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
                <button onclick="cerrarRecomendacionesPC()" style="background: #ffcc00; color: #0f1928; border: none; padding: 8px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 12px;">ENTENDIDO</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function cerrarRecomendacionesPC() {
    const modal = document.getElementById('modal-proteccion-civil');
    if (modal) modal.remove();
}

function ejecutarNuevaAlerta(d, permitirAcciones = false) {
    if (window.intervaloETA) {
        clearInterval(window.intervaloETA);
        window.intervaloETA = null;
    }

    function emitirAlertaVoz(segsETA, intLocal) {
        if (!intLocal || intLocal.toUpperCase() === "IMPERCEPTIBLE") return;
        if (!('speechSynthesis' in window)) return;
        if (segsETA > 0 && segsETA < 4) return;

        let texto = "";
        if (segsETA <= 0) {
            texto = "Sismo ocurriendo ahora en tu ubicación.";
        } else if (intLocal.toUpperCase() === "FUERTE") {
            texto = `Alerta sísmica. Sentirás sismo Fuerte en ${segsETA} segundos.`;
        } else {
            texto = `Sentirás el sismo en ${segsETA} segundos.`;
        }

        window.speechSynthesis.cancel();

        const mensaje = new SpeechSynthesisUtterance(texto);
        mensaje.lang = 'es-MX';
        mensaje.rate = 1.30;
        mensaje.pitch = 1.0;
        
        const voces = window.speechSynthesis.getVoices();
        const vozMX = voces.find(v => v.lang && (v.lang.includes('es-MX') || v.lang.includes('es_MX')));
        if (vozMX) mensaje.voice = vozMX;

        mensaje.onend = () => {
            window.speechSynthesis.cancel();
        };

        window.speechSynthesis.speak(mensaje);
    }

    const intInput = (d.intensidad || "").toUpperCase();
    let esSeveroVisual = (intInput.includes("SEVERE") || intInput.includes("SEVERO") || intInput.includes("FUERTE"));
    let tipoAnterior = window.tipoOrigenActual || "MODERATE";
    if (esSeveroVisual) {
        window.tipoOrigenActual = "SEVERE";
    } else {
        window.tipoOrigenActual = "MODERATE";
    }
    let sismoLat = 0;
    let sismoLon = 0;
    
    const nombreSensorReportado = (d.sensor || d.zona || "").trim().toUpperCase();
    if (typeof MIS_SENSORES !== 'undefined' && MIS_SENSORES.length > 0) {
        const sensorEncontrado = MIS_SENSORES.find(s => {
            const idS = (s.id || "").trim().toUpperCase();
            const nomS = (s.nombre || "").trim().toUpperCase();
            return idS === nombreSensorReportado || nomS === nombreSensorReportado || nombreSensorReportado.includes(idS);
        });

        if (sensorEncontrado && sensorEncontrado.lat && sensorEncontrado.lon) {
            sismoLat = parseFloat(sensorEncontrado.lat);
            sismoLon = parseFloat(sensorEncontrado.lon);
            console.log(`📍 Coordenadas ajustadas al sensor local "${sensorEncontrado.nombre || sensorEncontrado.id}":`, sismoLat, sismoLon);
        }
    }

    if (sismoLat === 0 && sismoLon === 0) {
        sismoLat = parseFloat(d.lat || d.coordenadas?.latitud || 0);
        sismoLon = parseFloat(d.lon || d.coordenadas?.longitud || 0);
    }

    if (sismoLat === 0 && sismoLon === 0 && window.memoriaLat !== 0) {
        sismoLat = window.memoriaLat;
        sismoLon = window.memoriaLon;
    } else if (sismoLat !== 0 || sismoLon !== 0) {
        window.memoriaLat = sismoLat;
        window.memoriaLon = sismoLon;
    }

    let colorOndaDinamico = esSeveroVisual ? '#ff0000' : '#a9f135';
    let distanciaKM = 0;
    
    function sCoordinateMatch() { return sismoLat !== 0 && sismoLon !== 0; }

    if (userCoords && sCoordinateMatch()) {
        distanciaKM = calcularDistancia(userCoords[1], userCoords[0], sismoLat, sismoLon);
    }
    
    let intensidadLocal = "Imperceptible";
    let colorPercepcion = "#40f184";
    let distFinal = distanciaKM.toFixed(0);
    let esAlertaCritica = false;
    
    if (userCoords && sCoordinateMatch()) {
        if (esSeveroVisual) {
            if (distanciaKM < 540) {
                intensidadLocal = "Fuerte";
                colorPercepcion = "#ff0000";
                esAlertaCritica = true;
            } else if (distanciaKM <= 987) {
                intensidadLocal = "Ligero/Moderado";
                colorPercepcion = "#a9f135";
            }
        } else {
            if (distanciaKM < 70) {
                intensidadLocal = "Ligero/Moderado";
                colorPercepcion = "#a9f135";
            }
        }
    }

    let esUbicacionFuerte = (intensidadLocal === "Fuerte" || esAlertaCritica);

    function renderizarBannerVisual() {
        const banner = document.getElementById('alert-container');
        const bannerBg = document.getElementById('banner-bg');
        const titleEl = document.getElementById('alert-title');
        const zoneEl = document.getElementById('alert-zone');
        const magEl = document.getElementById('alert-mag');
        const etaEl = document.getElementById('alert-eta');
        const percepcionEl = document.getElementById('alert-percepcion');
        const alertFecha = document.getElementById('alert-fecha');
        
        if (alertFecha) {
            const ahora = new Date();
            const dia = String(ahora.getDate()).padStart(2, '0');
            const mes = String(ahora.getMonth() + 1).padStart(2, '0');
            const anio = ahora.getFullYear();
            const horas = String(ahora.getHours()).padStart(2, '0');
            const minutos = String(ahora.getMinutes()).padStart(2, '0');
            const segundos = String(ahora.getSeconds()).padStart(2, '0');
            
            alertFecha.textContent = d.fecha || `${dia}/${mes}/${anio} ${horas}:${minutos}:${segundos}`;
        }
        
        if (bannerBg) bannerBg.classList.remove('fuerte-glow', 'moderado-glow');
        
        if (!esSeveroVisual) {
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
        
        let textoFinal = esSeveroVisual ? "Fuerte" : "Ligero / Moderado";
        let colorTextoOrigen = esSeveroVisual ? "#ff0000" : "#a9f135";
        
        if (bannerBg) {
            if (esSeveroVisual) {
                bannerBg.style.background = "linear-gradient(180deg, #dd1313 0%, #ff0000 100%)";
                bannerBg.classList.add('fuerte-glow');
            } else {
                bannerBg.style.background = "linear-gradient(180deg, #a9f135 0%, #689621 100%)";
                bannerBg.classList.add('moderado-glow');
            }
        }
        
        if (titleEl) titleEl.textContent = d.esSimulacion ? "SIMULACION" : (esAlertaCritica ? "ALERTA CRÍTICA" : "SISMO DETECTADO");
        if (banner) banner.style.display = 'block';
        if (zoneEl) zoneEl.textContent = d.zona || '--';
        if (magEl) { magEl.textContent = textoFinal; magEl.style.color = colorTextoOrigen; }
        
        if (esUbicacionFuerte) {
            let panicOverlay = document.getElementById('panic-overlay');
            if (!panicOverlay) {
                panicOverlay = document.createElement('div');
                panicOverlay.id = 'panic-overlay';
                panicOverlay.className = 'modo-panico';
                document.getElementById('app-content').appendChild(panicOverlay);
            }
        }
    }

    let esMismoSismo = false;
    if (window.lastSismoLat && window.lastSismoLon) {
        let distanciaEntreReportes = calcularDistancia(window.lastSismoLat, window.lastSismoLon, sismoLat, sismoLon);
        if (distanciaEntreReportes < 30 || window.lastSismoZona === d.zona) {
            esMismoSismo = true;
        }
    }

    function arrancarOActualizarETA(esEscalacion = false) {
        const etaEl = document.getElementById('alert-eta');
        if (etaEl && userCoords) {
            const dist = calcularDistancia(userCoords[1], userCoords[0], sismoLat, sismoLon);
            
            let segs = 0;
            if (esEscalacion && window.segundosRestantesETA !== undefined && window.segundosRestantesETA > 0) {
                segs = window.segundosRestantesETA;
            } else {
                segs = Math.round(dist / 3.4) - Math.round(tiempoDesfase);
            }
            
            if (permitirAcciones && sonidoActivado) {
                emitirAlertaVoz(segs, intensidadLocal);
            }
            
            let contadorCicloTTS = 0;
            window.intervaloETA = setInterval(() => {
                segs--; 
                contadorCicloTTS++;
                window.segundosRestantesETA = segs; 
                etaEl.textContent = segs >= 0 ? segs : "0";
                
                if (segs === 0) {
                    if (permitirAcciones && sonidoActivado) {
                        emitirAlertaVoz(0, intensidadLocal);
                    }
                } else if (contadorCicloTTS >= 6) {
                    if (permitirAcciones && sonidoActivado && segs > 0) {
                        emitirAlertaVoz(segs, intensidadLocal);
                    }
                    contadorCicloTTS = 0;
                }
                
                if (segs < -10) { 
                    clearInterval(window.intervaloETA); 
                    window.intervaloETA = null; 
                    window.segundosRestantesETA = null;
                }
            }, 1000);
        }
    }
    
    let esEscalacionSevera = esMismoSismo && (tipoAnterior === "MODERATE" && window.tipoOrigenActual === "SEVERE");
    let tiempoDesfase = 0;
    if (d.timestamp_inicio) {
        let tsInicioCorr = d.timestamp_inicio < 9999999999 ? d.timestamp_inicio * 1000 : d.timestamp_inicio;
        tiempoDesfase = (Date.now() - tsInicioCorr) / 1000;
    }
    if (tiempoDesfase < 0 || isNaN(tiempoDesfase)) tiempoDesfase = 0;

    if (bloqueoPorAlerta && esMismoSismo) {
        window.colorOndaSActualPersistente = '#ff0000';
        
        if (esUbicacionFuerte) {
            const audiosAQuitar = ['sonidoEvento', 'sonidointensidadleve', 'sonidointensidadmoderado'];
            audiosAQuitar.forEach(id => { const a = document.getElementById(id); if(a) { a.pause(); a.currentTime = 0; }});
            if (permitirAcciones && sonidoActivado) {
                const sGralFuerte = document.getElementById('sonidoEventoFuerte');
                const sIntFuerte = document.getElementById('sonidointensidadfuerte');
                const sGralDebil = document.getElementById('sonidoEvento');
                const sMod = document.getElementById('sonidointensidadmoderado');
                if (CONFIG_AUDIOS.alertas) {
                    let sonidoGral = esUbicacionFuerte ? sGralFuerte : sGralDebil;
                    if (sonidoGral && sonidoGral.paused) { sonidoGral.loop = false; sonidoGral.play().catch(e => {}); }
                }
                if (CONFIG_AUDIOS.intensidades) {
                    let sonidoInt = esUbicacionFuerte ? sIntFuerte : sMod;
                    if (sonidoInt && sonidoInt.paused) { sonidoInt.loop = false; sonidoInt.play().catch(e => {}); }
                }
            }
        }
        
        renderizarBannerVisual();
        if (esEscalacionSevera) {
            arrancarOActualizarETA(true);
        }
    } else {
        window.lastSismoLat = sismoLat; window.lastSismoLon = sismoLon; window.lastSismoZona = d.zona;
        if (window.timeoutCierre) clearTimeout(window.timeoutCierre);
        if (window.timeoutCierreSismoDos) clearTimeout(window.timeoutCierreSismoDos);
        if (window.timerTicker) clearTimeout(window.timerTicker);
        if (!esSeveroVisual) {
            if (window.intervaloOndas) { clearInterval(window.intervaloOndas); window.intervaloOndas = null; }
            if (mapUltimo) {
                ['ondas', 'lineas-sensores', 'epicentro'].forEach(f => {
                    if (mapUltimo.getSource(f)) mapUltimo.getSource(f).setData({ 'type': 'FeatureCollection', 'features': [] });
                });
                if (mapUltimo.getLayer('layer-sensores-puntos')) mapUltimo.setPaintProperty('layer-sensores-puntos', 'circle-color', '#00ff00');
            }
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
            let miEstadoCalculado = "DESCONOCIDO";
            const uLon = userCoords[0]; const uLat = userCoords[1];
            
            if (uLon >= -99.4 && uLon <= -98.9 && uLat >= 19.0 && uLat <= 19.6) {
                miEstadoCalculado = "CDMX";
            } else if (uLon >= -98.8 && uLon <= -97.3 && uLat >= 17.9 && uLat <= 19.5) {
                miEstadoCalculado = "Puebla";
            } else if (uLon >= -100.6 && uLon <= -98.6 && uLat >= 18.3 && uLat <= 20.3) {
                miEstadoCalculado = "Edomex";
            } else if (uLon < -104.0 && uLat > 19.5) {
                miEstadoCalculado = "Jalisco";
            } else if (uLon < -103.4 && uLat >= 18.7 && uLat <= 19.5) {
                miEstadoCalculado = "Colima";
            } else if (uLon >= -103.4 && uLon <= -102.0 && uLat <= 19.0) {
                miEstadoCalculado = "Michoacán";
            } else if (uLon >= -102.0 && uLon <= -98.5 && uLat >= 16.2 && uLat <= 18.4) {
                miEstadoCalculado = "Guerrero";
            } else if (uLon > -98.5 && uLon <= -94.0 && uLat <= 18.0) {
                miEstadoCalculado = "Oaxaca";
            } else if (uLon >= -99.4 && uLon <= -98.9 && uLat >= 18.5 && uLat <= 19.1) {
                miEstadoCalculado = "Morelos";
            }
            
            if (!d.esSimulacion && d.estados_permitidos) {
                let estadosPermitidosStr = String(d.estados_permitidos).toUpperCase();
                
                if (!estadosPermitidosStr.includes("TODOS")) {
                    let estaIncluido = false;
                    
                    if (estadosPermitidosStr.includes("CDMX") && miEstadoCalculado === "CDMX") estaIncluido = true;
                    if ((estadosPermitidosStr.includes("EDOMEX") || estadosPermitidosStr.includes("ESTADO DE MEXICO")) && miEstadoCalculado === "Edomex") estaIncluido = true;
                    if (estadosPermitidosStr.includes("PUEBLA") && miEstadoCalculado === "Puebla") estaIncluido = true;

                    if (!estaIncluido) {
                        return;
                    }
                }
            }
        }
        
        if (permitirAcciones && sonidoActivado) {
            const sMod = document.getElementById('sonidointensidadmoderado');
            const sFuerteAudio = document.getElementById('sonidointensidadfuerte');
            const sGralDebil = document.getElementById('sonidoEvento');
            const sGralFuerte = document.getElementById('sonidoEventoFuerte');
            enviarNotificacionPush(d);
            
            if (CONFIG_AUDIOS.intensidades) {
                let sonidoSensor = esUbicacionFuerte ? sFuerteAudio : sMod;
                if (sonidoSensor) { sonidoSensor.loop = false; sonidoSensor.currentTime = 0; sonidoSensor.play().catch(e => {}); }
            }
            if (CONFIG_AUDIOS.alertas) {
                let sonidoGral = esUbicacionFuerte ? sGralFuerte : sGralDebil;
                setTimeout(() => { if (sonidoGral) { sonidoGral.loop = false; sonidoGral.currentTime = 0; sonidoGral.play().catch(e => {}); } }, 800);
            }
        }
        cortarYGuardarSismo();
        bloqueoPorAlerta = true;
        limpiarReportesDeSensoresParaAlerta();
        renderizarBannerVisual();
        arrancarOActualizarETA(false);
    }
    
    requestAnimationFrame(() => {
        try {
            if (typeof actualizarMarcadorEpicentro === 'function') {
                actualizarMarcadorEpicentro(sismoLat, sismoLon, esSeveroVisual ? "Fuerte" : "Ligero / Moderado");
            }
            if (typeof dibujarOndas === 'function') {
                dibujarOndas(sismoLat, sismoLon, mapUltimo, colorOndaDinamico, tiempoDesfase, esEscalacionSevera);
            }
        } catch (err) {
            console.error("Error crítico al dibujar:", err);
        }
    });
    
    if (typeof actualizarCirculosCiudades === 'function') {
        actualizarCirculosCiudades(sismoLat, sismoLon, window.tipoOrigenActual);
    }
    
    if (window.timeoutCierre) clearTimeout(window.timeoutCierre);
    if (window.timeoutCierreSismoDos) clearTimeout(window.timeoutCierreSismoDos);
    window.timeoutCierre = setTimeout(() => { detenerAlerta(); window.intervaloETA = null; window.segundosRestantesETA = null; }, 500000);
    window.timeoutCierreSismoDos = setTimeout(() => { resetearSensores(); }, 500000);
}

function dibujarOndas(lat, lon, mapa, colorS, desfase = 0, esActualizacion = false) {
    if (!mapa || !mapa.getSource('ondas')) return;
    window.colorOndaSActualPersistente = 'rgba(82, 226, 113, 0.63)';
    if (esActualizacion && window.intervaloOndas) {
        return; 
    }
    if (window.intervaloOndas) {
        clearInterval(window.intervaloOndas);
        window.intervaloOndas = null;
    } 

    const idSismoUnico = `${lat}_${lon}_${Date.now()}`;
    window.idSismoActualActivo = idSismoUnico;
    
    let desfaseSegs = parseFloat(desfase);
    if (isNaN(desfaseSegs) || desfaseSegs > 200 || desfaseSegs < 0) {
        desfaseSegs = 0; 
    }
    
    const inicio = Date.now() - ((desfaseSegs + 6) * 1000);
    let lineasFeatures = [];
    
    let sensoresConEstado = MIS_SENSORES.filter(s => s.lat && s.lon).map((s, index) => {
        const idCorto = (s.id || "").trim().toUpperCase();
        const estadoGuardado = localStorage.getItem(`sasepa_sensor_${idCorto}`);
        if (estadoGuardado === 'false') {
            s.activo = false;
        }
        return {
            ...s,
            idOriginal: index, 
            dist: calcularDistancia(lat, lon, parseFloat(s.lat), parseFloat(s.lon)),
            colorPersistente: (s.activo === false) ? '#ff0000' : '#00ff00',
            yaSonado: false
        };
    }).sort((a, b) => a.dist - b.dist);

    window.intervaloOndas = setInterval(() => {
        try {
            if (!bloqueoPorAlerta || window.idSismoActualActivo !== idSismoUnico) {
                clearInterval(window.intervaloOndas);
                window.intervaloOndas = null; 
                return;
            }          
            
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
            const origenActual = window.tipoOrigenActual || "MODERATE";
            let topeMaximo = (origenActual === "SEVERE") ? 26 : 10; 
            
            const featuresSensores = sensoresConEstado.map((s, index) => {
                const idSensor = s.nombre || s.id || "S";
                let colorActual = s.colorPersistente;
                
                if (s.activo === false) {
                    return {
                        'type': 'Feature',
                        'id': s.idOriginal, 
                        'properties': { 'color': '#ff0000', 'nombre': s.nombre },
                        'geometry': { 'type': 'Point', 'coordinates': [parseFloat(s.lon), parseFloat(s.lat)] }
                    };
                }
                
                if (index < topeMaximo && rP >= s.dist) {
                    if (!s.yaSonado && typeof sonidoActivado !== 'undefined' && sonidoActivado) {
                        s.yaSonado = true;
                        let intensidadLogTexto = (origenActual === "SEVERE" && s.dist < 450) ? "Fuerte" : "Ligero/Moderado";
                        registrarLogSensor(idSensor, `#TenemosSismo - detección ${intensidadLogTexto}`, "alerta");
                        
                        let idAudio = (origenActual === "SEVERE") ? 'sonidointensidadfuerte' : 'sonidointensidadmoderado';
                        const sonidoBase = document.getElementById(idAudio);
                        if (sonidoBase) {
                            const clonSonido = sonidoBase.cloneNode();
                            clonSonido.volume = (idAudio === 'sonidointensidadfuerte') ? 0.8 : 0.5;
                            clonSonido.play().catch(e => {});
                        }
                    }          
                    
                    if (origenActual === "SEVERE") {
                        colorActual = (index < 8) ? '#ff0000' : '#a9f135';
                    } else {
                        colorActual = '#a9f135';
                    }      
                    
                    s.colorPersistente = colorActual;
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
                    'id': s.idOriginal, 
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
            
            const sourceSensoresId = mapa.getSource('sensores-alerta') ? 'sensores-alerta' : 'epicenter-history';
            if (mapa.getSource(sourceSensoresId)) mapa.getSource(sourceSensoresId).setData({ 'type': 'FeatureCollection', 'features': featuresSensores });
            
            const circuloP = crearCirculo([lon, lat], rP);
            const circuloS = crearCirculo([lon, lat], rS);
            
            if (mapa.getSource('ondas')) {
                mapa.getSource('ondas').setData({
                    'type': 'FeatureCollection',
                    'features': [
                        { 'type': 'Feature', 'properties': { 'tipo': 'P' }, 'geometry': { 'type': 'Polygon', 'coordinates': circuloP } },
                        { 'type': 'Feature', 'properties': { 'tipo': 'S', 'color': window.colorOndaSActualPersistente }, 'geometry': { 'type': 'Polygon', 'coordinates': circuloS } }
                    ]
                });
            }
        } catch (error) {
            console.error("Error en intervalo dibujarOndas:", error);
        }
    }, 100);
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

function float(val) {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
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
        spans.forEach(s => s.style.fontSize = estaOculto ? "12px" : "10px");
    }
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
    if (leyendaCerrada) {
        cuadro.classList.add('leyenda-oculta');
    } else {
        cuadro.classList.remove('leyenda-oculta');
    }

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
        { nombre: "Colima", lat: 19.2433, lon: -103.7247 },
        { nombre: "Guadalajara", lat: 20.66682, lon: -103.39182 },
        { nombre: "Chiapas", lat: 16.75693, lon: -93.12924 }
    ];
    let htmlInterno = `<div style="font-size:9px; font-weight:bold; border-bottom:1px solid #444; margin-bottom:8px; padding-bottom:4px; text-align:center; color:#aaa; letter-spacing:1px;">INTENSIDAD ESTIMADA</div>`;
    const featuresCiudades = ciudadesSasmex.map(c => {
        const dist = calcularDistancia(latEpi, lonEpi, c.lat, c.lon); 
        let colorTxt = "#40f184"; 
        let etiqueta = "Imperceptible 🟢";
        const intUpper = (intensidadGeneral || "").toUpperCase();
        let esSevere = intUpper.includes("SEVERE") || intUpper.includes("SEVERO") || intUpper.includes("FUERTE");
        if (esSevere) {
            if (dist < 540) {
                colorTxt = "#ff0000"; 
                etiqueta = "Fuerte 🔴";
            } else if (dist <= 987) {
                colorTxt = "#a9f135"; 
                etiqueta = "Ligero / Moderado 🟡";
            } else {
                colorTxt = "#40f184";
                etiqueta = "Imperceptible 🟢";
            }
        } else {
            if (dist < 70) {
                colorTxt = "#a9f135"; 
                etiqueta = "Ligero / Moderado 🟡";
            } else {
                colorTxt = "#40f184";
                etiqueta = "Imperceptible 🟢";
            }
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
        if (mapUltimo && mapUltimo.getSource('ciudades-difusion')) {
            mapUltimo.getSource('ciudades-difusion').setData({ 'type': 'FeatureCollection', 'features': [] });
        }
    }, 400000);
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
    menuHTML.style.minWidth = '320px';

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
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; justify-content: center;">
                <button id="btn-sim-severe" style="background: #ff2244; border: none; color: #fff; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 11px; transition: transform 0.1s; box-shadow: 0 4px 10px rgba(255,34,68,0.3);">🔴 SEVERE (Fuerte)</button>
                <button id="btn-sim-moderate" style="background: #3de66f; border: none; color: #333; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 11px; transition: transform 0.1s; box-shadow: 0 4px 10px rgba(255,255,0,0.2);">🟡 MODERATE (Ligero/Mod)</button>
            </div>
            <button id="btn-abortar-sim" style="margin-top: 16px; background: transparent; border: none; color: #666; cursor: pointer; font-size: 11px; text-decoration: underline;"> Cancelar Simulación</button>
        `;

        const botones = menuHTML.querySelectorAll('button');
        botones.forEach(b => {
            b.onmouseenter = () => b.style.transform = 'scale(1.03)';
            b.onmouseleave = () => b.style.transform = 'scale(1)';
        });

        document.getElementById('btn-sim-severe').onclick = () => disparar("Severe");
        document.getElementById('btn-sim-moderate').onclick = () => disparar("Moderate");
        document.getElementById('btn-abortar-sim').onclick = () => menuHTML.remove();

        function disparar(intensidadTipo) {
            const avisoStr = (intensidadTipo === "Severe") ? "Alerta Crítica" : "Sismo Detectado";

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
    setInterval(async () => {
        const latEl = document.getElementById('latencia-valor');
        if (latEl) {
            if (!navigator.onLine) {
                latEl.textContent = 'OFFLINE 🔴';
                latEl.style.color = '#ff3d00';
                return;
            }
            const tiempoInicio = performance.now();
            try {
                await fetch("https://sasepa-mapa-default-rtdb.firebaseio.com/.json?shallow=true", { 
                    method: "HEAD", 
                    cache: "no-store" 
                });
                const tiempoFin = performance.now();
                const latenciaMs = Math.round(tiempoFin - tiempoInicio);
                latEl.textContent = `${latenciaMs} ms 🟢`;
                latEl.style.color = '#00e676';
            } catch (err) {
                latEl.textContent = 'OFFLINE 🔴';
                latEl.style.color = '#ff3d00';
            }
        }
    }, 2000);
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
        tickerEl.innerHTML = `<span style="color: #929292; font-weight: bold;"> ${idSensor.toUpperCase()} Reportándose </span>`;
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
    registrarLogSensor("sasepa.net.v8", "conectado al servidor", "conexion");
    if (mapUltimo) {
        window.MIS_SENSORES.forEach((sensor, index) => {
            const estadoGuardado = localStorage.getItem(`sasepa_sensor_${sensor.id}`);
            if (estadoGuardado === 'false') {
                sensor.activo = false;
            }
            if (sensor.activo === false) return;
            mapUltimo.setFeatureState(
                { source: 'sensores-alerta', id: index },
                { reportando: false }
            );
        });
    }
    window.MIS_SENSORES.forEach((sensor, index) => {
        if (sensor.activo === false) {
            const idSensor = sensor.id || "NODO";
            const nombreSensor = sensor.nombre || "Sin Nombre";
            registrarLogSensor(idSensor, `Sin Reporte`, "desconectado");
            return; 
        }
        setTimeout(() => {
            if (!bloqueoPorAlerta) {
                registrarLogSensor(sensor.nombre || sensor.id, `Reportándose`, "online");
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
    if (typeof timersSensores !== 'undefined' && timersSensores !== null) {
        Object.keys(timersSensores).forEach((key) => {
            if (timersSensores[key]) {
                clearTimeout(timersSensores[key]);
            }
        });
        timersSensores = {}; 
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
            <i class="fas fa-plug" style="margin-right: 10px;"></i> CONECTAR MONITOR SASEPA V8
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
    const canalesAudio = ['sonidoEvento', 'sonidoEventoFuerte', 'sonidointensidadleve', 'sonidointensidadmoderado', 'sonidointensidadfuerte'];
    canalesAudio.forEach(id => {
        const audioNode = document.getElementById(id);
        if (audioNode) { 
            audioNode.pause(); 
            audioNode.currentTime = 0; 
            audioNode.loop = false; 
        }
    });

    if (window.audioContext && window.audioContext.state !== 'closed') {
        await window.audioContext.suspend(); 
    }

    if (window.intervaloOndas) clearInterval(window.intervaloOndas);
    if (window.intervaloETA) clearInterval(window.intervaloETA);
    if (window.timerTicker) clearTimeout(window.timerTicker); 
    if (window.timeoutCierre) clearTimeout(window.timeoutCierre);
    if (window.timeoutCierreSismoDos) clearTimeout(window.timeoutCierreSismoDos);
    if (window.timeoutCiudades) clearTimeout(window.timeoutCiudades);
    
    window.intervaloOndas = null; 
    window.lastSismoLat = 0;
    window.lastSismoLon = 0;
    window.lastSismoZona = "";
    window.segundosRestantesETA = null;

    const tickerEl = document.getElementById('ticker-text');
    if (tickerEl) tickerEl.innerHTML = "";

    const banner = document.getElementById('alert-container');
    const bannerBg = document.getElementById('banner-bg');
    if (banner) banner.style.display = 'none';
    if (bannerBg) bannerBg.classList.remove('fuerte-glow', 'moderado-glow');
    const panicOverlay = document.getElementById('panic-overlay');
    if (panicOverlay) panicOverlay.remove();

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
        }

        if (window.MIS_SENSORES && mapUltimo.getSource('sensores-alerta')) {
            const featuresBase = window.MIS_SENSORES.map((s, index) => {
                const idCorto = (s.id || "").trim().toUpperCase();
                const estadoGuardado = localStorage.getItem(`sasepa_sensor_${idCorto}`);
                if (estadoGuardado === 'false') {
                    s.activo = false;
                }
                const colorFinal = (s.activo === false) ? '#ff0000' : '#00ff00';
                const colorEstadoMapbox = (s.activo === false) ? '#ff0000' : null;
                mapUltimo.setFeatureState(
                    { source: 'sensores-alerta', id: index },
                    { color: colorEstadoMapbox, reportando: false }
                );
                return {
                    'type': 'Feature',
                    'id': index,
                    'properties': { 
                        'color': colorFinal,
                        'nombre': s.nombre 
                    },
                    'geometry': { 
                        'type': 'Point', 
                        'coordinates': [parseFloat(s.lon), parseFloat(s.lat)] 
                    }
                };
            });
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
        script.onload = () => ejecutarCapture();
        document.head.appendChild(script);
    } else {
        ejecutarCapture();
    }

    function ejecutarCapture() {
        const bentoControl = document.querySelector('.contenedor-controles-manuales');
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

function iniciarReloj() {
    let ultimoSegundo = -1;

    function actualizar() {
        const ahora = new Date();
        const segundoActual = ahora.getSeconds(); 
        if (segundoActual !== ultimoSegundo) {
            ultimoSegundo = segundoActual;
            const h = ahora.toLocaleTimeString('es-MX', { 
                timeZone: 'America/Mexico_City', 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit', 
                hour12: false 
            });
            const f = ahora.toLocaleDateString('es-MX', { 
                timeZone: 'America/Mexico_City',
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit' 
            });
            const hEl = document.getElementById('hora-cdmx');
            const fEl = document.getElementById('fecha-cdmx');
            if(hEl) hEl.textContent = h;
            if(fEl) fEl.textContent = f;
        }
    }
    setInterval(actualizar, 100);
    actualizar();
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
    if (!token) return;

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
            }
        })
        .catch(err => {});
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
    let frames = 0;
    function actualizar() {
        if (!bloqueoPorAlerta || frames > 18000) return; 
        rP += VELOCIDAD_P / 60;
        rS += VELOCIDAD_S / 60;
        if (mapUltimo.getSource('ondaP')) mapUltimo.getSource('ondaP').setData(crearCirculo(coords, rP));
        if (mapUltimo.getSource('ondaS')) mapUltimo.getSource('ondaS').setData(crearCirculo(coords, rS));
        frames++;
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
        const titulo = datos.intensidad.includes("SEVERE") ? "⚠️ ALERTA CRÍTICA ⚠️" : "🔔 SISMO DETECTADO";
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

function mostrarStatusServidorv8() {
    const statusv8 = document.createElement('div');
    statusv8.id = 'status-v8-temporal';

    Object.assign(statusv8.style, {
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

    statusv8.innerHTML = 'conectado al servidor: sasepa.net.v8';

    document.body.appendChild(statusv8);

    setTimeout(() => {
        statusv8.style.opacity = '1';
    }, 100);

    setTimeout(() => {
        statusv8.style.opacity = '0';
        setTimeout(() => {
            if (statusv8.parentNode) {
                statusv8.parentNode.removeChild(statusv8);
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

        console.log("DVR: Grabación en bucle reanudada en segundo plano.");

    } catch (err) {
        console.error("Error al reiniciar la grabadora en segundo plano:", err);
    }
}

function togglePanelLogs() {
    const panel = document.getElementById('panel-lateral-logs');
    if (!panel) return;
    if (panel.classList.contains('panel-cerrado')) {
        panel.classList.remove('panel-cerrado');
        panel.classList.add('panel-abierto');
    } else {
        panel.classList.remove('panel-abierto');
        panel.classList.add('panel-cerrado');
    }
}

function registrarLogSensor(sensor, mensaje, tipo = 'online') {
    const contenedor = document.getElementById('contenedor-consola-logs');
    if (!contenedor) return;
    const ahora = new Date();
    const horaString = ahora.toTimeString().split(' ')[0];
    const nuevaLinea = document.createElement('div');
    nuevaLinea.classList.add('log-linea', `log-${tipo}`);
    nuevaLinea.setAttribute('data-tipo', tipo);
    let icono = '🟢';
    if (tipo === 'conexion') icono = '🔵';
    if (tipo === 'alerta') icono = '🚨';
    if (tipo === 'desconectado') icono = '🔴';
    nuevaLinea.innerHTML = `[${horaString}] ${icono} <strong>${sensor}</strong>: ${mensaje}`;
    contenedor.appendChild(nuevaLinea);
    if (!usuarioHaciendoScroll) {
        contenedor.scrollTop = contenedor.scrollHeight;
    }
    if (tipo === 'online') {
        contadorPingsTotales++;
        const elPings = document.getElementById('reporte-pings');
        if (elPings) elPings.textContent = contadorPingsTotales;
    }
    if (window.MIS_SENSORES && window.MIS_SENSORES.length > 0) {
        const activos = window.MIS_SENSORES.filter(s => s.activo === true || s.activo === undefined || s.activo === 'true').length;
        const inactivos = window.MIS_SENSORES.filter(s => s.activo === false || s.activo === 'false').length;
        const elOnline = document.getElementById('reporte-online');
        const elOffline = document.getElementById('reporte-offline');
        if (elOnline) elOnline.textContent = activos;
        if (elOffline) elOffline.textContent = inactivos;
    }
}

function filtrarLogs(tipoFiltro) {
const botones = document.querySelectorAll('.filtro-btn');botones.forEach(btn => btn.classList.remove('activo'));const botonActivo = Array.from(botones).find(btn => btn.getAttribute('onclick').includes(`'${tipoFiltro}'`));if (botonActivo) botonActivo.classList.add('activo');
const lineas = document.querySelectorAll('.log-linea');lineas.forEach(linea => {
if (tipoFiltro === 'todos') {
    linea.style.display = 'block';
} else {
    const tipoLinea = linea.getAttribute('data-tipo');
    linea.style.display = (tipoLinea === tipoFiltro) ? 'block' : 'none';
 }
});
}

function limpiarLogs() {
    const contenedor = document.getElementById('contenedor-consola-logs');
    if (contenedor) contenedor.innerHTML = '';
}

document.addEventListener('DOMContentLoaded', () => {
    window.REPETIDORAS_SASMEX = generarRepetidorasSasmex();
    solicitarPermisoNotificaciones();
    iniciarReloj();
    monitoreoServicio();
    
    const loginEl = document.getElementById('login-screen');
    const app = document.getElementById('app-content');
    if (loginEl) loginEl.style.display = 'none';
    if (app) app.style.display = 'block';
    
    const s = document.createElement('script');
    s.src = "js/sensores.js?v=" + Date.now();
    s.onload = () => {
        verificarTerminos();
        mostrarConteoSimulacroNacional(); 
    };
    document.head.appendChild(s);
});