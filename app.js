// ====================================================================
// SUPABASE INIT
// ====================================================================
const SUPABASE_URL = 'https://hpmwspsdybenuumlwwbv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbXdzcHNkeWJlbnV1bWx3d2J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MTA0MzEsImV4cCI6MjA5NjI4NjQzMX0.BGGr-pURxIIha0bAZ92cyMbZ-BeoCsMdVm4QPJbY_uE';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====================================================================
// DATA LAYER - SUPABASE
// ====================================================================

async function getInventario() {
    const { data, error } = await _supabase
        .from('inventario')
        .select('*')
        .order('id', { ascending: false });
    if (error) { console.error(error); return []; }
    return data || [];
}

async function getVentas() {
    const { data, error } = await _supabase
        .from('ventas')
        .select('*')
        .order('id', { ascending: false });
    if (error) { console.error(error); return []; }
    return data || [];
}

async function getCierres() {
    const { data, error } = await _supabase
        .from('cierres')
        .select('*')
        .order('id', { ascending: false });
    if (error) { console.error(error); return []; }
    return data || [];
}

let carrito = [];
let metodoPagoSeleccionado = "";

// ====================================================================
// AUTENTICACIÓN
// ====================================================================

async function verificarSesion() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return false;
    }
    document.getElementById('user-email').textContent = session.user.email;
    return true;
}

async function cerrarSesion() {
    await _supabase.auth.signOut();
    window.location.href = 'login.html';
}

// ====================================================================
// INICIALIZADOR Y EVENTOS
// ====================================================================

document.addEventListener("DOMContentLoaded", async () => {
    const ok = await verificarSesion();
    if (!ok) return;
    cambiarPestana("ventas");

    const buscador = document.getElementById("busca-codigo");
    if (buscador) {
        buscador.addEventListener("input", (e) => {
            mostrarSugerenciasEnTiempoReal(e.target.value);
        });

        buscador.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                buscarYAgregarProducto();
            }
        });
    }

    document.addEventListener("click", (e) => {
        const contenedor = document.getElementById("sugerencias-contenedor");
        if (contenedor && e.target.id !== "busca-codigo") {
            contenedor.classList.add("hidden");
        }
    });
});

// ====================================================================
// MENU DE PESTAÑAS
// ====================================================================

async function cambiarPestana(pestana) {
    document.getElementById("sec-dashboard").classList.add("hidden");
    document.getElementById("sec-inventario").classList.add("hidden");
    document.getElementById("sec-ventas").classList.add("hidden");

    if (pestana === "dashboard") {
        document.getElementById("sec-dashboard").classList.remove("hidden");
        await actualizarDashboard();
    } else if (pestana === "inventario") {
        document.getElementById("sec-inventario").classList.remove("hidden");
        await cargarInventario();
    } else if (pestana === "ventas") {
        document.getElementById("sec-ventas").classList.remove("hidden");
        await cargarVentas();
    }
}

// ====================================================================
// CONTROL DE DASHBOARD
// ====================================================================

async function actualizarDashboard() {
    const ventas = await getVentas();
    const inventario = await getInventario();

    let totalIngresos = 0;
    let totalGanancias = 0;

    ventas.forEach(v => {
        totalIngresos += parseFloat(v.total) || 0;
        totalGanancias += parseFloat(v.ganancia_total) || 0;
    });

    const stockBajo = inventario.filter(p => parseInt(p.stock) <= parseInt(p.minimo || 5)).length;

    const hoy = new Date();
    const dentroDe30Dias = new Date();
    dentroDe30Dias.setDate(hoy.getDate() + 30);

    const proximosVencer = inventario.filter(p => {
        if (!p.fecha_vencimiento) return false;
        const f = new Date(p.fecha_vencimiento + "T23:59:59");
        return f >= hoy && f <= dentroDe30Dias;
    }).length;

    const vencidos = inventario.filter(p => {
        if (!p.fecha_vencimiento) return false;
        const f = new Date(p.fecha_vencimiento + "T23:59:59");
        return f < hoy;
    }).length;

    document.getElementById("dash-ventas").innerText = ventas.length;
    document.getElementById("dash-ingresos").innerText = `S/ ${totalIngresos.toFixed(2)}`;
    document.getElementById("dash-ganancias").innerText = `S/ ${totalGanancias.toFixed(2)}`;
    document.getElementById("dash-stock").innerText = stockBajo;
    document.getElementById("dash-vencimiento").innerText = proximosVencer + vencidos;

    await renderizarHistorialCierres();
}

