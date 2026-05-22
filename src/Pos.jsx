import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

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

  const [esNuevoMedio, setEsNuevoMedio] = useState(false)
  const [nuevoMedioNombre, setNuevoMedioNombre] = useState('')
  const [nuevoMedioTipo, setNuevoMedioTipo] = useState('Debito')
  
  const [cuotas, setCuotas] = useState(1)
  const [interes, setInteres] = useState('')

  // Estados para la UF y la Mantención Editable
  const [ufValor, setUfValor] = useState(null)
  const [montoMantencion, setMontoMantencion] = useState('') // Guardará el valor editable

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
          // Sugerimos un valor inicial aproximado (basado en ~0.12 UF)
          setMontoMantencion(Math.round(ufHoy * 0.12))
        }
      } catch (error) {
        console.error("Error obteniendo la UF:", error)
      }
    }

    cargarDatosMaestros()
    cargarUF()
  }, [])

  const categoriasFiltradas = categorias.filter(c => c.tipo_movimiento === tipo)
  
  useEffect(() => {
    if (categoriasFiltradas.length > 0) setCategoriaId(categoriasFiltradas[0].id)
    else setCategoriaId('')
  }, [tipo, categorias])

  const subcatsFiltradas = subcategorias.filter(s => s.categoria_id == categoriaId)

  useEffect(() => {
    if (subcatsFiltradas.length > 0) setSubcategoriaId(subcatsFiltradas[0].id)
    else setSubcategoriaId('')
  }, [categoriaId, subcategorias])

  const handleMedioPagoChange = (e) => {
    const valor = e.target.value;
    if (valor === 'nuevo') {
      setEsNuevoMedio(true);
      setMedioId('nuevo');
      setCuotas(1);
      setInteres('');
    } else {
      setEsNuevoMedio(false);
      setMedioId(valor);
      setCuotas(1);
      setInteres('');
    }
  }

  const medioSeleccionado = mediosPago.find(m => m.id == medioId)
  const esCredito = (esNuevoMedio && nuevoMedioTipo === 'Credito') || (medioSeleccionado?.tipo === 'Credito')

  const registrarMantencionRapida = async () => {
    if (!montoMantencion) return;
    
    const medioTC = mediosPago.find(m => m.nombre.includes('Estudiante') || m.tipo === 'Credito')
    const catFinanciera = categorias.find(c => c.nombre.includes('Financieros'))
    const subcatMantencion = subcategorias.find(s => s.nombre.includes('Mantención') && s.categoria_id === catFinanciera?.id)

    if (!medioTC || !catFinanciera || !subcatMantencion) {
      alert("Error: Asegúrate de tener creadas la categoría 'Gastos Financieros' y tu Tarjeta de Crédito.")
      return;
    }

    setLoading(true)

    const transaccionMantencion = {
      tipo_movimiento: 'Gasto',
      monto: parseFloat(montoMantencion), // Usamos el monto que tú dejaste en la cajita
      fecha_transaccion: new Date().toISOString().split('T')[0],
      medio_pago_id: medioTC.id,
      subcategoria_id: subcatMantencion.id,
      descripcion: `Mantención TC Mensual (UF del día: $${ufValor})`,
      es_cuota: false
    }

    const { error } = await supabase.from('transacciones').insert([transaccionMantencion])

    if (error) {
      alert("Error al registrar mantención: " + error.message)
    } else {
      alert("¡Mantención registrada con éxito al peso exacto! 🏦")
    }
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    let finalMedioId = medioId;

    if (esNuevoMedio) {
      const { data: nuevoMedioData, error: errorMedio } = await supabase
        .from('medios_pago')
        .insert([{ nombre: nuevoMedioNombre, tipo: nuevoMedioTipo }])
        .select()

      if (errorMedio) {
        alert("Error al crear el medio de pago: " + errorMedio.message)
        setLoading(false)
        return
      }
      finalMedioId = nuevoMedioData[0].id;
      setMediosPago([...mediosPago, nuevoMedioData[0]])
      setEsNuevoMedio(false)
      setMedioId(finalMedioId)
      setNuevoMedioNombre('')
    }

    let transaccionesAInsertar = [];
    const montoBase = parseFloat(monto) || 0;
    const montoInteres = parseFloat(interes) || 0;
    const montoTotalReal = montoBase + montoInteres;

    if (esCredito && cuotas > 1) {
      const montoCuota = montoTotalReal / cuotas;
      const compraPadreId = crypto.randomUUID(); 
      const fechaCompra = new Date(fecha + 'T00:00:00');
      const diaCompra = fechaCompra.getDate();
      
      const saltarMeses = diaCompra >= 22 ? 2 : 1;
      const mesInicial = fechaCompra.getMonth() + saltarMeses;

      for (let i = 0; i < cuotas; i++) {
        const fechaPago = new Date(fechaCompra.getFullYear(), mesInicial + i, 5);
        
        transaccionesAInsertar.push({
          tipo_movimiento: tipo,
          monto: montoCuota,
          fecha_transaccion: fechaPago.toISOString().split('T')[0],
          medio_pago_id: finalMedioId,
          subcategoria_id: subcategoriaId || null,
          descripcion: `${descripcion} (Cuota ${i+1}/${cuotas})`,
          es_cuota: true,
          numero_cuota: i + 1,
          total_cuotas: cuotas,
          id_compra_padre: compraPadreId
        });
      }
    } else {
      transaccionesAInsertar.push({
        tipo_movimiento: tipo,
        monto: montoTotalReal, 
        fecha_transaccion: fecha,
        medio_pago_id: finalMedioId,
        subcategoria_id: subcategoriaId || null,
        descripcion: descripcion,
        es_cuota: false
      });
    }

    const { error } = await supabase.from('transacciones').insert(transaccionesAInsertar)

    if (error) {
      alert("Error al registrar: " + error.message)
    } else {
      alert("¡Transacción guardada con éxito! 🚀")
      setMonto('')
      setDescripcion('')
      setCuotas(1)
      setInteres('')
    }
    setLoading(false)
  }

  return (
    <div style={{ backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '8px', color: '#333' }}>
      
      {/* BANNER INTELIGENTE EDITABLE */}
      {ufValor && (
        <div style={{ padding: '15px', backgroundColor: '#fff3cd', borderRadius: '5px', border: '1px solid #ffeeba', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '14px', color: '#856404' }}>
            💡 <strong>Valor UF Hoy:</strong> ${Math.round(ufValor).toLocaleString('es-CL')}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '14px', color: '#856404' }}>
              ¿Te facturaron la mantención? Ajusta el monto exacto:
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ color: '#856404', fontWeight: 'bold' }}>$</span>
              <input 
                type="number" 
                value={montoMantencion} 
                onChange={(e) => setMontoMantencion(e.target.value)} 
                style={{ padding: '8px', width: '90px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
              <button 
                type="button" 
                onClick={registrarMantencionRapida} 
                disabled={loading}
                style={{ padding: '8px 12px', fontSize: '14px', backgroundColor: '#ffc107', color: '#212529', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {loading ? '...' : '⚡ Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ... El resto del formulario se mantiene idéntico ... */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <label>
            <input type="radio" value="Gasto" checked={tipo === 'Gasto'} onChange={(e) => setTipo(e.target.value)} /> Gasto
          </label>
          <label>
            <input type="radio" value="Ingreso" checked={tipo === 'Ingreso'} onChange={(e) => setTipo(e.target.value)} /> Ingreso
          </label>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <input type="number" placeholder="Monto del Producto ($)" value={monto} onChange={(e) => setMonto(e.target.value)} required style={{ flex: 1, padding: '8px' }} />
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required style={{ padding: '8px' }} />
        </div>

        <select value={medioId} onChange={handleMedioPagoChange} required style={{ padding: '8px' }}>
          <option value="" disabled>Selecciona el medio de pago...</option>
          {mediosPago.map(m => (
            <option key={m.id} value={m.id}>{m.nombre} ({m.tipo})</option>
          ))}
          <option value="nuevo" style={{ fontWeight: 'bold', color: '#4CAF50' }}>➕ Otro (Agregar nuevo)...</option>
        </select>

        {esNuevoMedio && (
          <div style={{ display: 'flex', gap: '10px', padding: '15px', backgroundColor: '#e9ecef', borderRadius: '5px', border: '1px dashed #ccc' }}>
            <input type="text" placeholder="Nombre (Ej: Banco Edwards)" value={nuevoMedioNombre} onChange={(e) => setNuevoMedioNombre(e.target.value)} required style={{ flex: 1, padding: '8px' }} />
            <select value={nuevoMedioTipo} onChange={(e) => setNuevoMedioTipo(e.target.value)} required style={{ padding: '8px' }}>
              <option value="Debito">Débito</option>
              <option value="Credito">Crédito</option>
              <option value="Transferencia">Transferencia</option>
              <option value="Efectivo">Efectivo</option>
            </select>
          </div>
        )}

        {esCredito && tipo === 'Gasto' && (
          <div style={{ padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '5px', borderLeft: '4px solid #2196f3', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontWeight: 'bold' }}>Detalles de Tarjeta de Crédito</label>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="number" min="1" max="48" value={cuotas} onChange={(e) => setCuotas(e.target.value)} style={{ padding: '8px', width: '80px' }} />
              <span>cuotas</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="number" placeholder="Interés total cobrado ($)" value={interes} onChange={(e) => setInteres(e.target.value)} style={{ padding: '8px', flex: 1 }} />
              <span style={{ fontSize: '12px', color: '#666' }}>(Opcional)</span>
            </div>

            {monto && (
              <div style={{ color: '#555', fontSize: '14px', marginTop: '5px', textAlign: 'right' }}>
                Total a financiar: <strong>${(parseFloat(monto) + (parseFloat(interes) || 0))}</strong> 
                {cuotas > 1 && ` (Aprox. $${((parseFloat(monto) + (parseFloat(interes) || 0)) / cuotas).toFixed(0)}/mes)`}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} required style={{ flex: 1, padding: '8px' }}>
            {categoriasFiltradas.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          
          <select value={subcategoriaId} onChange={(e) => setSubcategoriaId(e.target.value)} required style={{ flex: 1, padding: '8px' }}>
            {subcatsFiltradas.length > 0 ? (
              subcatsFiltradas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)
            ) : (
              <option value="" disabled>Sin subcategorías</option>
            )}
          </select>
        </div>

        <input type="text" placeholder="Ej: Pago de servidor, salidas..." value={descripcion} onChange={(e) => setDescripcion(e.target.value)} style={{ padding: '8px' }} />

        <button type="submit" disabled={loading || !subcategoriaId} style={{ padding: '12px', fontSize: '16px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          {loading ? 'Procesando...' : '💾 Registrar Transacción'}
        </button>
      </form>
    </div>
  )
}