import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './Pos.css' // Importamos el nuevo diseño

export default function Pos() {
  const [mediosPago, setMediosPago] = useState([])
  const [categorias, setCategorias] = useState([])
  const [subcategorias, setSubcategorias] = useState([])

  const [tipo, setTipo] = useState('Gasto')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  
  const [medioId, setMedioId] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [subcategoriaId, setSubcategoriaId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [loading, setLoading] = useState(false)

  // Estados para Nuevos Medios
  const [esNuevoMedio, setEsNuevoMedio] = useState(false)
  const [nuevoMedioNombre, setNuevoMedioNombre] = useState('')
  const [nuevoMedioTipo, setNuevoMedioTipo] = useState('Debito')
  
  // NUEVO: Estados para Nuevas Categorías y Subcategorías
  const [esNuevaCategoria, setEsNuevaCategoria] = useState(false)
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState('')
  const [esNuevaSubcategoria, setEsNuevaSubcategoria] = useState(false)
  const [nuevaSubcategoriaNombre, setNuevaSubcategoriaNombre] = useState('')

  const [cuotas, setCuotas] = useState(1)
  const [interes, setInteres] = useState('')

  const [ufValor, setUfValor] = useState(null)
  const [montoMantencion, setMontoMantencion] = useState('')

  // Cargar datos al iniciar
  useEffect(() => {
    const cargarDatosMaestros = async () => {
      const { data: medios } = await supabase.from('medios_pago').select('*')
      const { data: cats } = await supabase.from('categorias').select('*')
      const { data: subcats } = await supabase.from('subcategorias').select('*')
      
      if (medios) {
        setMediosPago(medios)
        if (medios.length > 0) setMedioId(medios[0].id)
      }
      if (cats) setCategorias(cats)
      if (subcats) setSubcategorias(subcats)
    }

    const cargarUF = async () => {
      try {
        const response = await fetch('https://mindicador.cl/api/uf')
        const data = await response.json()
        if (data && data.serie && data.serie.length > 0) {
          const ufHoy = data.serie[0].valor;
          setUfValor(ufHoy)
          setMontoMantencion(Math.round(ufHoy * 0.12))
        }
      } catch (error) {
        console.error("Error obteniendo la UF:", error)
      }
    }

    cargarDatosMaestros()
    cargarUF()
  }, [])

  // Filtros dinámicos de Categorías
  const categoriasFiltradas = categorias.filter(c => c.tipo_movimiento === tipo)
  
  useEffect(() => {
    if (categoriasFiltradas.length > 0 && !esNuevaCategoria) {
      setCategoriaId(categoriasFiltradas[0].id)
    } else if (!esNuevaCategoria) {
      setCategoriaId('')
    }
  }, [tipo, categorias, esNuevaCategoria])

  const subcatsFiltradas = subcategorias.filter(s => s.categoria_id == categoriaId)

  useEffect(() => {
    if (subcatsFiltradas.length > 0 && !esNuevaSubcategoria) {
      setSubcategoriaId(subcatsFiltradas[0].id)
    } else if (!esNuevaSubcategoria) {
      setSubcategoriaId('')
    }
  }, [categoriaId, subcategorias, esNuevaSubcategoria])

  // Handlers para selects dinámicos
  const handleMedioPagoChange = (e) => {
    const valor = e.target.value;
    if (valor === 'nuevo') {
      setEsNuevoMedio(true); setMedioId('nuevo'); setCuotas(1); setInteres('');
    } else {
      setEsNuevoMedio(false); setMedioId(valor); setCuotas(1); setInteres('');
    }
  }

  const handleCategoriaChange = (e) => {
    const valor = e.target.value;
    if (valor === 'nueva') {
      setEsNuevaCategoria(true);
      setCategoriaId('nueva');
      // Si crea una categoría nueva, obligamos a crear una subcategoría nueva
      setEsNuevaSubcategoria(true);
      setSubcategoriaId('nueva');
    } else {
      setEsNuevaCategoria(false);
      setCategoriaId(valor);
      setEsNuevaSubcategoria(false);
    }
  }

  const handleSubcategoriaChange = (e) => {
    const valor = e.target.value;
    if (valor === 'nueva') {
      setEsNuevaSubcategoria(true); setSubcategoriaId('nueva');
    } else {
      setEsNuevaSubcategoria(false); setSubcategoriaId(valor);
    }
  }

  const medioSeleccionado = mediosPago.find(m => m.id == medioId)
  const esCredito = (esNuevoMedio && nuevoMedioTipo === 'Credito') || (medioSeleccionado?.tipo === 'Credito')

  // Mantención rápida
  const registrarMantencionRapida = async () => {
    if (!montoMantencion) return;
    const medioTC = mediosPago.find(m => m.nombre.includes('Estudiante') || m.tipo === 'Credito')
    const catFinanciera = categorias.find(c => c.nombre.includes('Financieros'))
    const subcatMantencion = subcategorias.find(s => s.nombre.includes('Mantención') && s.categoria_id === catFinanciera?.id)

    if (!medioTC || !catFinanciera || !subcatMantencion) {
      alert("Faltan datos maestros para registrar la mantención automática.")
      return;
    }

    setLoading(true)
    const { error } = await supabase.from('transacciones').insert([{
      tipo_movimiento: 'Gasto',
      monto: parseFloat(montoMantencion),
      fecha_transaccion: new Date().toISOString().split('T')[0],
      medio_pago_id: medioTC.id,
      subcategoria_id: subcatMantencion.id,
      descripcion: `Mantención TC Mensual (UF: $${ufValor})`,
      es_cuota: false
    }])

    if (error) alert("Error: " + error.message)
    else alert("¡Mantención registrada con éxito! 🏦")
    setLoading(false)
  }

  // Guardado principal
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      let finalMedioId = medioId;
      let finalCategoriaId = categoriaId;
      let finalSubcategoriaId = subcategoriaId;

      // 1. Insertar Medio de Pago nuevo
      if (esNuevoMedio) {
        const { data: newMedio, error: errMedio } = await supabase.from('medios_pago')
          .insert([{ nombre: nuevoMedioNombre, tipo: nuevoMedioTipo }]).select()
        if (errMedio) throw errMedio;
        finalMedioId = newMedio[0].id;
        setMediosPago([...mediosPago, newMedio[0]])
        setEsNuevoMedio(false)
      }

      // 2. Insertar Categoría nueva
      if (esNuevaCategoria) {
        const { data: newCat, error: errCat } = await supabase.from('categorias')
          .insert([{ nombre: nuevaCategoriaNombre, tipo_movimiento: tipo }]).select()
        if (errCat) throw errCat;
        finalCategoriaId = newCat[0].id;
        setCategorias([...categorias, newCat[0]])
        setEsNuevaCategoria(false)
      }

      // 3. Insertar Subcategoría nueva
      if (esNuevaSubcategoria) {
        const { data: newSubcat, error: errSubcat } = await supabase.from('subcategorias')
          .insert([{ nombre: nuevaSubcategoriaNombre, categoria_id: finalCategoriaId }]).select()
        if (errSubcat) throw errSubcat;
        finalSubcategoriaId = newSubcat[0].id;
        setSubcategorias([...subcategorias, newSubcat[0]])
        setEsNuevaSubcategoria(false)
      }

      // 4. Insertar Transacción
      let transaccionesAInsertar = [];
      const montoBase = parseFloat(monto) || 0;
      const montoInteres = parseFloat(interes) || 0;
      const montoTotalReal = montoBase + montoInteres;

      if (esCredito && cuotas > 1) {
        const montoCuota = montoTotalReal / cuotas;
        const compraPadreId = crypto.randomUUID(); 
        const fechaCompra = new Date(fecha + 'T00:00:00');
        const saltarMeses = fechaCompra.getDate() >= 22 ? 2 : 1;
        const mesInicial = fechaCompra.getMonth() + saltarMeses;

        for (let i = 0; i < cuotas; i++) {
          const fechaPago = new Date(fechaCompra.getFullYear(), mesInicial + i, 5);
          transaccionesAInsertar.push({
            tipo_movimiento: tipo, monto: montoCuota, fecha_transaccion: fechaPago.toISOString().split('T')[0],
            medio_pago_id: finalMedioId, subcategoria_id: finalSubcategoriaId || null,
            descripcion: `${descripcion} (Cuota ${i+1}/${cuotas})`, es_cuota: true, numero_cuota: i + 1,
            total_cuotas: cuotas, id_compra_padre: compraPadreId
          });
        }
      } else {
        transaccionesAInsertar.push({
          tipo_movimiento: tipo, monto: montoTotalReal, fecha_transaccion: fecha,
          medio_pago_id: finalMedioId, subcategoria_id: finalSubcategoriaId || null,
          descripcion: descripcion, es_cuota: false
        });
      }

      const { error: errTrans } = await supabase.from('transacciones').insert(transaccionesAInsertar)
      if (errTrans) throw errTrans;

      alert("¡Transacción registrada con éxito! 🚀")
      setMonto(''); setDescripcion(''); setCuotas(1); setInteres('');
    } catch (error) {
      alert("Error al registrar: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pos-wrapper">
      
      {ufValor && (
        <div className="banner-uf">
          <div style={{ marginBottom: '8px' }}>
            💡 <strong>Valor UF Hoy:</strong> ${Math.round(ufValor).toLocaleString('es-CL')}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '14px' }}>Ajusta el cobro de tu TC:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <strong>$</strong>
              <input type="number" className="form-input" value={montoMantencion} onChange={(e) => setMontoMantencion(e.target.value)} style={{ width: '90px', padding: '6px' }} />
              <button type="button" className="btn-mantencion" onClick={registrarMantencionRapida} disabled={loading}>
                {loading ? '...' : '⚡ Pagar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pos-card">
        <form onSubmit={handleSubmit}>
          
          {/* Toggle de Gasto/Ingreso */}
          <div className="type-toggle">
            <label className={tipo === 'Gasto' ? 'active-gasto' : ''}>
              <input type="radio" value="Gasto" checked={tipo === 'Gasto'} onChange={(e) => {setTipo(e.target.value); setEsNuevaCategoria(false); setEsNuevaSubcategoria(false);}} />
              Gasto
            </label>
            <label className={tipo === 'Ingreso' ? 'active-ingreso' : ''}>
              <input type="radio" value="Ingreso" checked={tipo === 'Ingreso'} onChange={(e) => {setTipo(e.target.value); setEsNuevaCategoria(false); setEsNuevaSubcategoria(false);}} />
              Ingreso
            </label>
          </div>

          {/* Monto y Fecha */}
          <div className="input-group">
            <input type="number" className="form-input" placeholder="Monto total ($)" value={monto} onChange={(e) => setMonto(e.target.value)} required />
            <input type="date" className="form-input" value={fecha} onChange={(e) => setFecha(e.target.value)} required style={{ width: '150px' }} />
          </div>

          {/* Medios de Pago */}
          <select className="form-input" value={medioId} onChange={handleMedioPagoChange} required style={{ marginBottom: esNuevoMedio ? '10px' : '15px' }}>
            <option value="" disabled>Selecciona el medio de pago...</option>
            {mediosPago.map(m => <option key={m.id} value={m.id}>{m.nombre} ({m.tipo})</option>)}
            <option value="nuevo" style={{ fontWeight: 'bold' }}>➕ Agregar cuenta nueva...</option>
          </select>

          {esNuevoMedio && (
            <div className="new-item-panel">
              <input type="text" className="form-input" placeholder="Nombre (Ej: Caja chica)" value={nuevoMedioNombre} onChange={(e) => setNuevoMedioNombre(e.target.value)} required />
              <select className="form-input" value={nuevoMedioTipo} onChange={(e) => setNuevoMedioTipo(e.target.value)} required style={{ width: '150px' }}>
                <option value="Debito">Débito</option>
                <option value="Credito">Crédito</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Efectivo">Efectivo</option>
              </select>
            </div>
          )}

          {/* Cuotas TC */}
          {esCredito && tipo === 'Gasto' && (
            <div className="credit-panel">
              <label>💳 Opciones de Tarjeta de Crédito</label>
              <div className="input-group">
                <input type="number" className="form-input" min="1" max="48" value={cuotas} onChange={(e) => setCuotas(e.target.value)} style={{ width: '80px' }} title="N° de Cuotas" />
                <input type="number" className="form-input" placeholder="Interés cobrado ($)" value={interes} onChange={(e) => setInteres(e.target.value)} />
              </div>
              {monto && (
                <div style={{ fontSize: '13px', textAlign: 'right', color: '#495057' }}>
                  Total: ${(parseFloat(monto) + (parseFloat(interes) || 0))} {cuotas > 1 && `(~$${((parseFloat(monto) + (parseFloat(interes) || 0)) / cuotas).toFixed(0)}/mes)`}
                </div>
              )}
            </div>
          )}

          {/* Categorías y Subcategorías */}
          <div className="input-group" style={{ marginBottom: (esNuevaCategoria || esNuevaSubcategoria) ? '10px' : '15px' }}>
            <select className="form-input" value={categoriaId} onChange={handleCategoriaChange} required>
              <option value="" disabled>Categoría...</option>
              {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              <option value="nueva" style={{ fontWeight: 'bold' }}>➕ Nueva categoría...</option>
            </select>
            
            <select className="form-input" value={subcategoriaId} onChange={handleSubcategoriaChange} required disabled={esNuevaCategoria}>
              <option value="" disabled>Subcategoría...</option>
              {subcatsFiltradas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              {!esNuevaCategoria && <option value="nueva" style={{ fontWeight: 'bold' }}>➕ Nueva subcategoría...</option>}
              {esNuevaCategoria && <option value="nueva">Subcategoría requerida</option>}
            </select>
          </div>

          {/* Paneles de creación Categoría/Subcategoría */}
          {(esNuevaCategoria || esNuevaSubcategoria) && (
            <div className="new-item-panel" style={{ flexDirection: 'column' }}>
              {esNuevaCategoria && (
                <input type="text" className="form-input" placeholder="Nombre de la nueva Categoría" value={nuevaCategoriaNombre} onChange={(e) => setNuevaCategoriaNombre(e.target.value)} required />
              )}
              {esNuevaSubcategoria && (
                <input type="text" className="form-input" placeholder="Nombre de la nueva Subcategoría" value={nuevaSubcategoriaNombre} onChange={(e) => setNuevaSubcategoriaNombre(e.target.value)} required />
              )}
            </div>
          )}

          {/* Descripción */}
          <input type="text" className="form-input" placeholder="Descripción de la venta o compra..." value={descripcion} onChange={(e) => setDescripcion(e.target.value)} style={{ marginBottom: '15px' }} />

          <button type="submit" className="btn-submit" disabled={loading || !subcategoriaId}>
            {loading ? 'Procesando...' : '💾 Registrar Movimiento'}
          </button>
        </form>
      </div>
    </div>
  )
}