async function renderizarHistorialCierres() {
    const cierres = await getCierres();
    const tabla = document.getElementById("tabla-cierres-archivo");
    tabla.innerHTML = "";

    if (cierres.length === 0) {
        tabla.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 italic">No hay registros de cierres anteriores.</td></tr>`;
        return;
    }

    cierres.forEach((c, idx) => {
        const f = new Date(c.created_at);
        const fechaStr = `${f.toLocaleDateString()} ${f.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        const ganancia = parseFloat(c.ganancia_total) || 0;
        const productos = c.productos_resumen || [];

        const tr = document.createElement("tr");
        tr.className = "hover:bg-gray-50 border-b border-gray-100";

        let botonDetalle = "";
        if (productos.length > 0) {
            botonDetalle = `<button onclick="toggleDetalleCierre('${c.id}')" id="btn-cierre-${c.id}" class="text-xs text-blue-600 hover:text-blue-800 font-bold cursor-pointer flex items-center gap-1 whitespace-nowrap">Ver vendidos ▼</button>`;
        } else {
            botonDetalle = `<span class="text-xs text-gray-300 italic">sin detalle</span>`;
        }

        tr.innerHTML = `
            <td class="p-3 text-gray-700 font-medium">${fechaStr}</td>
            <td class="p-3 text-gray-500">${c.cantidad_ventas} operaciones</td>
            <td class="p-3 font-bold text-blue-600">S/ ${parseFloat(c.ingreso_total).toFixed(2)}</td>
            <td class="p-3 font-bold text-green-600">S/ ${ganancia.toFixed(2)}</td>
            <td class="p-3">${botonDetalle}</td>
            <td class="p-3 text-right">
                <button onclick="eliminarCierre('${c.id}')" title="Eliminar este cierre" class="text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition text-xs font-bold cursor-pointer">🗑 Eliminar</button>
            </td>
        `;
        tabla.appendChild(tr);

        if (productos.length > 0) {
            const trDetalle = document.createElement("tr");
            trDetalle.id = `detalle-cierre-${c.id}`;
            trDetalle.className = "hidden bg-blue-50";

            const listaHtml = productos.map(p =>
                `<span class="inline-flex items-center bg-white border border-blue-100 text-gray-700 text-xs rounded-lg px-2.5 py-1 font-medium shadow-sm">
                    💊 ${p.nombre} <span class="ml-1.5 bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-full">×${p.qty}</span>
                </span>`
            ).join("");

            trDetalle.innerHTML = `
                <td colspan="5" class="px-4 py-3">
                    <p class="text-xs font-bold text-gray-500 uppercase mb-2">📋 Productos vendidos ese día:</p>
                    <div class="flex flex-wrap gap-2">${listaHtml}</div>
                </td>
            `;
            tabla.appendChild(trDetalle);
        }
    });
}

function toggleDetalleCierre(id) {
    const fila = document.getElementById(`detalle-cierre-${id}`);
    const btn = document.getElementById(`btn-cierre-${id}`);
    if (!fila) return;
    const estaOculto = fila.classList.contains("hidden");
    fila.classList.toggle("hidden");
    btn.innerHTML = estaOculto ? "Ocultar ▲" : "Ver vendidos ▼";
}

async function eliminarCierre(id) {
    const cierres = await getCierres();
    const c = cierres.find(c => c.id == id);
    if (!c) return;

    const f = new Date(c.created_at);
    const fechaStr = `${f.toLocaleDateString()} ${f.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;

    const confirmado = confirm(
        `⚠️ ¿Estás seguro de que deseas eliminar este registro de cierre?\n\n` +
        `📅 Fecha: ${fechaStr}\n` +
        `💰 Total recaudado: S/ ${parseFloat(c.ingreso_total).toFixed(2)}\n` +
        `📈 Ganancia neta: S/ ${(parseFloat(c.ganancia_total) || 0).toFixed(2)}\n\n` +
        `Esta acción no se puede deshacer.`
    );

    if (!confirmado) return;

    const { error } = await _supabase.from('cierres').delete().eq('id', id);
    if (error) { alert("Error al eliminar cierre"); return; }

    await renderizarHistorialCierres();
}

// ====================================================================
// CONTROL DE INVENTARIO
// ====================================================================

async function irAInventarioFiltrado() {
    await cambiarPestana('inventario');
    await cargarInventario(true, false);
}

async function irAInventarioVencimiento() {
    await cambiarPestana('inventario');
    await cargarInventario(false, true);
}

async function cargarInventario(soloStockBajo = false, soloVencidos = false) {
    const inventario = await getInventario();
    const tabla = document.getElementById("tabla-inventario");
    const badgeFiltro = document.getElementById("badge-filtro-stock");
    const badgeVenc = document.getElementById("badge-vencimiento");
    tabla.innerHTML = "";

    if (soloStockBajo) {
        badgeFiltro.classList.remove("hidden");
    } else {
        badgeFiltro.classList.add("hidden");
    }

    if (soloVencidos) {
        badgeVenc.classList.remove("hidden");
    } else {
        badgeVenc.classList.add("hidden");
    }

    const hoy = new Date();
    const dentroDe30Dias = new Date();
    dentroDe30Dias.setDate(hoy.getDate() + 30);

    function esProximoAVencer(fechaStr) {
        if (!fechaStr) return false;
        const f = new Date(fechaStr + "T23:59:59");
        return f > hoy && f <= dentroDe30Dias;
    }

    function estaVencido(fechaStr) {
        if (!fechaStr) return false;
        const f = new Date(fechaStr + "T23:59:59");
        return f < hoy;
    }

    let productosAMostrar = inventario;

    if (soloStockBajo) {
        productosAMostrar = productosAMostrar.filter(p => parseInt(p.stock) <= parseInt(p.minimo || 5));
    } else if (soloVencidos) {
        productosAMostrar = productosAMostrar.filter(p => esProximoAVencer(p.fecha_vencimiento) || estaVencido(p.fecha_vencimiento));
    }

    if (productosAMostrar.length === 0) {
        const msg = soloStockBajo ? '🎉 ¡Excelente! Ningún medicamento está en stock crítico.' :
                    soloVencidos ? '🎉 No hay medicamentos próximos a vencer.' :
                    'No hay medicamentos en almacén.';
        tabla.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-gray-400 italic">${msg}</td></tr>`;
        return;
    }

    productosAMostrar.forEach((p) => {
        const gananciaUnitaria = parseFloat(p.precio) - parseFloat(p.precio_compra || 0);
        const esCritico = parseInt(p.stock) <= parseInt(p.minimo || 5);
        const stockStatusClass = esCritico ? "bg-red-100 text-red-700 font-bold" : "text-gray-600";

        const vencido = estaVencido(p.fecha_vencimiento);
        const proxVencer = esProximoAVencer(p.fecha_vencimiento);

        let fechaClass = "text-gray-500";
        let fechaIcono = "";
        if (vencido) {
            fechaClass = "text-red-600 font-bold";
            fechaIcono = "🚫 ";
        } else if (proxVencer) {
            fechaClass = "text-orange-600 font-bold";
            fechaIcono = "⏳ ";
        }

        const fechaDisplay = p.fecha_vencimiento
            ? `${fechaIcono}${new Date(p.fecha_vencimiento + "T23:59:59").toLocaleDateString()}`
            : "<span class='text-gray-300 italic'>---</span>";

        const tr = document.createElement("tr");
        tr.className = "hover:bg-gray-50 border-b border-gray-100";
        tr.innerHTML = `
            <td class="p-3 font-mono text-xs text-gray-500">${p.codigo_barras}</td>
            <td class="p-3 font-semibold text-gray-800">${p.nombre}<br><span class="text-xs text-gray-400 font-normal">${p.principio_activo || 'N/A'}</span></td>
            <td class="p-3 text-gray-500">${p.laboratorio || 'N/A'}</td>
            <td class="p-3"><span class="px-2.5 py-1 rounded-md text-xs ${stockStatusClass}" title="Stock Mínimo: ${p.minimo || 5}">${p.stock} u.</span></td>
            <td class="p-3 text-xs ${fechaClass}">${fechaDisplay}</td>
            <td class="p-3 text-gray-500">S/ ${parseFloat(p.precio_compra || 0).toFixed(2)}</td>
            <td class="p-3 font-medium text-gray-900">S/ ${parseFloat(p.precio).toFixed(2)}</td>
            <td class="p-3 text-green-600 font-medium">S/ ${gananciaUnitaria.toFixed(2)}</td>

            <td class="p-3 text-right flex gap-3 justify-end items-center h-full mt-1">
                <button onclick="ajustarStockInmediato(${p.id})" class="text-emerald-600 hover:text-emerald-800 font-bold cursor-pointer text-xs" title="Carga o descarga rápida de stock">
                    📦 Stock
                </button>
                <button onclick="abrirModalEditar(${p.id})" class="text-blue-600 hover:text-blue-800 font-bold cursor-pointer text-xs">
                    Editar
                </button>
                <button onclick="eliminarProducto(${p.id})" class="text-red-500 hover:text-red-700 font-bold cursor-pointer text-xs">
                    Eliminar
                </button>
            </td>
        `;
        tabla.appendChild(tr);
    });
}

async function ejecutarAjusteManual(id, operacion) {
    const inventario = await getInventario();
    const producto = inventario.find(p => p.id == id);
    const inputCantidad = document.getElementById(`input-ajuste-${id}`);

    if (!producto) return;

    const cantidadAjuste = parseInt(inputCantidad.value);

    if (isNaN(cantidadAjuste) || cantidadAjuste <= 0) {
        alert("⚠️ Por favor, ingresa una cantidad válida mayor a 0 en el casillero.");
        return;
    }

    let nuevoStock = parseInt(producto.stock);

    if (operacion === 'sumar') {
        nuevoStock += cantidadAjuste;
    } else if (operacion === 'restar') {
        nuevoStock -= cantidadAjuste;
        if (nuevoStock < 0) {
            alert(`❌ Error: No puedes retirar ${cantidadAjuste} unidades. El stock actual de "${producto.nombre}" es de solo ${producto.stock} unidades.`);
            return;
        }
    }

    const { error } = await _supabase.from('inventario').update({ stock: nuevoStock }).eq('id', id);
    if (error) { alert("Error al actualizar stock"); return; }

    const badgeFiltro = document.getElementById("badge-filtro-stock");
    const badgeVenc = document.getElementById("badge-vencimiento");
    const estaFiltrado = !badgeFiltro.classList.contains("hidden");
    const estaFiltradoVenc = !badgeVenc.classList.contains("hidden");

    await cargarInventario(estaFiltrado, estaFiltradoVenc);
}

async function ajustarStockRapido(id, cantidad) {
    const inventario = await getInventario();
    const producto = inventario.find(p => p.id == id);

    if (!producto) return;

    const nuevoStock = parseInt(producto.stock) + cantidad;

    if (nuevoStock < 0) {
        alert(`❌ Operación inválida. No puedes reducir el stock de "${producto.nombre}" a menos de 0 unidades (Stock actual: ${producto.stock}).`);
        return;
    }

    const { error } = await _supabase.from('inventario').update({ stock: nuevoStock }).eq('id', id);
    if (error) { alert("Error al actualizar stock"); return; }

    const badgeFiltro = document.getElementById("badge-filtro-stock");
    const badgeVenc = document.getElementById("badge-vencimiento");
    const estaFiltrado = !badgeFiltro.classList.contains("hidden");
    const estaFiltradoVenc = !badgeVenc.classList.contains("hidden");

    await cargarInventario(estaFiltrado, estaFiltradoVenc);
}

// CONTROL DE MODAL DE EDICIÓN
async function abrirModalEditar(id) {
    const inventario = await getInventario();
    const p = inventario.find(prod => prod.id == id);
    if (!p) return;

    document.getElementById("edit-index").value = id;
    document.getElementById("edit-nombre").value = p.nombre;
    document.getElementById("edit-codigo").value = p.codigo_barras;
    document.getElementById("edit-principio").value = p.principio_activo || "";
    document.getElementById("edit-laboratorio").value = p.laboratorio || "";
    document.getElementById("edit-stock").value = p.stock;
    document.getElementById("edit-minimo").value = p.minimo || 5;
    document.getElementById("edit-precio-compra").value = parseFloat(p.precio_compra || 0).toFixed(2);
    document.getElementById("edit-precio").value = parseFloat(p.precio).toFixed(2);
    document.getElementById("edit-fecha-vencimiento").value = p.fecha_vencimiento || "";

    document.getElementById("modal-editar-producto").classList.remove("hidden");
}

function cerrarModalEditar() {
    document.getElementById("modal-editar-producto").classList.add("hidden");
}

async function guardarEdicionProducto() {
    const id = document.getElementById("edit-index").value;
    const nombre = document.getElementById("edit-nombre").value.trim();
    const codigo = document.getElementById("edit-codigo").value.trim();
    const principio = document.getElementById("edit-principio").value.trim();
    const laboratorio = document.getElementById("edit-laboratorio").value.trim();
    const stock = parseInt(document.getElementById("edit-stock").value) || 0;
    const minimo = parseInt(document.getElementById("edit-minimo").value) || 5;
    const precioCompra = parseFloat(document.getElementById("edit-precio-compra").value) || 0;
    const precio = parseFloat(document.getElementById("edit-precio").value) || 0;
    const fechaVenc = document.getElementById("edit-fecha-vencimiento").value || "";

    if (!nombre || !codigo) {
        alert("El nombre y código son obligatorios.");
        return;
    }

    const inventario = await getInventario();
    if (inventario.some(p => p.codigo_barras === codigo && p.id != id)) {
        alert("Ese código de barras ya pertenece a otro medicamento registrado.");
        return;
    }

    const { error } = await _supabase.from('inventario').update({
        nombre, codigo_barras: codigo, principio_activo: principio, laboratorio,
        stock, minimo, precio_compra: precioCompra, precio, fecha_vencimiento: fechaVenc
    }).eq('id', id);

    if (error) { alert("Error al actualizar medicamento"); return; }

    cerrarModalEditar();
    await cargarInventario();
    alert("🔄 Datos del medicamento actualizados con éxito.");
}

function abrirModal() { document.getElementById("modal-producto").classList.remove("hidden"); }
function cerrarModal() { document.getElementById("modal-producto").classList.add("hidden"); }

async function guardarProducto() {
    const nombre = document.getElementById("inv-nombre").value.trim();
    const codigo = document.getElementById("inv-codigo").value.trim();
    const principio = document.getElementById("inv-principio").value.trim();
    const laboratorio = document.getElementById("inv-laboratorio").value.trim();
    const stock = parseInt(document.getElementById("inv-stock").value) || 0;
    const minimo = parseInt(document.getElementById("inv-minimo").value) || 5;
    const precioCompra = parseFloat(document.getElementById("inv-precio-compra").value) || 0;
    const precio = parseFloat(document.getElementById("inv-precio").value) || 0;
    const fechaVenc = document.getElementById("inv-fecha-vencimiento").value || null;

    if (!nombre || !codigo) {
        alert("Por favor rellene los campos obligatorios (*)");
        return;
    }

    const inventario = await getInventario();
    if (inventario.some(p => p.codigo_barras === codigo)) {
        alert("Ese código de barras/lote ya existe.");
        return;
    }

    const { error } = await _supabase.from('inventario').insert({
        nombre, codigo_barras: codigo, principio_activo: principio, laboratorio,
        stock, minimo, precio_compra: precioCompra, precio, fecha_vencimiento: fechaVenc
    });

    if (error) { alert("Error al guardar: " + error.message); return; }

    cerrarModal();
    await cargarInventario();

    document.getElementById("inv-nombre").value = "";
    document.getElementById("inv-codigo").value = "";
    document.getElementById("inv-principio").value = "";
    document.getElementById("inv-laboratorio").value = "";
    document.getElementById("inv-stock").value = "0";
    document.getElementById("inv-minimo").value = "5";
    document.getElementById("inv-precio-compra").value = "0.00";
    document.getElementById("inv-precio").value = "0.00";
    document.getElementById("inv-fecha-vencimiento").value = "";
}

async function eliminarProducto(id) {
    if (confirm("¿Seguro que desea eliminar este medicamento?")) {
        const { error } = await _supabase.from('inventario').delete().eq('id', id);
        if (error) { alert("Error al eliminar"); return; }
        await cargarInventario();
    }
}

// ====================================================================
// MODULO SUGERENCIAS FLOTANTES (TIEMPO REAL)
// ====================================================================

async function mostrarSugerenciasEnTiempoReal(busqueda) {
    const contenedor = document.getElementById("sugerencias-contenedor");
    const texto = busqueda.trim().toLowerCase();

    if (!texto || texto.length < 2) {
        contenedor.innerHTML = "";
        contenedor.classList.add("hidden");
        return;
    }

    const inventario = await getInventario();
    const coincidencias = inventario.filter(p =>
        p.nombre.toLowerCase().includes(texto) ||
        p.codigo_barras.toLowerCase().includes(texto) ||
        (p.principio_activo && p.principio_activo.toLowerCase().includes(texto))
    );

    if (coincidencias.length === 0) {
        contenedor.innerHTML = `<div class="p-4 text-sm text-gray-400 italic">No se encontraron resultados</div>`;
        contenedor.classList.remove("hidden");
        return;
    }

    contenedor.innerHTML = "";
    coincidencias.forEach(p => {
        const div = document.createElement("div");
        div.className = "sugerencia-item";

        const stockColor = p.stock <= 0 ? 'bg-red-100 text-red-700' : (p.stock <= p.minimo ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600');
        const stockTexto = p.stock <= 0 ? 'Sin Stock' : `Stock: ${p.stock}`;

        div.innerHTML = `
            <div>
                <div class="font-bold text-gray-800 text-sm">${p.nombre}</div>
                <div class="text-xs text-gray-400">${p.principio_activo || 'Sin genérico'} • <span class="italic">${p.laboratorio || 'Lab. N/A'}</span></div>
            </div>
            <div class="text-right flex items-center gap-2">
                <span class="text-xs px-2 py-0.5 rounded-full font-medium ${stockColor}">${stockTexto}</span>
                <span class="font-bold text-emerald-600 text-sm">S/ ${parseFloat(p.precio).toFixed(2)}</span>
            </div>
        `;

        div.onclick = () => {
            inyectarProductoAlCarrito(p);
            contenedor.classList.add("hidden");
        };
        contenedor.appendChild(div);
    });
    contenedor.classList.remove("hidden");
}

// ====================================================================
// MODULO DE VENTAS Y CARRITO
// ====================================================================

async function cargarVentas() {
    actualizarVistaCarrito();
    await renderizarHistorialVentas();
}

async function buscarYAgregarProducto() {
    const input = document.getElementById("busca-codigo");
    const busqueda = input.value.trim().toLowerCase();
    if (!busqueda) return;

    const inventario = await getInventario();
    const producto = inventario.find(p => p.codigo_barras.toLowerCase() === busqueda || p.nombre.toLowerCase() === busqueda);

    if (producto) {
        inyectarProductoAlCarrito(producto);
    } else {
        alert("❌ Código o nombre exacto no encontrado. Use las sugerencias desplegables.");
    }
}

async function inyectarProductoAlCarrito(producto) {
    const input = document.getElementById("busca-codigo");
    const inventario = await getInventario();
    const prodActual = inventario.find(p => p.codigo_barras === producto.codigo_barras);

    if (!prodActual || prodActual.stock <= 0) {
        alert(`⚠️ El producto "${producto.nombre}" no cuenta con stock disponible.`);
        if (producto.principio_activo) {
            buscarAlternativasPorPrincipio(producto.principio_activo, producto.nombre, inventario);
        }
        return;
    }

    const existente = carrito.find(i => i.codigo_barras === producto.codigo_barras);
    const cantidadEnCarrito = existente ? existente.qty : 0;

    if (prodActual.stock <= cantidadEnCarrito) {
        alert(`⚠️ No puedes agregar más unidades de "${producto.nombre}". Se alcanzó el límite del stock.`);
        if (producto.principio_activo) {
            buscarAlternativasPorPrincipio(producto.principio_activo, producto.nombre, inventario);
        }
        return;
    }

    if (existente) {
        existente.qty++;
    } else {
        carrito.push({ ...producto, qty: 1 });
    }

    actualizarVistaCarrito();
    input.value = "";
    input.focus();
}

function buscarAlternativasPorPrincipio(principioActivo, nombreProducto, inventario) {
    if (!principioActivo) {
        alert("Este medicamento no registra un principio activo asociado para buscar similares.");
        return;
    }

    const sugerencias = inventario.filter(p =>
        p.principio_activo &&
        p.principio_activo.toLowerCase() === principioActivo.toLowerCase() &&
        p.nombre.toLowerCase() !== nombreProducto.toLowerCase() &&
        p.stock > 0
    );

    if (sugerencias.length > 0) {
        let mensajeSugerido = `💊 Alternativas disponibles en almacén con el mismo principio activo (${principioActivo}):\n\n`;
        sugerencias.forEach(s => {
            mensajeSugerido += `• [Código: ${s.codigo_barras}] ${s.nombre} (${s.laboratorio || 'N/A'}) - Stock: ${s.stock} - S/ ${parseFloat(s.precio).toFixed(2)}\n`;
        });
        alert(mensajeSugerido);
    } else {
        alert(`No se encontraron sustitutos comerciales disponibles con el principio activo: ${principioActivo}`);
    }
}

function actualizarVistaCarrito() {
    const lista = document.getElementById("lista-carrito");
    const totalVenta = document.getElementById("total-venta");
    const contadorItems = document.getElementById("contador-items");

    lista.innerHTML = "";
    let total = 0;
    let itemsContador = 0;

    if (carrito.length === 0) {
        lista.innerHTML = `<li class="py-4 text-center text-gray-400 text-sm italic">El carrito está vacío.</li>`;
        totalVenta.innerText = "0.00";
        contadorItems.innerText = "0 items";
        return;
    }

    carrito.forEach((item, index) => {
        const subtotal = parseFloat(item.precio) * item.qty;
        total += subtotal;
        itemsContador += item.qty;

        const li = document.createElement("li");
        li.className = "py-3 flex justify-between items-center border-b border-gray-100 last:border-none";
        li.innerHTML = `
            <div class="max-w-[60%]">
                <span class="font-bold text-gray-800 text-sm">${item.nombre}</span>
                <p class="text-xs text-gray-400 font-mono">${item.codigo_barras}</p>
            </div>
            <div class="flex items-center gap-3">
                <div class="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                    <button onclick="cambiarCantidadCarrito(${index}, -1)" class="px-2.5 py-1 font-bold text-gray-500 hover:bg-gray-200 cursor-pointer">-</button>
                    <span class="px-3 font-bold text-sm text-gray-700">${item.qty}</span>
                    <button onclick="cambiarCantidadCarrito(${index}, 1)" class="px-2.5 py-1 font-bold text-gray-500 hover:bg-gray-200 cursor-pointer">+</button>
                </div>
                <span class="font-bold text-gray-900 text-sm w-20 text-right">S/ ${subtotal.toFixed(2)}</span>
                <button onclick="removerDelCarrito(${index})" class="text-xs text-red-400 hover:text-red-600 ml-2 cursor-pointer font-medium">✕</button>
            </div>
        `;
        lista.appendChild(li);
    });

    totalVenta.innerText = total.toFixed(2);
    contadorItems.innerText = `${itemsContador} item${itemsContador !== 1 ? 's' : ''}`;
}

async function cambiarCantidadCarrito(index, cambio) {
    const item = carrito[index];
    const inventario = await getInventario();
    const productoOriginal = inventario.find(p => p.codigo_barras === item.codigo_barras);

    if (cambio > 0 && productoOriginal && productoOriginal.stock <= item.qty) {
        alert("No hay más stock disponible de este producto en el almacén.");
        return;
    }

    item.qty += cambio;
    if (item.qty <= 0) carrito.splice(index, 1);
    actualizarVistaCarrito();
}

function removerDelCarrito(index) {
    carrito.splice(index, 1);
    actualizarVistaCarrito();
}

// ====================================================================
// GESTIÓN DE MODAL DE PAGOS
// ====================================================================

function abrirModalPago() {
    if (carrito.length === 0) {
        alert("El carrito se encuentra vacío.");
        return;
    }
    const total = document.getElementById("total-venta").innerText;
    document.getElementById("modal-pago-total").innerText = total;

    metodoPagoSeleccionado = "";
    document.getElementById("pago-cliente").value = "";
    document.getElementById("vuelto-resultado").innerText = "0.00";
    document.getElementById("contenedor-vuelto").classList.add("hidden");

    document.querySelectorAll(".metodo-btn").forEach(btn => btn.classList.remove("selected"));
    document.getElementById("modal-pago").classList.remove("hidden");
}

function seleccionarMetodoPago(metodo) {
    metodoPagoSeleccionado = metodo;
    document.querySelectorAll(".metodo-btn").forEach(btn => btn.classList.remove("selected"));

    const contenedorVuelto = document.getElementById("contenedor-vuelto");
    const inputPago = document.getElementById("pago-cliente");

    inputPago.value = "";
    document.getElementById("vuelto-resultado").innerText = "0.00";

    if (metodo === "Efectivo") {
        document.getElementById("btn-pago-efectivo").classList.add("selected");
        contenedorVuelto.classList.remove("hidden");
        inputPago.focus();
    } else {
        if (metodo === "Yape") document.getElementById("btn-pago-yape").classList.add("selected");
        if (metodo === "Plin") document.getElementById("btn-pago-plin").classList.add("selected");
        contenedorVuelto.classList.add("hidden");
    }
}

function calcularVueltoEnTiempoReal() {
    const totalVenta = parseFloat(document.getElementById("modal-pago-total").innerText) || 0;
    const pagoCliente = parseFloat(document.getElementById("pago-cliente").value) || 0;
    const vueltoResultado = document.getElementById("vuelto-resultado");

    if (pagoCliente >= totalVenta) {
        const vuelto = pagoCliente - totalVenta;
        vueltoResultado.innerText = vuelto.toFixed(2);
        vueltoResultado.parentElement.classList.remove("text-red-500");
        vueltoResultado.parentElement.classList.add("text-amber-600");
    } else {
        vueltoResultado.innerText = "0.00";
    }
}

// ====================================================================
// REGISTRO, ELIMINACIÓN Y CIERRE DE CAJA
// ====================================================================

async function renderizarHistorialVentas() {
    const ventas = await getVentas();
    const tabla = document.getElementById("tabla-ventas");
    tabla.innerHTML = "";

    if (ventas.length === 0) {
        tabla.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 italic">No hay ventas registradas en este turno.</td></tr>`;
        return;
    }

    ventas.forEach(v => {
        const f = new Date(v.created_at);
        const horaStr = f.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        let badgeColor = "bg-gray-100 text-gray-600";
        if (v.metodo === "Yape") badgeColor = "bg-purple-100 text-purple-700 font-bold";
        if (v.metodo === "Plin") badgeColor = "bg-cyan-100 text-cyan-700 font-bold";
        if (v.metodo === "Efectivo") badgeColor = "bg-green-100 text-green-700 font-bold";

        const esLarga = v.productos_texto && v.productos_texto.length > 45;
        let celdaProductosHtml = "";

        if (esLarga) {
            celdaProductosHtml = `
                <div class="max-w-xs text-gray-700">
                    <span id="txt-corto-${v.id}" class="font-medium text-sm">${v.productos_texto.substring(0, 42)}...</span>
                    <span id="txt-largo-${v.id}" class="hidden font-medium text-sm break-words">${v.productos_texto}</span>
                    <button onclick="alternarDesplegableProductos(${v.id})" id="btn-toggle-${v.id}" class="text-blue-600 hover:text-blue-800 font-bold text-xs ml-1 focus:outline-none inline-flex items-center gap-0.5 cursor-pointer">
                        ver más ▼
                    </button>
                </div>
            `;
        } else {
            celdaProductosHtml = `<div class="font-medium text-gray-700 text-sm max-w-xs">${v.productos_texto}</div>`;
        }

        const tr = document.createElement("tr");
        tr.className = "hover:bg-gray-50 border-b border-gray-100";
        tr.innerHTML = `
            <td class="p-3 text-gray-500 text-xs font-mono">${horaStr}</td>
            <td class="p-3">${celdaProductosHtml}</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded text-xs ${badgeColor}">${v.metodo}</span></td>
            <td class="p-3 font-bold text-gray-900">S/ ${parseFloat(v.total).toFixed(2)}</td>
            <td class="p-3 text-right">
                <button onclick="eliminarVentaEspecifica(${v.id})" class="text-red-500 hover:text-red-700 font-bold cursor-pointer text-xs bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md transition">
                    Eliminar
                </button>
            </td>
        `;
        tabla.appendChild(tr);
    });
}

function alternarDesplegableProductos(id) {
    const corto = document.getElementById(`txt-corto-${id}`);
    const largo = document.getElementById(`txt-largo-${id}`);
    const btn = document.getElementById(`btn-toggle-${id}`);

    if (largo.classList.contains("hidden")) {
        largo.classList.remove("hidden");
        corto.classList.add("hidden");
        btn.innerHTML = "ocultar ▲";
    } else {
        largo.classList.add("hidden");
        corto.classList.remove("hidden");
        btn.innerHTML = "ver más ▼";
    }
}

async function eliminarVentaEspecifica(ventaId) {
    if (!confirm("⚠️ ¿Estás seguro de que deseas eliminar esta venta? El stock devuelto regresará al almacén automáticamente.")) return;

    const ventas = await getVentas();
    const inventario = await getInventario();

    const ventaEncontrada = ventas.find(v => v.id === ventaId);
    if (!ventaEncontrada) return;

    for (const item of (ventaEncontrada.productos_lista || [])) {
        const prod = inventario.find(p => p.codigo_barras === item.codigo_barras);
        if (prod) {
            await _supabase.from('inventario').update({ stock: prod.stock + item.qty }).eq('id', prod.id);
        }
    }

    const { error } = await _supabase.from('ventas').delete().eq('id', ventaId);
    if (error) { alert("Error al eliminar venta"); return; }

    alert("🔄 Venta anulada. El stock ha sido restablecido con éxito.");
    await renderizarHistorialVentas();
}

async function ejecutarCierreCaja() {
    const ventas = await getVentas();
    if (ventas.length === 0) {
        alert("No puedes realizar el cierre de caja porque no hay operaciones registradas en este turno.");
        return;
    }

    let totalRecaudado = 0;
    let totalGanancia = 0;
    let conteoMetodos = { Efectivo: 0, Yape: 0, Plin: 0 };
    const productosAcumulados = {};

    ventas.forEach(v => {
        totalRecaudado += parseFloat(v.total) || 0;
        totalGanancia += parseFloat(v.ganancia_total) || 0;
        if (conteoMetodos[v.metodo] !== undefined) {
            conteoMetodos[v.metodo] += parseFloat(v.total) || 0;
        }
        if (v.productos_lista && Array.isArray(v.productos_lista)) {
            v.productos_lista.forEach(p => {
                if (productosAcumulados[p.codigo_barras]) {
                    productosAcumulados[p.codigo_barras].qty += p.qty;
                } else {
                    productosAcumulados[p.codigo_barras] = { nombre: p.nombre, qty: p.qty };
                }
            });
        }
    });

    const mensajeCierre = `🔒 ¿CONFIRMAR CIERRE DE CAJA?\n\n` +
                          `• Operaciones totales: ${ventas.length}\n` +
                          `• Total Recaudado: S/ ${totalRecaudado.toFixed(2)}\n` +
                          `• Ganancias Turno: S/ ${totalGanancia.toFixed(2)}\n\n` +
                          ` DESGLOSE POR MÉTODOS:\n` +
                          ` 💵 Efectivo: S/ ${conteoMetodos.Efectivo.toFixed(2)}\n` +
                          ` 📲 Yape: S/ ${conteoMetodos.Yape.toFixed(2)}\n` +
                          ` 🔷 Plin: S/ ${conteoMetodos.Plin.toFixed(2)}\n\n` +
                          `Al confirmar, se guardará el reporte comprimido y la caja volverá a S/ 0.00.`;

    if (!confirm(mensajeCierre)) return;

    const nuevoReporteCierre = {
        cantidad_ventas: ventas.length,
        ingreso_total: totalRecaudado.toFixed(2),
        ganancia_total: totalGanancia.toFixed(2),
        productos_resumen: Object.values(productosAcumulados)
    };

    const { error: errInsert } = await _supabase.from('cierres').insert(nuevoReporteCierre);
    if (errInsert) { alert("Error al guardar cierre"); return; }

    const { error: errDelete } = await _supabase.from('ventas').delete().neq('id', 0);
    if (errDelete) { alert("Error al limpiar ventas"); return; }

    alert("📦 ¡Caja cerrada exitosamente! Datos archivados.");
    await cambiarPestana('dashboard');
}

function cerrarModalPago() {
    document.getElementById("modal-pago").classList.add("hidden");
}

async function procesarVentaConPago() {
    if (!metodoPagoSeleccionado) {
        alert("Por favor, selecciona un método de pago para continuar.");
        return;
    }

    const inventario = await getInventario();

    let totalVenta = 0;
    let gananciaTotalVenta = 0;
    let productosDetalle = [];

    for (let item of carrito) {
        const prod = inventario.find(p => p.codigo_barras === item.codigo_barras);
        if (!prod || prod.stock < item.qty) {
            alert(`Error crítico: El producto ${item.nombre} ya no cuenta con stock suficiente.`);
            return;
        }

        const nuevoStock = prod.stock - item.qty;
        const { error } = await _supabase.from('inventario').update({ stock: nuevoStock }).eq('id', prod.id);
        if (error) { alert("Error al actualizar stock"); return; }

        const subtotal = parseFloat(item.precio) * item.qty;
        const costoCompraSubtotal = parseFloat(prod.precio_compra || 0) * item.qty;
        const gananciaSubtotal = subtotal - costoCompraSubtotal;

        totalVenta += subtotal;
        gananciaTotalVenta += gananciaSubtotal;

        productosDetalle.push({
            codigo_barras: item.codigo_barras,
            nombre: item.nombre,
            qty: item.qty
        });
    }

    const nuevaVenta = {
        productos_texto: productosDetalle.map(i => `${i.nombre} (x${i.qty})`).join(", "),
        productos_lista: productosDetalle,
        metodo: metodoPagoSeleccionado,
        total: totalVenta.toFixed(2),
        ganancia_total: gananciaTotalVenta.toFixed(2)
    };

    const { error: errVenta } = await _supabase.from('ventas').insert(nuevaVenta);
    if (errVenta) { alert("Error al registrar venta"); return; }

    alert(`✅ Venta registrada con éxito (${metodoPagoSeleccionado}).`);
    carrito = [];
    metodoPagoSeleccionado = "";

    cerrarModalPago();
    actualizarVistaCarrito();
    await renderizarHistorialVentas();
}

async function ajustarStockInmediato(id) {
    const inventario = await getInventario();
    const producto = inventario.find(p => p.id == id);
    if (!producto) return;

    const mensaje = `Ajustar stock de: "${producto.nombre}"\n\n• Para sumar use números normales (Ejemplo: 100)\n• Para restar use el signo menos delante (Ejemplo: -10)\n\nStock actual en sistema: ${producto.stock} unidades.`;
    const valorIngresado = prompt(mensaje, "0");

    if (valorIngresado === null) return;

    const cantidadAsignada = parseInt(valorIngresado);

    if (isNaN(cantidadAsignada) || cantidadAsignada === 0) {
        alert("⚠️ Operación cancelada. Debes ingresar un número válido y diferente de cero.");
        return;
    }

    const nuevoStockCalculado = parseInt(producto.stock) + cantidadAsignada;

    if (nuevoStockCalculado < 0) {
        alert(`❌ Error crítico: No puedes retirar ${Math.abs(cantidadAsignada)} unidades. El inventario real de "${producto.nombre}" tiene únicamente ${producto.stock} unidades disponibles.`);
        return;
    }

    const { error } = await _supabase.from('inventario').update({ stock: nuevoStockCalculado }).eq('id', id);
    if (error) { alert("Error al actualizar stock"); return; }

    const badgeFiltro = document.getElementById("badge-filtro-stock");
    const badgeVenc = document.getElementById("badge-vencimiento");
    const estaFiltrado = !badgeFiltro.classList.contains("hidden");
    const estaFiltradoVenc = !badgeVenc.classList.contains("hidden");

    await cargarInventario(estaFiltrado, estaFiltradoVenc);
}
